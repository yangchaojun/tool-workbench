/**
 * 图谱布局：dagre 层次布局（左→右），与 JSON Crack 同款视觉走向。
 * 卡片宽度固定、高度按行数估算（卡片渲染严格行高制，估算值 = 实际值），
 * 因此连线锚点（左右缘中点）与 dagre 给出的坐标一致。
 */

import dagre from '@dagrejs/dagre'

import type { GraphEdgeModel, GraphNodeModel } from './buildGraph'

/** 卡片宽度（px），也是 MiniMap / 布局的唯一宽度源 */
export const NODE_WIDTH = 280
/** 卡片行高（px）：GraphNodeCard 的行渲染必须与此一致 */
export const ROW_H = 28
/** 层间距 / 同层卡片间距（px） */
export const RANK_SEP = 90
export const NODE_SEP = 28
/** 画布内边距：dagre 结果外扩，避免贴边 */
export const GRAPH_PADDING = 40

/** 卡片高度 = 行数 × ROW_H（root-scalar 单行；空容器占位一行；截断含尾行） */
export function nodeHeight(node: GraphNodeModel): number {
  const rows =
    node.type === 'root-scalar' ? 1 : node.entries.length === 0 ? 1 : node.entries.length + (node.truncatedRows ? 1 : 0)
  return rows * ROW_H
}

export interface GraphPosition {
  x: number
  y: number
}

/**
 * 对图做层次布局，返回每个节点的左上角坐标。
 * 无边时（仅根卡片）也能工作：dagre 把孤立节点排在 rank 0。
 */
export function layoutGraph(
  nodes: readonly GraphNodeModel[],
  edges: readonly GraphEdgeModel[],
): Map<string, GraphPosition> {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({
    rankdir: 'LR',
    nodesep: NODE_SEP,
    ranksep: RANK_SEP,
    marginx: GRAPH_PADDING,
    marginy: GRAPH_PADDING,
  })
  graph.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: nodeHeight(node) })
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target)
  }
  dagre.layout(graph)

  const positions = new Map<string, GraphPosition>()
  for (const node of nodes) {
    const laid = graph.node(node.id)
    if (laid === undefined) continue
    // dagre 返回中心点坐标，转左上角
    positions.set(node.id, { x: laid.x - NODE_WIDTH / 2, y: laid.y - nodeHeight(node) / 2 })
  }
  return positions
}
