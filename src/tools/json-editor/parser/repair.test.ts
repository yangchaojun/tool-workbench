import { describe, expect, it } from 'vitest'

import { repairJson } from './repair'

function expectRepair(input: string, expected: unknown) {
  const result = repairJson(input)
  if (!result.ok) throw new Error(`应当修复成功：${result.reason}`)
  expect(JSON.parse(result.text)).toEqual(expected)
  return result
}

describe('repairJson', () => {
  it('输入已合法时拒绝修复', () => {
    const result = repairJson('{"a":1}')
    expect(result.ok).toBe(false)
  })

  it('修复尾逗号（对象）', () => {
    const { fixes } = expectRepair('{"a":1,}', { a: 1 })
    expect(fixes.some((f) => f.kind === '移除尾逗号')).toBe(true)
  })

  it('修复尾逗号（数组，多行场景行号正确）', () => {
    const { fixes, text } = expectRepair('[\n  1,\n  2,\n]', [1, 2])
    expect(text).toBe('[\n  1,\n  2\n]')
    expect(fixes[0]?.kind).toBe('移除尾逗号')
    expect(fixes[0]?.line).toBe(3)
  })

  it('修复单引号字符串与内部转义', () => {
    const { fixes } = expectRepair("{'name':'It\\'s \"ok\"'}", { name: `It's "ok"` })
    expect(fixes[0]?.kind).toBe('引号规范化')
  })

  it('修复中文引号字符串', () => {
    expectRepair('{“名”:“值”}', { 名: '值' })
  })

  it('修复无引号键', () => {
    const { fixes } = expectRepair('{a: 1, b_2: [true]}', { a: 1, b_2: [true] })
    expect(fixes.filter((f) => f.kind === '键名补引号')).toHaveLength(2)
  })

  it('移除行注释与块注释', () => {
    const { fixes } = expectRepair(
      '{\n  // 说明\n  "a": /* 内联 */ 1\n}',
      { a: 1 },
    )
    expect(fixes.filter((f) => f.kind === '移除注释').length).toBe(2)
  })

  it('NaN / Infinity → null', () => {
    expectRepair('{x: NaN, y: Infinity, z: -Infinity, w: +Infinity}', {
      x: null,
      y: null,
      z: null,
      w: null,
    })
  })

  it('移除末尾多余内容', () => {
    const { fixes } = expectRepair('{"a":1} 多余', { a: 1 })
    expect(fixes.some((f) => f.kind === '移除末尾多余内容')).toBe(true)
  })

  it('补全成员之间缺失的逗号', () => {
    const { fixes } = expectRepair('{"a":1\n"b":2}', { a: 1, b: 2 })
    expect(fixes.some((f) => f.kind === '补全逗号')).toBe(true)
  })

  it('补全元素之间缺失的逗号', () => {
    expectRepair('[1 2 3]', [1, 2, 3])
  })

  it('补全缺失的冒号', () => {
    const { fixes } = expectRepair('{"a" 1}', { a: 1 })
    expect(fixes.some((f) => f.kind === '补全冒号')).toBe(true)
  })

  it('组合错误一次修复', () => {
    expectRepair(
      `{
  // 用户列表
  users: [
    { name: '张三', age: NaN, },
    { name: “李四” tags: ['a', 'b',] }
  ]
}`,
      {
        users: [
          { name: '张三', age: null },
          { name: '李四', tags: ['a', 'b'] },
        ],
      },
    )
  })

  it('无法修复的错误类型如实失败（缺右括号）', () => {
    const result = repairJson('{"a":1')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('应当失败')
    expect(result.reason).toContain('无法自动修复')
  })

  it('修复后必须通过 JSON.parse（未通过时放弃）', () => {
    // 未转义控制字符属于字符串内部问题，修复器不处理
    const result = repairJson('{"a\x01":1}')
    expect(result.ok).toBe(false)
  })
})
