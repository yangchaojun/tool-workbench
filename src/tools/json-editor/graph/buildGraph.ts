/**
 * 图谱视图的数据模型：把数据源转换为「卡片节点 + 连线」的图。
 * 节点 = 容器（对象/数组）；标量留在父卡片行内；容器行显示计数徽标，
 * 展开后才生成子卡片（懒展开）。规模护栏：单卡片行数与全图节点数双上限，
 * 超限截断并在 UI 提示（与 CONTEXT.md「软上限」同思路：警告但不崩溃）。
 */

import { pathKey } from '../components/treeState'
import type { JsonPath } from '../editor/mutations'

/** 单卡片最大行数（超出显示「还有 N 项」尾行） */
export const MAX_CARD_ROWS = 100
/** 全图最大节点数（展开预算，超出后禁止继续展开） */
export const MAX_GRAPH_NODES = 1000
/** 行内标量预览的最大字符数（与 TreeRow 的 preview 同为 80） */
export const SCALAR_MAX_CHARS = 80
/** 默认展开阈值：数据容器层级少于该值时默认全部展开，达到即回退为仅展开根 */
export const EXPAND_ALL_MAX_DEPTH = 5

export type GraphEntryKind = 'string' | 'number' | 'boolean' | 'null' | 'container'

export interface GraphEntry {
  /** 对象键名 / 数组索引 */
  key: string
  kind: GraphEntryKind
  /** 标量：与 TreeRow 同约定（string 带引号，超长截断）；容器为 null */
  value: string | null
  /** 容器类型；null 表示标量 */
  containerType: 'object' | 'array' | null
  /** 容器子项数量（计数徽标 {n} / [n]） */
  childCount: number
  /** 已展开：子卡片节点 id；未展开为 null——展开态由它唯一表达 */
  childId: string | null
}

export interface GraphNodeModel {
  id: string
  path: JsonPath
  type: 'object' | 'array' | 'root-scalar'
  /** root-scalar 的预览文本；容器节点为 null */
  scalarPreview: string | null
  /** 条目超出 MAX_CARD_ROWS：尾行展示真实数量 */
  truncatedRows: boolean
  /** 卡片实际条目数（截断前） */
  totalEntries: number
  entries: GraphEntry[]
}

export interface GraphEdgeModel {
  id: string
  source: string
  target: string
}

export interface GraphModel {
  nodes: GraphNodeModel[]
  edges: GraphEdgeModel[]
  /** 触及 MAX_GRAPH_NODES：图不完整，UI 提示并锁定展开 */
  truncated: boolean
}

/** 节点 id（pathKey([]) 为空串，加前缀避免 Vue Flow 出现空 id） */
export function graphNodeId(path: JsonPath): string {
  return `n:${pathKey(path)}`
}

/**
 * 默认展开集合：容器层级少于 EXPAND_ALL_MAX_DEPTH（少于 5 层）时收集全部容器 id
 * （含空容器，buildGraph 对其自然忽略）；达到阈值即整体回退为仅展开根。
 * 收集预算与节点预算一致（MAX_GRAPH_NODES）——多出的容器图上也放不下，
 * 耗尽后保留已收集部分，超出部分由 buildGraph 的截断提示交代。
 */
export function defaultExpandedIds(data: unknown): Set<string> {
  const rootOnly = new Set([graphNodeId([])])
  if (data === null || typeof data !== 'object') return rootOnly
  const ids = new Set<string>([graphNodeId([])])
  return collect(data, []) ? ids : rootOnly

  function collect(value: object, path: JsonPath): boolean {
    // path.length + 1 = 该容器的层级；触达第 EXPAND_ALL_MAX_DEPTH 层容器即判定层级超限
    if (path.length + 1 >= EXPAND_ALL_MAX_DEPTH) return false
    const children = Array.isArray(value)
      ? (value as unknown[]).map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>)
    for (const [key, child] of children) {
      if (child === null || typeof child !== 'object') continue
      if (ids.size >= MAX_GRAPH_NODES) return true
      const childPath = [...path, key]
      ids.add(graphNodeId(childPath))
      if (!collect(child, childPath)) return false
    }
    return true
  }
}

/** 标量预览：与 TreeRow 的 preview 同约定（string 带引号、超长截断） */
export function scalarPreview(value: unknown): string {
  if (typeof value === 'string') {
    const quoted = `"${value}"`
    return quoted.length > SCALAR_MAX_CHARS ? `${quoted.slice(0, SCALAR_MAX_CHARS - 1)}…` : quoted
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

/**
 * 构建图：从根开始沿 expandedIds 递归收集容器节点（DFS，根卡片总在第一位）。
 * 收起父卡片不移除后代 id——与 TreePane 一致，重新展开时恢复子树记忆。
 * 预算耗尽即停止递归并置 truncated：未渲染的展开行为收起态且点击无效。
 */
export function buildGraph(data: unknown, expandedIds: ReadonlySet<string>): GraphModel {
  const nodes: GraphNodeModel[] = []
  const edges: GraphEdgeModel[] = []
  let truncated = false

  if (data === null || typeof data !== 'object') {
    nodes.push({
      id: graphNodeId([]),
      path: [],
      type: 'root-scalar',
      scalarPreview: scalarPreview(data),
      truncatedRows: false,
      totalEntries: 0,
      entries: [],
    })
    return { nodes, edges, truncated }
  }

  walk(data, [])
  return { nodes, edges, truncated }

  function walk(value: object, path: JsonPath): void {
    const kind = Array.isArray(value) ? 'array' : 'object'
    const entriesRaw =
      kind === 'array'
        ? (value as unknown[]).map((v, i) => [String(i), v] as const)
        : Object.entries(value as Record<string, unknown>)
    const node: GraphNodeModel = {
      id: graphNodeId(path),
      path,
      type: kind,
      scalarPreview: null,
      truncatedRows: entriesRaw.length > MAX_CARD_ROWS,
      totalEntries: entriesRaw.length,
      entries: [],
    }
    nodes.push(node)

    for (const [key, child] of entriesRaw.slice(0, MAX_CARD_ROWS)) {
      if (child !== null && typeof child === 'object') {
        const childType = Array.isArray(child) ? ('array' as const) : ('object' as const)
        const childCount =
          childType === 'array' ? (child as unknown[]).length : Object.keys(child).length
        const entry: GraphEntry = {
          key,
          kind: 'container',
          value: null,
          containerType: childType,
          childCount,
          childId: null,
        }
        const childPath = [...path, key]
        if (childCount > 0 && expandedIds.has(graphNodeId(childPath))) {
          if (nodes.length < MAX_GRAPH_NODES) {
            // walk 首个动作就是 push 自身节点：index 处必为子卡片
            const index = nodes.length
            walk(child, childPath)
            entry.childId = nodes[index].id
            edges.push({ id: `${node.id}~${entry.childId}`, source: node.id, target: entry.childId })
          } else {
            // 想展开但预算耗尽：明确标记截断，让 UI 能解释「点不动」
            truncated = true
          }
        }
        node.entries.push(entry)
      } else {
        node.entries.push({
          key,
          kind: child === null ? 'null' : (typeof child as 'string' | 'number' | 'boolean'),
          value: scalarPreview(child),
          containerType: null,
          childCount: 0,
          childId: null,
        })
      }
    }
  }
}
