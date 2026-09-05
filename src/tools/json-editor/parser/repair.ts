/**
 * JSON 容错修复器（见 docs/adr/0002 Revision）。
 *
 * 职责：对常见书写错误产出**候选**修正文本与修改点清单，交由用户确认。
 * 修复结果仍必须通过 JSON.parse 校验后才算成功——本模块绝不产出"直接可用"的数据。
 *
 * 覆盖的错误类型：尾逗号、单引号 / 中文引号字符串、无引号键、
 * // 与块注释、NaN / ±Infinity、末尾多余内容，以及成员/元素之间缺失的逗号与冒号。
 */

export interface RepairFix {
  /** 修改点在原文的 1 起始行号 */
  line: number
  /** 修改点在原文的 1 起始列号 */
  column: number
  /** 原文片段 */
  before: string
  /** 修正后片段 */
  after: string
  /** 错误类型的中文标签 */
  kind: string
}

export type RepairResult =
  | { ok: true; text: string; fixes: RepairFix[] }
  | { ok: false; reason: string }

/** 递归深度护栏：与定位器一致，超出即放弃 */
const MAX_DEPTH = 10_000

/** 修复器内部失败信号（message 面向用户） */
class RepairFail extends Error {
  constructor(
    message: string,
    readonly pos: number,
  ) {
    super(message)
  }
}

/** 行首偏移表：把字符偏移换算成 1 起始 行:列 */
function buildLineStarts(text: string): number[] {
  const starts = [0]
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') starts.push(i + 1)
  }
  return starts
}

function lineColOf(starts: number[], pos: number): { line: number; column: number } {
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= pos) lo = mid
    else hi = mid - 1
  }
  return { line: lo + 1, column: pos - starts[lo] + 1 }
}

const IDENT_START = /[A-Za-z_$]/
const IDENT_PART = /[A-Za-z0-9_$]/

const SIMPLE_ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
  "'": "'",
  '"': '"',
  '\\': '\\',
  '/': '/',
}

/** 单引号 / 中文引号字符串的内文转义还原（只处理常见序列，未知的 \x 还原为 x） */
function unescapeInner(inner: string): string {
  let result = ''
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i]
    if (ch !== '\\' || i === inner.length - 1) {
      result += ch
      continue
    }
    const next = inner[i + 1]
    if (next in SIMPLE_ESCAPES) {
      result += SIMPLE_ESCAPES[next]
      i += 1
    } else if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(inner.slice(i + 2, i + 6))) {
      result += String.fromCharCode(parseInt(inner.slice(i + 2, i + 6), 16))
      i += 5
    } else {
      result += next
      i += 1
    }
  }
  return result
}

class Fixer {
  private readonly out: string[] = []
  readonly fixes: RepairFix[] = []
  private readonly lineStarts: number[]
  pos = 0

  constructor(readonly src: string) {
    this.lineStarts = buildLineStarts(src)
  }

  get output(): string {
    return this.out.join('')
  }

  /** 已输出的块数（配合 truncateOutput 做回退标记） */
  get outLength(): number {
    return this.out.length
  }

  /** 丢弃标记之后已输出的内容（用于尾逗号回退） */
  truncateOutput(mark: number): void {
    this.out.length = mark
  }

  /** 回退后重吐 [from, to) 中的空白与注释（不含被移除的逗号本身） */
  replayWhitespace(from: number, to: number): void {
    const segment = this.src.slice(from, to)
    if (segment !== '') this.out.push(segment)
  }

  peek(offset = 0): string | undefined {
    return this.src[this.pos + offset]
  }

  /** 原样消费并输出 n 个字符 */
  take(n = 1): void {
    this.out.push(this.src.slice(this.pos, this.pos + n))
    this.pos += n
  }

  /** 直接输出一段文本（无对应原文，如补插的逗号） */
  pushText(text: string): void {
    this.out.push(text)
  }

  /** 把 [from, pos) 的原文替换为 replacement，并记一次修改 */
  replace(from: number, replacement: string, kind: string): void {
    const before = this.src.slice(from, this.pos)
    if (before === replacement) return
    const { line, column } = lineColOf(this.lineStarts, from)
    this.fixes.push({ line, column, before, after: replacement, kind })
    this.out.push(replacement)
  }

  /** 在当前位置插入文本（无被替换内容），并记一次修改 */
  insert(replacement: string, kind: string): void {
    const { line, column } = lineColOf(this.lineStarts, this.pos)
    this.fixes.push({ line, column, before: '', after: replacement, kind })
    this.out.push(replacement)
  }

