/**
 * 结构化 JSON diff（纯函数）。语义约定（见 CONTEXT.md「对比」）：
 * 数组按索引严格对齐、顺序敏感；类型不同的值记为 changed（typeChanged）；
 * 新增/删除的子树整体记为一个节点，不再展开内部差异。
 */

import { jsonValueType, type JsonValueType } from '../components/treeTypes'

export type DiffStatus = 'equal' | 'added' | 'removed' | 'changed'

export interface DiffNode {
  /** 展示键：对象为属性名，数组为索引字符串，根为 (根) */
  key: string
  status: DiffStatus
  left: unknown
  right: unknown
  /** changed 时左右类型是否不同 */
  typeChanged: boolean
  /** 左右类型标签（changed 且类型不同时用于呈现） */
  leftType: JsonValueType | null
  rightType: JsonValueType | null
  children: DiffNode[]
}

export function diffJson(a: unknown, b: unknown, key = '(根)'): DiffNode {
  const typeA = jsonValueType(a)
  const typeB = jsonValueType(b)

  if (typeA !== typeB) {
    return {
      key,
      status: 'changed',
      left: a,
      right: b,
      typeChanged: true,
      leftType: typeA,
      rightType: typeB,
      children: [],
    }
  }

  if (typeA === 'object') {
    const left = a as Record<string, unknown>
    const right = b as Record<string, unknown>
    const children: DiffNode[] = []
    // 先按左侧键序走共同键，再补右侧独有键（保持与左侧一致的阅读顺序）
    for (const k of Object.keys(left)) {
      if (k in right) {
        children.push(diffJson(left[k], right[k], k))
      } else {
        children.push(leafNode(k, 'removed', left[k], undefined))
      }
    }
    for (const k of Object.keys(right)) {
      if (!(k in left)) {
        children.push(leafNode(k, 'added', undefined, right[k]))
      }
    }
    return containerNode(key, a, b, children)
  }

  if (typeA === 'array') {
    const left = a as unknown[]
    const right = b as unknown[]
    const children: DiffNode[] = []
    const shared = Math.min(left.length, right.length)
    for (let i = 0; i < shared; i += 1) {
      children.push(diffJson(left[i], right[i], String(i)))
    }
    for (let i = shared; i < left.length; i += 1) {
      children.push(leafNode(String(i), 'removed', left[i], undefined))
    }
    for (let i = shared; i < right.length; i += 1) {
      children.push(leafNode(String(i), 'added', undefined, right[i]))
    }
    return containerNode(key, a, b, children)
  }

  const equal = a === b
  return {
    key,
    status: equal ? 'equal' : 'changed',
    left: a,
    right: b,
    typeChanged: false,
    leftType: null,
    rightType: null,
    children: [],
  }
}

function leafNode(
  key: string,
  status: 'added' | 'removed',
  left: unknown,
  right: unknown,
): DiffNode {
  return {
    key,
    status,
    left,
    right,
    typeChanged: false,
    leftType: null,
    rightType: null,
    children: [],
  }
}

/** 容器节点：子节点全部 equal 则容器 equal，否则 changed（typeChanged 恒为 false） */
function containerNode(key: string, a: unknown, b: unknown, children: DiffNode[]): DiffNode {
  const status: DiffStatus = children.every((c) => c.status === 'equal') ? 'equal' : 'changed'
  return {
    key,
    status,
    left: a,
    right: b,
    typeChanged: false,
    leftType: null,
    rightType: null,
    children,
  }
}

export interface DiffStats {
  added: number
  removed: number
  changed: number
}

/**
 * 差异统计（只数叶子，避免容器与内部双重计数）：
 * 新增/删除的子树整体各记 1；类型变更记 1；
 * 同类型容器之间的差异下钻统计，容器自身不计。
 */
export function diffStats(node: DiffNode): DiffStats {
  const stats: DiffStats = { added: 0, removed: 0, changed: 0 }
  walkDiff(node, stats)
  return stats
}

function walkDiff(node: DiffNode, stats: DiffStats): void {
  for (const child of node.children) {
    if (child.status === 'added') {
      stats.added += 1
    } else if (child.status === 'removed') {
      stats.removed += 1
    } else if (child.status === 'changed') {
      // 同类型容器之间的差异下钻统计；类型变更或基本类型值差异就地计数
      if (!child.typeChanged && child.children.length > 0) walkDiff(child, stats)
      else stats.changed += 1
    } else if (child.children.length > 0) {
      walkDiff(child, stats)
    }
  }
}
