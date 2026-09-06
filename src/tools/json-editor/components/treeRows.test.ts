import { describe, expect, it } from 'vitest'

import { flattenTree, type TreeRow } from './treeRows'
import { pathKey } from './treeState'
import type { JsonPath } from '../editor/mutations'

/** 只展开前 2 层（与树形视图默认行为一致） */
const defaultOpen = (_path: JsonPath, depth: number) => depth < 2
const noneOpen = () => false
const allOpen = () => true

const doc = {
  name: 'demo',
  tags: ['a', 'b'],
  meta: { created: 1, nested: { deep: true } },
}

function nodeRows(rows: TreeRow[]): TreeRow[] {
  return rows.filter((r) => r.type === 'node')
}

describe('flattenTree', () => {
  it('标量根只有一行 node', () => {
    const rows = flattenTree(42, allOpen)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'node', kind: 'number', depth: 0, open: false })
  })

  it('容器折叠时只有自身一行（open=false，无闭合行）', () => {
    const rows = flattenTree(doc, noneOpen)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'node', kind: 'object', open: false, childCount: 3 })
  })

  it('默认展开前 2 层：根与其子容器展开，孙层折叠；闭合行跟随', () => {
    const rows = flattenTree(doc, defaultOpen)
    const nodes = nodeRows(rows)
    // 根 + name + tags + a/b + meta + created + nested = 7 个可见节点
    expect(nodes.map((r) => r.path.join('.'))).toEqual([
      '',
      'name',
      'tags',
      'tags.0',
      'tags.1',
      'meta',
      'meta.created',
      'meta.nested',
    ])
    // tags、meta 与根对象展开后各有闭合行；nested 折叠（depth 2）不产生
    expect(rows.filter((r) => r.type === 'close')).toHaveLength(3)
    // nested 折叠（depth 2），不出现其子节点
    const nested = nodes.find((r) => r.path.join('.') === 'meta.nested')
    expect(nested?.open).toBe(false)
    expect(nested?.childCount).toBe(1)
  })

  it('数组子项 parentIsArray=true，对象子项为 false', () => {
    const rows = flattenTree(doc, defaultOpen)
    const tag = nodeRows(rows).find((r) => r.path.join('.') === 'tags.0')
    const name = nodeRows(rows).find((r) => r.path.join('.') === 'name')
    expect(tag?.parentIsArray).toBe(true)
    expect(name?.parentIsArray).toBe(false)
  })

  it('展开的空容器产生 empty 行而非闭合行', () => {
    const rows = flattenTree({ empty: [], obj: {} }, allOpen)
    const empties = rows.filter((r) => r.type === 'empty')
    expect(empties).toHaveLength(2)
    expect(rows.filter((r) => r.type === 'close').map((r) => r.name)).toEqual(['}'])
  })

  it('所有行的 key 唯一（node/closed/empty 混合）', () => {
    const rows = flattenTree({ a: { b: [1, { c: 2 }] }, d: [] }, allOpen)
    const keys = rows.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('node 行 key 与 pathKey 一致（供定位/拖拽复用）', () => {
    const rows = flattenTree(doc, defaultOpen)
    const name = nodeRows(rows).find((r) => r.name === 'name')
    expect(name?.key).toBe(pathKey(['name']))
  })

  it('根节点名为「(根)」，数组根的子项 parentIsArray=true', () => {
    const rows = flattenTree([1, 2], defaultOpen)
    expect(rows[0].name).toBe('(根)')
    expect(nodeRows(rows).filter((r) => r.depth === 1).every((r) => r.parentIsArray)).toBe(true)
  })
})
