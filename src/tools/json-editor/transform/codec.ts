/**
 * 转义 / 反转义 / Unicode 编解码（纯函数，语义见 CONTEXT.md）。
 * 转义 = 整段文本编码为一个 JSON 字符串字面量；反转义 = 字面量还原为内层文本；
 * Unicode 编解码 = \uXXXX 转义序列与原生字符互转，不含 Base64 / percent-encoding。
 */

/** 把整段文本编码为一个 JSON 字符串字面量（含首尾引号） */
export function escapeJsonText(text: string): string {
  return JSON.stringify(text)
}

/** 反转义输入不是合法字符串字面量时抛出（与解析失败区分） */
export class UnescapeTypeError extends Error {}

/** 把 JSON 字符串字面量还原为内层文本；不是合法字面量时抛出中文错误 */
export function unescapeJsonText(text: string): string {
  const trimmed = text.trim()
  try {
    const value: unknown = JSON.parse(trimmed)
    if (typeof value !== 'string') throw new UnescapeTypeError()
    return value
  } catch (error) {
    if (error instanceof UnescapeTypeError) {
      throw new Error('输入必须是 JSON 字符串字面量（以双引号包裹）')
    }
    throw new Error('不是合法的 JSON 字符串字面量（检查引号与转义是否完整）')
  }
}

/** \uXXXX 与原生字符互转的档位 */
export type UnicodeMode = 'all' | 'non-ascii'

/** 把文本中的字符编码为 \uXXXX 转义序列 */
export function unicodeEncode(text: string, mode: UnicodeMode): string {
  let result = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (mode === 'non-ascii' && code >= 0x20 && code <= 0x7e) {
      result += ch
      continue
    }
    // 代理对逐码点处理：先高位后低位，各产出 4 位十六进制
    if (code > 0xffff) {
      const high = Math.floor((code - 0x10000) / 0x400) + 0xd800
      const low = ((code - 0x10000) % 0x400) + 0xdc00
      result += `\\u${hex4(high)}\\u${hex4(low)}`
    } else {
      result += `\\u${hex4(code)}`
    }
  }
  return result
}

function hex4(code: number): string {
  return code.toString(16).padStart(4, '0')
}

/** 把 \uXXXX 转义序列还原为原生字符；无效序列原样保留 */
export function unicodeDecode(text: string): string {
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  )
}
