/** 树形视图的类型判定、标签与渲染护栏（docs 见 issues/tickets/011） */

/** 渲染护栏：无虚拟滚动下的过载保护；超出部分可点「显示全部」展开 */
export const CHILDREN_RENDER_CAP = 200
/** 深度护栏：超过即渲染为「停止展开」的叶子 */
export const DEPTH_RENDER_CAP = 200

export type JsonValueType =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'

/** JSON 值的类型判定（忠实呈现 JSON.parse 语义：null 不算对象） */
export function jsonValueType(value: unknown): JsonValueType {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  const t = typeof value
  if (t === 'object') return 'object'
  if (t === 'string' || t === 'number' || t === 'boolean') return t
  return 'null'
}

/** 类型标签：树节点徽标与根摘要共用 */
export const jsonValueTypeLabels: Record<JsonValueType, string> = {
  object: '对象',
  array: '数组',
  string: '字符串',
  number: '数字',
  boolean: '布尔',
  null: 'null',
}
