import { describe, expect, it } from 'vitest'

import { diffJson, diffStats } from './diff'

describe('diffJson', () => {
  it('完全相等 → equal 无子差异', () => {
    const a = { x: 1, list: [1, 2] }
    const node = diffJson(a, structuredClone(a))
    expect(node.status).toBe('equal')
    expect(node.children.every((c) => c.status === 'equal')).toBe(true)
  })

  it('基本类型值差异', () => {
    const node = diffJson('a', 'b')
    expect(node.status).toBe('changed')
    expect(node.typeChanged).toBe(false)
  })

  it('类型差异标记 typeChanged', () => {
    const node = diffJson(1, '1')
    expect(node.status).toBe('changed')
    expect(node.typeChanged).toBe(true)
    expect(node.leftType).toBe('number')
    expect(node.rightType).toBe('string')
  })

  it('对象：新增 / 删除 / 修改', () => {
    const node = diffJson({ a: 1, b: 2, c: 3 }, { a: 1, b: 20, d: 4 })
    const byKey = new Map(node.children.map((c) => [c.key, c]))
    expect(byKey.get('a')?.status).toBe('equal')
    expect(byKey.get('b')?.status).toBe('changed')
    expect(byKey.get('c')?.status).toBe('removed')
    expect(byKey.get('d')?.status).toBe('added')
  })

  it('数组按索引严格对齐、顺序敏感', () => {
    const node = diffJson([1, 2, 3], [1, 3, 2])
    expect(node.children[0]?.status).toBe('equal')
    expect(node.children[1]?.status).toBe('changed')
    expect(node.children[2]?.status).toBe('changed')
  })

  it('数组长度差异产出 removed / added 尾项', () => {
    const node = diffJson([1, 2, 3], [1])
    expect(node.children[1]?.status).toBe('removed')
    expect(node.children[2]?.status).toBe('removed')
  })

  it('容器含差异时容器自身标 changed，但 typeChanged 为 false', () => {
    const node = diffJson({ a: { x: 1 } }, { a: { x: 2 } })
    expect(node.status).toBe('changed')
    expect(node.typeChanged).toBe(false)
    expect(node.children[0]?.status).toBe('changed')
  })
})

describe('diffStats', () => {
  it('只数叶子，容器差异下钻不重复计数', () => {
    const node = diffJson(
      { a: 1, b: { c: 2, d: 3 }, e: [1, 2] },
      { a: 9, b: { c: 2, f: 4 }, e: [1, 2, 5] },
    )
    const stats = diffStats(node)
    expect(stats).toEqual({ added: 2, removed: 1, changed: 1 })
  })

  it('新增/删除的子树整体记 1', () => {
    const node = diffJson({ a: { deep: { x: 1 } } }, {})
    expect(diffStats(node)).toEqual({ added: 0, removed: 1, changed: 0 })
  })

  it('类型变更记 changed 1 次', () => {
    const node = diffJson({ a: [1, 2] }, { a: 'x' })
    expect(diffStats(node)).toEqual({ added: 0, removed: 0, changed: 1 })
  })
})