  /** 记一次「原文内容被丢弃」型修改（不产生输出） */
  recordRemoval(pos: number, removed: string, kind: string): void {
    const { line, column } = lineColOf(this.lineStarts, pos)
    this.fixes.push({ line, column, before: removed, after: '', kind })
  }

  fail(message: string): never {
    throw new RepairFail(message, this.pos)
  }

  /** 跳过空白与注释（注释按修改点移除） */
  skipWsAndComments(): void {
    for (;;) {
      const ch = this.peek()
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        this.take()
        continue
      }
      if (ch === '/' && this.peek(1) === '/') {
        const from = this.pos
        while (this.pos < this.src.length && this.peek() !== '\n') this.pos += 1
        this.replace(from, '', '移除注释')
        continue
      }
      if (ch === '/' && this.peek(1) === '*') {
        const from = this.pos
        const end = this.src.indexOf('*/', this.pos + 2)
        this.pos = end === -1 ? this.src.length : end + 2
        this.replace(from, '', '移除注释')
        continue
      }
      return
    }
  }

  /**
   * 解析字符串。开引号可以是 " ' “ ‘；非双引号字符串整段转换为双引号形式，
   * 内部双引号转义、\' 等单引号风格转义被还原。
   */
  parseString(openQuote: string): void {
    const closeQuote =
      openQuote === '“' ? '”' : openQuote === '‘' ? '’' : openQuote
    const from = this.pos
    if (openQuote === '"') {
      this.take() // 开引号
      for (;;) {
        const ch = this.peek()
        if (ch === undefined) this.fail('字符串未闭合（缺少结束引号）')
        if (ch === '"') {
          this.take()
          return
        }
        if (ch === '\\') {
          if (this.peek(1) === undefined) this.fail('字符串未闭合（转义符后输入意外结束）')
          this.take(2)
          continue
        }
        if (ch < ' ') this.fail('字符串内包含未转义的控制字符')
        this.take()
      }
    }

    // 非双引号字符串：收集内文（不输出），整段重写
    this.pos += 1 // 跳过开引号
    const innerStart = this.pos
    for (;;) {
      const ch = this.peek()
      if (ch === undefined) this.fail('字符串未闭合（缺少结束引号）')
      if (ch === closeQuote) break
      if (ch === '\\') {
        if (this.peek(1) === undefined) this.fail('字符串未闭合（转义符后输入意外结束）')
        this.pos += 2
        continue
      }
      this.pos += 1
    }
    const rawInner = this.src.slice(innerStart, this.pos)
    this.pos += 1 // 跳过闭引号
    const converted = JSON.stringify(unescapeInner(rawInner))
    const { line, column } = lineColOf(this.lineStarts, from)
    this.fixes.push({
      line,
      column,
      before: this.src.slice(from, this.pos),
      after: converted,
      kind: '引号规范化',
    })
    this.out.push(converted)
  }

  parseNumber(): void {
    const from = this.pos
    if (this.peek() === '-') this.take()
    // 宽松吃进数字字符（含指数符号），最终由 JSON.parse 把关
    while (this.peek() !== undefined && /[0-9.eE+-]/.test(this.peek()!)) this.take()
    if (this.pos === from) this.fail('无效的数字')
  }
}

export function repairJson(input: string): RepairResult {
  if (safeParse(input)) {
    return { ok: false, reason: '输入已是合法 JSON，无需修复' }
  }
  try {
    const fixer = new Fixer(input)
    fixer.skipWsAndComments()
    parseValue(fixer, 0)
    fixer.skipWsAndComments()
    if (fixer.pos < input.length) {
      const from = fixer.pos
      fixer.pos = input.length
      fixer.replace(from, '', '移除末尾多余内容')
    }
    const text = fixer.output
    if (!safeParse(text)) {
      return { ok: false, reason: '已尽力修复，但结果仍未通过 JSON 校验（候选已放弃）' }
    }
    return { ok: true, text, fixes: fixer.fixes }
  } catch (error) {
    if (error instanceof RepairFail) {
      const { line, column } = lineColOf(buildLineStarts(input), error.pos)
      return {
        ok: false,
        reason: `无法自动修复：第 ${line} 行 第 ${column} 列 ${error.message}`,
      }
    }
    return { ok: false, reason: '无法自动修复（解析器放弃）' }
  }
}

