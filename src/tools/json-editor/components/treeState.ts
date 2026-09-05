/**
 * 树形视图的会话内交互状态：按路径记忆的展开态、节点元素注册表
 * （查找定位/查询定位滚动用）、拖拽中的节点与落点提示。
 * 全部不持久化——刷新即回到「默认展开前 2 层」。
 */

import { reactive } from 'vue'

import type { JsonPath } from '../editor/mutations'

/** 路径 → 状态键（用不可见分隔符避免键名歧义） */
export function pathKey(path: JsonPath): string {
  return path.join('\u001f')
}

/** 路径 → 显式展开态；未记录的路径回落默认值（前 2 层展开） */
const explicit = reactive(new Map<string, boolean>())

export function isExpanded(path: JsonPath, depth: number): boolean {
  const recorded = explicit.get(pathKey(path))
  return recorded ?? depth < 2
}

export function setExpanded(path: JsonPath, open: boolean): void {
  explicit.set(pathKey(path), open)
}

export function toggleExpanded(path: JsonPath, depth: number): boolean {
  const next = !isExpanded(path, depth)
  setExpanded(path, next)
  return next
}

/** 展开祖先链（定位场景） */
export function expandAncestors(path: JsonPath): void {
  for (let i = 1; i < path.length; i += 1) {
    explicit.set(pathKey(path.slice(0, i)), true)
  }
}

export function collapseAll(): void {
  explicit.clear()
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
}

// ── 节点元素注册表：查找/查询定位时滚动到节点 ────────────────────

const nodeEls = new Map<string, HTMLElement>()

export function registerNodeEl(key: string, el: HTMLElement): void {
  nodeEls.set(key, el)
}

export function unregisterNodeEl(key: string): void {
  nodeEls.delete(key)
}

export function scrollToNode(path: JsonPath): void {
  const el = nodeEls.get(pathKey(path))
  if (!el) return
  // 只滚树内部滚动容器：scrollIntoView 会连带滚动 overflow-hidden 祖先
  // （hidden 容器可编程滚动），把整个面板滚出视野
  const scroller = el.closest('[data-tree-scroll]')
  if (scroller === null) {
    el.scrollIntoView({ block: 'center' })
    return
  }
  const viewport = scroller.getBoundingClientRect()
  const rect = el.getBoundingClientRect()
  const delta = rect.top + rect.height / 2 - (viewport.top + viewport.height / 2)
  scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: 'smooth' })
}

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
