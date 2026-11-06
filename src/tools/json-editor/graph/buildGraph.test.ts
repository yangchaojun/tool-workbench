import { describe, expect, it } from 'vitest'

import {
  buildGraph,
  defaultExpandedIds,
  graphNodeId,
  scalarPreview,
  MAX_CARD_ROWS,
  MAX_GRAPH_NODES,
} from './buildGraph'

const ROOT = graphNodeId([])

/** 收集数据中全部容器路径的节点 id（测试辅助） */
function collectContainerPaths(value: unknown, path: string[], acc: Set<string>): void {
  if (value === null || typeof value !== 'object') return
  acc.add(graphNodeId(path))
  if (Array.isArray(value)) value.forEach((v, i) => collectContainerPaths(v, [...path, String(i)], acc))
  else for (const [k, v] of Object.entries(value)) collectContainerPaths(v, [...path, k], acc)
}

describe('scalarPreview', () => {
  it('string 带引号，超长截断', () => {
    expect(scalarPreview('hi')).toBe('"hi"')
    const long = 'x'.repeat(200)
    expect(scalarPreview(long)).toHaveLength(80)
    expect(scalarPreview(long).endsWith('…')).toBe(true)
  })
  it('number / boolean / null 直出', () => {
    expect(scalarPreview(42)).toBe('42')
    expect(scalarPreview(true)).toBe('true')
    expect(scalarPreview(null)).toBe('null')
  })
})

describe('defaultExpandedIds', () => {
  it('层级少于 5：收集全部容器 id（含根与空容器）', () => {
    const doc = { a: { b: { c: { d: 1 } } }, e: [], f: [{ g: 2 }] }
    const ids = defaultExpandedIds(doc)
    expect(ids.has(graphNodeId([]))).toBe(true)
    expect(ids.has(graphNodeId(['a']))).toBe(true)
    expect(ids.has(graphNodeId(['a', 'b']))).toBe(true)
    expect(ids.has(graphNodeId(['a', 'b', 'c']))).toBe(true)
    expect(ids.has(graphNodeId(['e']))).toBe(true)
    expect(ids.has(graphNodeId(['f']))).toBe(true)
    expect(ids.has(graphNodeId(['f', '0']))).toBe(true)
  })

  it('恰好 4 层容器：全展开', () => {
    const doc = { a: { b: { c: { d: 1 } } } }
    const ids = defaultExpandedIds(doc)
    expect(ids.has(graphNodeId(['a', 'b', 'c']))).toBe(true)
  })

  it('达到 5 层容器：整体回退为仅展开根', () => {
    const doc = { a: { b: { c: { d: { e: 1 } } } } }
    const ids = defaultExpandedIds(doc)
    expect(ids.has(graphNodeId([]))).toBe(true)
    expect(ids.has(graphNodeId(['a']))).toBe(false)
  })

  it('标量根：仅根 id（无实际节点）', () => {
    expect([...defaultExpandedIds(42)]).toEqual([graphNodeId([])])
  })

  it('容器数超出节点预算：截取至预算上限', () => {
    const doc = Object.fromEntries(
      Array.from({ length: MAX_GRAPH_NODES + 100 }, (_, i) => [`${i}`, { v: i }]),
    )
    expect(defaultExpandedIds(doc).size).toBe(MAX_GRAPH_NODES)
  })
})

describe('buildGraph', () => {
  it('未展开时只有根卡片，无边', () => {
    const graph = buildGraph({ a: 1, b: [1, 2] }, new Set())
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes[0]).toMatchObject({ id: ROOT, type: 'object', totalEntries: 2 })
    expect(graph.edges).toHaveLength(0)
    expect(graph.truncated).toBe(false)
  })

  it('展开容器行：生成子卡片与连线，entry.childId 指向子卡片', () => {
    const graph = buildGraph({ a: { b: 1 }, c: 2 }, new Set([graphNodeId(['a'])]))
    expect(graph.nodes.map((n) => n.id)).toEqual([ROOT, graphNodeId(['a'])])
    expect(graph.edges).toEqual([
      { id: `${ROOT}~${graphNodeId(['a'])}`, source: ROOT, target: graphNodeId(['a']) },
    ])
    const root = graph.nodes[0]
    expect(root.entries[0]).toMatchObject({ key: 'a', kind: 'container', childCount: 1, childId: graphNodeId(['a']) })
    expect(root.entries[1]).toMatchObject({ key: 'c', kind: 'number', value: '2', childId: null })
  })

  it('数组子项 key 为索引，计数徽标数据正确', () => {
    const graph = buildGraph({ list: ['x', 'y'] }, new Set([graphNodeId(['list'])]))
    const listNode = graph.nodes[1]
    expect(listNode.type).toBe('array')
    expect(listNode.entries.map((e) => e.key)).toEqual(['0', '1'])
    expect(graph.nodes[0].entries[0]).toMatchObject({ containerType: 'array', childCount: 2 })
  })

  it('空容器不生成子卡片（childId 保持 null）', () => {
    const graph = buildGraph({ a: {}, b: [] }, new Set([graphNodeId(['a']), graphNodeId(['b'])]))
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes[0].entries.map((e) => e.childCount)).toEqual([0, 0])
  })
  it('标量根：root-scalar 单卡片', () => {
    const graph = buildGraph(42, new Set())
    expect(graph.nodes[0]).toMatchObject({ type: 'root-scalar', scalarPreview: '42' })
    expect(graph.edges).toHaveLength(0)
  })

  it('嵌套展开：只渲染可达子树', () => {
    const doc = { a: { b: { c: 1 } } }
    const both = new Set([graphNodeId(['a']), graphNodeId(['a', 'b'])])
    const graph = buildGraph(doc, both)
    expect(graph.nodes.map((n) => n.id)).toEqual([ROOT, graphNodeId(['a']), graphNodeId(['a', 'b'])])
    expect(graph.nodes[2].entries[0]).toMatchObject({ key: 'c', value: '1' })
  })

  it('卡片行数超限：截断 + 尾行计数', () => {
    const big = Object.fromEntries(Array.from({ length: MAX_CARD_ROWS + 5 }, (_, i) => [`k${i}`, i]))
    const graph = buildGraph(big, new Set())
    expect(graph.nodes[0].entries).toHaveLength(MAX_CARD_ROWS)
    expect(graph.nodes[0].truncatedRows).toBe(true)
    expect(graph.nodes[0].totalEntries).toBe(MAX_CARD_ROWS + 5)
  })

  it('节点预算耗尽：truncated 置真且子树不再展开', () => {
    // 90 条 × 每条 12 层容器链，全量展开需要 1 + 90×12 = 1081 个节点，必超预算
    const doc: Record<string, unknown> = {}
    for (let i = 0; i < 90; i++) {
      let chain: unknown = { leaf: i }
      for (let d = 0; d < 11; d++) chain = { next: chain }
      doc[String(i)] = chain
    }
    const allIds = new Set<string>()
    collectContainerPaths(doc, [], allIds)
    const graph = buildGraph(doc, allIds)
    expect(graph.truncated).toBe(true)
    expect(graph.nodes.length).toBeLessThanOrEqual(MAX_GRAPH_NODES)
    // 仍在展开集合但预算耗尽的路径不再生成卡片，其行保持收起态
    const collapsed = graph.nodes.flatMap((n) => n.entries).filter((e) => e.childId === null)
    expect(collapsed.length).toBeGreaterThan(0)
  })
})