function safeParse(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

/**
 * 成员/元素之间的分隔逻辑已并入 parseContainer（延迟输出逗号策略）。
 */

function parseContainer(f: Fixer, open: '{' | '[', depth: number): void {
  f.take() // 开括号
  const close = open === '{' ? '}' : ']'
  // 逗号状态：null=尚未遇到分隔点；'emitted'=原文逗号已吐出（若成尾逗号需回退）；
  // 'needed'=成员之间缺逗号（下一轮顶部补插）
  let commaState: 'emitted' | 'needed' | null = null
  let commaMark = 0
  let commaPos = 0

  for (;;) {
    f.skipWsAndComments()
    if (f.peek() === close) {
      if (commaState === 'emitted') {
        // 尾逗号：回退已输出的逗号及其后空白，再重吐空白保留原排版
        const removed = f.src.slice(commaPos, f.pos)
        f.truncateOutput(commaMark)
        f.recordRemoval(commaPos, removed, '移除尾逗号')
        f.replayWhitespace(commaPos + 1, f.pos)
      }
      f.take()
      return
    }
    if (commaState === 'needed') f.insert(',', '补全逗号')
    commaState = null

    if (open === '{') {
      parseMember(f, depth)
    } else {
      parseValue(f, depth + 1)
    }

    f.skipWsAndComments()
    const next = f.peek()
    if (next === undefined) {
      f.fail(`缺少逗号或右${close === '}' ? '花括号（}）' : '方括号（]）'}（输入意外结束）`)
    }
    if (next === ',') {
      commaMark = f.outLength
      commaPos = f.pos
      f.pushText(',')
      f.pos += 1
      commaState = 'emitted'
    } else if (next !== close) {
      commaState = 'needed'
    }
  }
}

function parseMember(f: Fixer, depth: number): void {
  f.skipWsAndComments()
  const keyCh = f.peek()
  if (keyCh === '"') {
    f.parseString('"')
  } else if (keyCh === "'" || keyCh === '“' || keyCh === '‘') {
    f.parseString(keyCh)
  } else if (keyCh !== undefined && IDENT_START.test(keyCh)) {
    const from = f.pos
    const name = readWord(f)
    f.replace(from, JSON.stringify(name), '键名补引号')
  } else {
    f.fail('意外的字符（期望属性名）')
  }
  f.skipWsAndComments()
  if (f.peek() !== ':') {
    f.insert(':', '补全冒号')
  } else {
    f.take()
  }
  parseValue(f, depth + 1)
}

function parseValue(f: Fixer, depth: number): void {
  if (depth > MAX_DEPTH) throw new RepairFail('嵌套过深，放弃修复', f.pos)
  f.skipWsAndComments()
  const ch = f.peek()
  if (ch === undefined) f.fail('缺少 JSON 值（输入意外结束）')

  if (ch === '{') {
    parseContainer(f, '{', depth)
    return
  }
  if (ch === '[') {
    parseContainer(f, '[', depth)
    return
  }
  if (ch === '"') {
    f.parseString('"')
    return
  }
  if (ch === "'" || ch === '“' || ch === '‘') {
    f.parseString(ch)
    return
  }
  if (ch === 'N') {
    if (!f.src.startsWith('NaN', f.pos)) f.fail(`意外的字符 “${ch}”`)
    f.pos += 3
    f.replace(f.pos - 3, 'null', 'NaN → null')
    return
  }
  if (ch === 'I' || ch === '+' || (ch === '-' && f.src.startsWith('-Infinity', f.pos))) {
    const word = ch === '+' ? '+Infinity' : ch === '-' ? '-Infinity' : 'Infinity'
    if (!f.src.startsWith(word, f.pos)) {
      if (ch === '-') {
        f.parseNumber()
        return
      }
      f.fail(`意外的字符 “${ch}”`)
    }
    f.pos += word.length
    f.replace(f.pos - word.length, 'null', 'Infinity → null')
    return
  }
  if (ch === '-' || (ch >= '0' && ch <= '9')) {
    f.parseNumber()
    return
  }
  if (ch === 't' && f.src.startsWith('true', f.pos)) {
    f.take(4)
    return
  }
  if (ch === 'f' && f.src.startsWith('false', f.pos)) {
    f.take(5)
    return
  }
  if (ch === 'n' && f.src.startsWith('null', f.pos)) {
    f.take(4)
    return
  }
  f.fail(`意外的字符 “${ch}”`)
}

function readWord(f: Fixer): string {
  const from = f.pos
  while (f.peek() !== undefined && IDENT_PART.test(f.peek()!)) f.pos += 1
  const word = f.src.slice(from, f.pos)
  if (word === '') f.fail('意外的字符（期望属性名）')
  return word
}
