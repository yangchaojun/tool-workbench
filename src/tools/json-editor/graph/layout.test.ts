import { describe, expect, it } from 'vitest'

import { buildGraph, graphNodeId } from './buildGraph'
import {
  GRAPH_PADDING,
  layoutGraph,
  NODE_SEP,
  NODE_WIDTH,
  RANK_SEP,
  ROW_H,
  TABLE_COL,
  TABLE_INDEX_COL,
  nodeWidth,
} from './layout'

const allIds = (data: unknown) => {
  const ids = new Set<string>()
  const walk = (value: unknown, path: string[]) => {
    if (value === null || typeof value !== 'object') return
    ids.add(graphNodeId(path))
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, [...path, String(i)]))
    else for (const [k, v] of Object.entries(value)) walk(v, [...path, k])
  }
  walk(data, [])
  return ids
}

describe('layoutGraph', () => {
  it('仅根卡片：落在画布内边距处', () => {
    const graph = buildGraph({ a: 1 }, new Set())
    const positions = layoutGraph(graph.nodes)
    expect(positions.get(graphNodeId([]))).toEqual({ x: GRAPH_PADDING, y: GRAPH_PADDING })
  })

  it('x 按层级等距；首个子卡片对齐父卡片顶部', () => {
    const doc = { a: { x: 1 }, b: { y: 2 } }
    const graph = buildGraph(doc, allIds(doc))
    const positions = layoutGraph(graph.nodes)
    const root = positions.get(graphNodeId([]))!
    const a = positions.get(graphNodeId(['a']))!
    expect(a.x).toBe(root.x + NODE_WIDTH + RANK_SEP)
    expect(a.y).toBe(root.y)
  })

  it('后续子卡片不与前面子树重叠，且不低于自己的行顶', () => {
    const doc = { a: { x: 1 }, mid: 0, b: { y: 2 } }
    const graph = buildGraph(doc, allIds(doc))
    const positions = layoutGraph(graph.nodes)
    const a = positions.get(graphNodeId(['a']))!
    const b = positions.get(graphNodeId(['b']))!
    // a 子树占 1 行卡片 + 间距；b 的行顶在 top + 2×ROW_H（第 3 行），二者取大
    expect(b.y).toBeGreaterThanOrEqual(a.y + ROW_H + NODE_SEP)
    expect(b.y).toBeGreaterThanOrEqual(GRAPH_PADDING + 2 * ROW_H)
  })

  it('同一父卡片的子树纵向单调（构造上不交叉）', () => {
    const doc = { a: { deep: { deeper: 1 } }, mid: 0, b: { y: 2 } }
    const graph = buildGraph(doc, allIds(doc))
    const positions = layoutGraph(graph.nodes)
    const aY = positions.get(graphNodeId(['a']))!.y
    const deepY = positions.get(graphNodeId(['a', 'deep']))!.y
    const bY = positions.get(graphNodeId(['b']))!.y
    expect(deepY).toBeGreaterThanOrEqual(aY)
    expect(bY).toBeGreaterThan(deepY)
  })

  it('表格节点宽度 = 索引列 + 数据列；所在层步进取该层最宽节点', () => {
    const doc = { rows: [{ h1: 11, h2: 12, h3: 13 }], plain: { inner: { a: 1 } } }
    const graph = buildGraph(doc, allIds(doc))
    const rowsNode = graph.nodes.find((n) => n.id === graphNodeId(['rows']))!
    const plainNode = graph.nodes.find((n) => n.id === graphNodeId(['plain']))!
    expect(nodeWidth(rowsNode)).toBe(TABLE_INDEX_COL + 3 * TABLE_COL)
    expect(nodeWidth(plainNode)).toBe(NODE_WIDTH)

    const positions = layoutGraph(graph.nodes)
    // 同层等 x；下一层 x 由该层最宽节点（表格 392 > 卡片 280）决定
    expect(positions.get(graphNodeId(['rows']))!.x).toBe(positions.get(graphNodeId(['plain']))!.x)
    const inner = positions.get(graphNodeId(['plain', 'inner']))!
    expect(inner.x).toBe(GRAPH_PADDING + NODE_WIDTH + RANK_SEP + nodeWidth(rowsNode) + RANK_SEP)
  })
})
