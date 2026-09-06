import { describe, expect, it } from 'vitest'

import { locateJsonError } from './locate'

describe('locateJsonError（补测，契约见 docs/adr/0002）', () => {
  it('缺逗号定位到准确行列', () => {
    const location = locateJsonError('{\n  "a": 1\n  "b": 2\n}')
    expect(location).toEqual({ line: 3, column: 3, message: expect.any(String) })
  })

  it('未闭合字符串定位', () => {
    const location = locateJsonError('{"key": "value}')
    expect(location?.line).toBe(1)
    expect(location?.column).toBe(16)
  })

  it('非法转义定位', () => {
    const location = locateJsonError('"\\x41"')
    expect(location?.column).toBe(3)
  })

  it('末尾多余内容定位', () => {
    const location = locateJsonError('{} {}')
    expect(location?.column).toBe(4)
  })

  it('深度超护栏主动放弃（返回 null 不误报）', () => {
    const deep = `${'['.repeat(10_001)}${']'.repeat(10_001)}`
    expect(locateJsonError(deep)).toBeNull()
  })

  it('合法 JSON 一律返回 null（零误报）', () => {
    const cases = [
      '{"a\\u0000b": [1e10, -2.5, true, null], "😀": "emoji"}',
      '""',
      '0',
      '"转义\\"引号\\u4e2d"',
    ]
    for (const text of cases) {
      expect(locateJsonError(text)).toBeNull()
    }
  })
})
