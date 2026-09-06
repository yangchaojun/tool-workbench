/**
 * 树形视图的会话内交互状态：按路径记忆的展开态、滚动定位、编辑会话、
 * 拖拽中的节点与落点提示、新增后自动编辑的路径。
 * 全部不持久化——刷新即回到「默认展开前 2 层」。
 */

import { reactive, ref } from 'vue'

import type { JsonValueType } from './treeTypes'
import type { JsonPath } from '../editor/mutations'

/** 路径 → 状态键（用不可见分隔符避免键名歧义） */
export function pathKey(path: JsonPath): string {
  return path.join('\u001f')
}

/** 路径 → 显式展开态；未记录的路径回落默认值（前 2 层展开） */
const explicit = reactive(new Map<string, boolean>())
/**
 * 展开态版本号：扁平化 computed 读它以保证重算。
 * 仅靠 Map 的 get 依赖不够——expandAll 会写入扁平化从未读过的深层路径，
 * reactive Map 的新键 ADD 不触发只读过其它键的 effect。
 */
export const expandVersion = ref(0)

function recordExpanded(path: JsonPath, open: boolean): void {
  explicit.set(pathKey(path), open)
  expandVersion.value += 1
}

export function isExpanded(path: JsonPath, depth: number): boolean {
  const recorded = explicit.get(pathKey(path))
  return recorded ?? depth < 2
}

export function setExpanded(path: JsonPath, open: boolean): void {
  recordExpanded(path, open)
}

export function toggleExpanded(path: JsonPath, depth: number): boolean {
  const next = !isExpanded(path, depth)
  recordExpanded(path, next)
  return next
}

/** 展开祖先链（定位场景） */
export function expandAncestors(path: JsonPath): void {
  for (let i = 1; i < path.length; i += 1) {
    recordExpanded(path.slice(0, i), true)
  }
}

export function collapseAll(): void {
  explicit.clear()
  expandVersion.value += 1
}

/** 收集全部容器路径（全部展开用） */
export function collectContainerPaths(
  data: unknown,
  path: JsonPath = [],
  out: JsonPath[] = [],
): JsonPath[] {
  if (data === null || typeof data !== 'object') return out
  out.push(path)
  if (Array.isArray(data)) {
    data.forEach((item, i) => collectContainerPaths(item, [...path, String(i)], out))
  } else {
    for (const [k, v] of Object.entries(data)) collectContainerPaths(v, [...path, k], out)
  }
  return out
}

export function expandAll(data: unknown): void {
  for (const p of collectContainerPaths(data)) explicit.set(pathKey(p), true)
  expandVersion.value += 1
}

// ── 滚动定位：由 TreeView 注册虚拟列表的按索引滚动 ────────────────

let scrollToHandler: ((path: JsonPath) => void) | null = null

export function setScrollToHandler(handler: ((path: JsonPath) => void) | null): void {
  scrollToHandler = handler
}

/** 定位到节点（TreeView 未挂载时为 no-op） */
export function scrollToNode(path: JsonPath): void {
  scrollToHandler?.(path)
}

// ── 就地编辑会话：存模块态，滚动导致行重挂载时编辑不丢失 ─────────

export interface TreeEditSession {
  path: JsonPath
  /** 编辑中的原键名（父为对象时可改名） */
  name: string
  type: JsonValueType
  text: string
  bool: boolean
  /** 表单内错误（数字格式/键名冲突），确认失败时填充 */
  error: string | null
}

export const treeEditSession = reactive<{ session: TreeEditSession | null }>({ session: null })

// ── 拖拽状态 ──────────────────────────────────────────────────────

export type DropMode = 'before' | 'after' | 'inside'

export const dragState = reactive({
  /** 正在拖拽的节点路径 */
  from: null as JsonPath | null,
  /** 落点提示：目标节点路径 + 相对位置 */
  target: null as { path: JsonPath; mode: DropMode } | null,
})

// ── 新增节点后自动进入编辑态的路径（一次性信号）────────────────

export const pendingEdit = reactive({
  path: null as JsonPath | null,
})
