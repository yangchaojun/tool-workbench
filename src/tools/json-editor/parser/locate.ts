/**
 * JSON 语法错误定位器（见 docs/adr/0002）。
 *
 * 职责边界：只在 `JSON.parse` 抛错后被调用，专职把错误换算成跨引擎一致的
 * 行:列 + 可读原因；**不产出数据**，树与输出一律来自 JSON.parse。
 *
 * 不误报的兜底契约：若本文本在此解析器眼中是合法 JSON（与引擎结论相悖、
 * 或超出深度上限主动放弃），返回 null，由调用方降级显示引擎原始报错。
 */

export interface JsonErrorLocation {
  /** 1 起始的行号 */
  line: number
  /** 1 起始的列号 */
  column: number
  message: string
}

/** 递归深度护栏：超出即放弃定位（返回 null），防止爆栈 */
const MAX_DEPTH = 10_000

class LocatedError extends Error {
  location: JsonErrorLocation

  constructor(location: JsonErrorLocation) {
    super(location.message)
    this.location = location
  }
}

/** 主动放弃的信号：定位器不猜，交给引擎原始报错 */
class GiveUpError extends Error {}

interface Cursor {
  text: string
  pos: number
  line: number
  col: number
}

function advance(c: Cursor): string {
  const ch = c.text[c.pos]
  c.pos += 1
  if (ch === '\n') {
    c.line += 1
    c.col = 1
  } else {
    c.col += 1
  }
  return ch
}

function fail(c: Cursor, message: string): never {
  throw new LocatedError({ line: c.line, column: c.col, message })
}

function skipWhitespace(c: Cursor): void {
  while (c.pos < c.text.length) {
    const ch = c.text[c.pos]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') advance(c)
    else break
  }
}

function parseString(c: Cursor): void {
  advance(c) // 开引号
  for (;;) {
    if (c.pos >= c.text.length) fail(c, '字符串未闭合（缺少结束引号）')
    const ch = c.text[c.pos]
    if (ch === '"') {
      advance(c)
      return
    }
    if (ch === '\\') {
      advance(c)
      const esc = c.text[c.pos]
      if (esc === undefined) fail(c, '字符串未闭合（转义符后输入意外结束）')
      if ('"\\/bfnrt'.includes(esc)) {
        advance(c)
        continue
      }
      if (esc === 'u') {
        advance(c)
        for (let i = 0; i < 4; i += 1) {
          const hex = c.text[c.pos]
          if (hex === undefined || !/^[0-9a-fA-F]$/.test(hex)) {
            fail(c, '\\u 转义后需要 4 位十六进制数字')
          }
          advance(c)
        }
        continue
      }
      fail(c, `无效的转义字符 “\\${esc}”`)
      continue
    }
    if (ch < ' ') fail(c, '字符串内包含未转义的控制字符')
    advance(c)
  }
}

function parseNumber(c: Cursor): void {
  if (c.text[c.pos] === '-') advance(c)
  const first = c.text[c.pos]
  if (first === '0') {
    advance(c)
  } else if (first !== undefined && first >= '1' && first <= '9') {
    advance(c)
    while (c.text[c.pos] !== undefined && isDigit(c.text[c.pos])) advance(c)
  } else {
    fail(c, '无效的数字')
  }
  if (c.text[c.pos] === '.') {
    advance(c)
    if (!isDigit(c.text[c.pos])) fail(c, '小数点后缺少数字')
    while (isDigit(c.text[c.pos])) advance(c)
  }
  const exp = c.text[c.pos]
  if (exp === 'e' || exp === 'E') {
    advance(c)
    const sign = c.text[c.pos]
    if (sign === '+' || sign === '-') advance(c)
    if (!isDigit(c.text[c.pos])) fail(c, '指数部分缺少数字')
    while (isDigit(c.text[c.pos])) advance(c)
  }
}

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9'
}

function parseLiteral(c: Cursor): void {
  // 首字符已确认为 t / f / n 之一（调用方保证）
  const word = c.text[c.pos] === 't' ? 'true' : c.text[c.pos] === 'f' ? 'false' : 'null'
  if (c.text.startsWith(word, c.pos)) {
    for (let i = 0; i < word.length; i += 1) advance(c)
  } else {
    fail(c, '无效的字面量（应为 true / false / null）')
  }
}

function parseValue(c: Cursor, depth: number): void {
  if (depth > MAX_DEPTH) throw new GiveUpError()
  skipWhitespace(c)
  const ch = c.text[c.pos]
  if (ch === undefined) fail(c, '缺少 JSON 值（输入意外结束）')
  switch (ch) {
    case '{':
      advance(c)
      skipWhitespace(c)
      if (c.text[c.pos] === '}') {
        advance(c)
        return
      }
      for (;;) {
        skipWhitespace(c)
        if (c.pos >= c.text.length) fail(c, '缺少对象键（输入意外结束）')
        if (c.text[c.pos] !== '"') fail(c, '对象键必须是双引号字符串')
        parseString(c)
        skipWhitespace(c)
        if (c.text[c.pos] !== ':') fail(c, '缺少冒号（:）')
        advance(c)
        parseValue(c, depth + 1)
        skipWhitespace(c)
        const next = c.text[c.pos]
        if (next === ',') {
          advance(c)
          continue
        }
        if (next === '}') {
          advance(c)
          return
        }
        if (next === undefined) fail(c, '缺少逗号或右花括号（}）（输入意外结束）')
        fail(c, '缺少逗号或右花括号（}）')
      }
    case '[':
      advance(c)
      skipWhitespace(c)
      if (c.text[c.pos] === ']') {
        advance(c)
        return
      }
      for (;;) {
        parseValue(c, depth + 1)
        skipWhitespace(c)
        const next = c.text[c.pos]
        if (next === ',') {
          advance(c)
          continue
        }
        if (next === ']') {
          advance(c)
          return
        }
        if (next === undefined) fail(c, '缺少逗号或右方括号（]）（输入意外结束）')
        fail(c, '缺少逗号或右方括号（]）')
      }
    case '"':
      parseString(c)
      return
    case '-':
    case '0':
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
      parseNumber(c)
      return
    case 't':
    case 'f':
    case 'n':
      parseLiteral(c)
      return
    default:
      fail(c, `意外的字符 “${ch}”`)
  }
}

/**
 * 定位 JSON 文本中的第一处语法错误。
 * 返回 null 表示：文本在此解析器看来无错（或主动放弃）——
 * 调用方应降级显示 JSON.parse 的原始报错，而不是编造位置。
 */
export function locateJsonError(text: string): JsonErrorLocation | null {
  const c: Cursor = { text, pos: 0, line: 1, col: 1 }
  try {
    skipWhitespace(c)
    parseValue(c, 0)
    skipWhitespace(c)
    if (c.pos < text.length) fail(c, 'JSON 值结束后存在多余的内容')
    return null
  } catch (error) {
    if (error instanceof LocatedError) return error.location
    return null
  }
}
