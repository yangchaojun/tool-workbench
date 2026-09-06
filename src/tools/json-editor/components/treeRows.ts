/**
 * 树形视图的扁平化：把递归结构展开为一维行数组，供虚拟滚动（NVirtualList）渲染。
 * 只展开视口语义上可见的行——折叠的容器不产生子行（ADR-0005：渲染层虚拟化）。
 */

import { jsonValueType } from './treeTypes'
import type { JsonValueType } from './treeTypes'
import { pathKey } from './treeState'
import type { JsonPath } from '../editor/mutations'

export interface TreeRow {
  /** 虚拟列表 key（node 行 = pathKey，闭合/空行带后缀） */
  key: string
  type: 'node' | 'close' | 'empty'
  path: JsonPath
  /** 键名 / 数组索引；根为「(根)」，闭合行为括号 */
  name: string
  value: unknown
  depth: number
  /** 父容器是否数组（子项显示索引而非引号键名） */
  parentIsArray: boolean
  kind: JsonValueType
  isContainer: boolean
  /** 容器行：是否处于展开状态 */
  open: boolean
  /** 容器行的子项数量 */
  childCount: number
}

const CLOSE_SUFFIX = '\u0000close'
const EMPTY_SUFFIX = '\u0000empty'

export type IsOpen = (path: JsonPath, depth: number) => boolean

function childEntries(value: unknown, kind: JsonValueType): Array<[string, unknown]> {
  if (kind === 'array') return (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
  if (kind === 'object') return Object.entries(value as Record<string, unknown>)
  return []
}

/**
 * 扁平化整棵树。isOpen 决定每个容器的展开态（与 treeState 的展开记忆一致）。
 * 根名默认「(根)」。
 */
export function flattenTree(data: unknown, isOpen: IsOpen, rootName = '(根)'): TreeRow[] {
  const rows: TreeRow[] = []
  walk(data, [], rootName, 0, false)
  return rows

  function walk(value: unknown, path: JsonPath, name: string, depth: number, parentIsArray: boolean): void {
    const kind = jsonValueType(value)
    const isContainer = kind === 'object' || kind === 'array'
    const open = isContainer && isOpen(path, depth)
    const key = pathKey(path)
    rows.push({
      key,
      type: 'node',
      path,
      name,
      value,
      depth,
      parentIsArray,
      kind,
      isContainer,
      open,
      childCount: isContainer ? childEntries(value, kind).length : 0,
    })
    if (!open) return
    const children = childEntries(value, kind)
    if (children.length === 0) {
      rows.push({
        key: key + EMPTY_SUFFIX,
        type: 'empty',
        path,
        name: kind === 'array' ? '空数组' : '空对象',
        value: undefined,
        depth: depth + 1,
        parentIsArray: false,
        kind: 'null',
        isContainer: false,
        open: false,
        childCount: 0,
      })
      return
    }
    const childIsArray = kind === 'array'
    for (const [childKey, childValue] of children) {
      walk(childValue, [...path, childKey], childKey, depth + 1, childIsArray)
    }
    rows.push({
      key: key + CLOSE_SUFFIX,
      type: 'close',
      path,
      name: kind === 'array' ? ']' : '}',
      value: undefined,
      depth,
      parentIsArray,
      kind,
      isContainer: true,
      open: true,
      childCount: children.length,
    })
  }
}
