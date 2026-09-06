import { describe, expect, it } from 'vitest'

import { escapeJsonText, unicodeDecode, unicodeEncode, unescapeJsonText } from './codec'

describe('转义 / 反转义', () => {
  it('转义：整段文本变为字符串字面量', () => {
    expect(escapeJsonText('{"a":1}')).toBe('"{\\"a\\":1}"')
  })

  it('反转义：字面量还原内层文本', () => {
    expect(unescapeJsonText('"{\\"a\\":1}"')).toBe('{"a":1}')
  })

  it('反转义：非字符串字面量报错', () => {
    expect(() => unescapeJsonText('123')).toThrow('字符串字面量')
    expect(() => unescapeJsonText('"未闭合')).toThrow('字符串字面量')
  })
})

describe('Unicode 编解码', () => {
  it('编码：全部模式连 ASCII 也转', () => {
    expect(unicodeEncode('A中', 'all')).toBe('\\u0041\\u4e2d')
  })

  it('编码：仅非 ASCII 模式保留可打印 ASCII', () => {
    expect(unicodeEncode('a中b', 'non-ascii')).toBe('a\\u4e2db')
    // 控制字符仍转义
    expect(unicodeEncode('\n', 'non-ascii')).toBe('\\u000a')
  })

  it('编码：代理对（emoji）逐码位展开', () => {
    expect(unicodeEncode('😀', 'all')).toBe('\\ud83d\\ude00')
  })

  it('解码：\\uXXXX 还原', () => {
    expect(unicodeDecode('\\u4e2d\\u6587')).toBe('中文')
    expect(unicodeDecode('\\ud83d\\ude00')).toBe('😀')
  })

  it('解码：无效序列原样保留', () => {
    expect(unicodeDecode('\\u12g4 中文')).toBe('\\u12g4 中文')
  })

  it('编解码往返一致', () => {
    const text = 'Hello 世界 😀 "quotes"\n'
    expect(unicodeDecode(unicodeEncode(text, 'all'))).toBe(text)
  })
})
