/**
 * 图谱布局：LR 整齐树布局。JSON 结构是严格单亲树，无需通用图布局——
 * 子树按文档顺序纵向堆叠、尽量对齐父卡片中自己的行（重叠则整体下移），
 * 同一父卡片的行序与子卡顺序单调一致，连线在构造上不交叉；x 按层级等距。
 * 卡片宽度固定、高度按行数估算（卡片渲染严格行高制，估算值 = 实际值）。
 */

import { graphNodeId } from './buildGraph'
import type { GraphNodeModel } from './buildGraph'

/** 卡片宽度（px），也是 MiniMap / 布局的唯一宽度源 */
export const NODE_WIDTH = 280
/** 卡片行高（px）：GraphNodeCard 的行渲染必须与此一致 */
export const ROW_H = 28
/** 层间距 / 同层子树间距（px） */
export const RANK_SEP = 90
export const NODE_SEP = 28
/** 画布内边距：布局结果外扩，避免贴边 */
export const GRAPH_PADDING = 40

/** 卡片高度 = 行数 × ROW_H（root-scalar 单行；空容器占位一行；截断含尾行） */
export function nodeHeight(node: GraphNodeModel): number {
  const rows =
    node.type === 'root-scalar'
      ? 1
      : node.entries.length === 0
        ? 1
        : node.entries.length + (node.truncatedRows ? 1 : 0)
  return rows * ROW_H
}

export interface GraphPosition {
  x: number
  y: number
}

/** 放置整棵树，返回每个节点的左上角坐标（nodes 由 buildGraph 按 DFS 序给出） */
export function layoutGraph(nodes: readonly GraphNodeModel[]): Map<string, GraphPosition> {
  const positions = new Map<string, GraphPosition>()
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const childrenOf = new Map<string, GraphNodeModel[]>()
  const roots: GraphNodeModel[] = []
  for (const node of nodes) {
    const parentId = node.path.length > 0 ? graphNodeId(node.path.slice(0, -1)) : null
    const parent = parentId !== null ? byId.get(parentId) : undefined
    if (parent === undefined) {
      roots.push(node)
    } else {
      const siblings = childrenOf.get(parent.id)
      if (siblings === undefined) childrenOf.set(parent.id, [node])
      else siblings.push(node)
    }
  }

  for (const root of roots) place(root, GRAPH_PADDING, 0)
  return positions

  /** 放置 node 及其子树（top = 卡片顶部 y），返回子树总高度 */
  function place(node: GraphNodeModel, top: number, depth: number): number {
    positions.set(node.id, { x: GRAPH_PADDING + depth * (NODE_WIDTH + RANK_SEP), y: top })
    const cardHeight = nodeHeight(node)
    const children = childrenOf.get(node.id) ?? []
    if (children.length === 0) return cardHeight

    let cursor = top // 下一个子树的可用起点（前一个子树底部 + 间距）
    let bottom = top + cardHeight
    for (const child of children) {
      const key = child.path.at(-1) ?? ''
      const rowIndex = node.entries.findIndex((entry) => entry.key === key)
      // 目标：对齐自己在父卡片中的行顶部；与前面的子树重叠则下移到可用位置
      const rowTop = top + ROW_H * Math.max(rowIndex, 0)
      const childTop = Math.max(rowTop, cursor)
      const childHeight = place(child, childTop, depth + 1)
      cursor = childTop + childHeight + NODE_SEP
      bottom = Math.max(bottom, childTop + childHeight)
    }
    return bottom - top
  }
}
