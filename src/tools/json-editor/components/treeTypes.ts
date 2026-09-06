/** 树形视图的类型判定与标签（渲染护栏已被虚拟滚动取代，见 ADR-0005） */

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
