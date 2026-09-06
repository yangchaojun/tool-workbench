/**
 * 树形编辑的不可变数据操作（纯函数，见 ADR-0003）。
 *
 * 路径用 `string[]` 表示：对象属性为键名，数组元素为十进制索引字符串。
 * 所有操作沿路径浅拷贝父链（结构共享），绝不在原数据上就地修改——
 * 这保证历史栈里的旧快照永远不被后续编辑污染。
 */

export type JsonPath = readonly string[]

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getAtPath(data: unknown, path: JsonPath): unknown {
  let current = data
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

interface CopiedChain {
  /** 直接父容器的浅拷贝——对它写入 lastKey 即完成修改 */
  parent: Record<string, unknown> | unknown[]
  lastKey: string
  /** 最外层新根：parent 的修改已经挂在这条新链上 */
  root: unknown
}

/**
 * 沿 path 的父链逐层浅拷贝，返回「直接父容器副本 + 待写键名 + 新根」。
 * path 为空或父链中途断裂时返回 null。
 */
function copyParentChain(data: unknown, path: JsonPath): CopiedChain | null {
  if (path.length === 0) return null
  const lastKey = path[path.length - 1]
  const parentPath = path.slice(0, -1)

  let current: unknown = data
  const ancestors: Array<{ node: Record<string, unknown> | unknown[]; key: string }> = []
  for (const key of parentPath) {
    if (current === null || typeof current !== 'object') return null
    ancestors.push({ node: current as Record<string, unknown>, key })
    current = (current as Record<string, unknown>)[key]
  }
  if (current === null || typeof current !== 'object') return null

  const clone = (node: unknown): Record<string, unknown> | unknown[] =>
    Array.isArray(node) ? [...node] : { ...(node as Record<string, unknown>) }

  let deepest = clone(current)
  let deeper = deepest
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const { node, key } = ancestors[i]
    const parentCopy = clone(node)
    ;(parentCopy as Record<string, unknown>)[key] = deeper
    deeper = parentCopy
  }
  return { parent: deepest, lastKey, root: deeper }
}

/** 替换路径上的值；path 为空时整体替换根。返回新数据 */
export function setAtPath(data: unknown, path: JsonPath, value: unknown): unknown {
  if (path.length === 0) return value
  const copied = copyParentChain(data, path)
  if (copied === null) return data
  ;(copied.parent as Record<string, unknown>)[copied.lastKey] = value
  return copied.root
}

/** 删除路径上的节点；path 为空表示删除根（返回 undefined） */
export function removeAtPath(data: unknown, path: JsonPath): unknown {
  if (path.length === 0) return undefined
  const copied = copyParentChain(data, path)
  if (copied === null) return data
  if (Array.isArray(copied.parent)) {
    const index = Number(copied.lastKey)
    if (!Number.isInteger(index)) return data
    copied.parent.splice(index, 1)
  } else {
    delete (copied.parent as Record<string, unknown>)[copied.lastKey]
  }
  return copied.root
}

function uniqueKey(obj: Record<string, unknown>, base: string): string {
  if (!(base in obj)) return base
  for (let n = 2; ; n += 1) {
    const key = `${base}-${n}`
    if (!(key in obj)) return key
  }
}

/** 在对象容器里生成不冲突的键名 */
export function nextObjectKey(obj: Record<string, unknown>): string {
  return uniqueKey(obj, 'newKey')
}

export interface MovePlan {
  from: JsonPath
  /** 目标父容器路径；目标容器不能是被移动节点自身或其子孙 */
  toParent: JsonPath
  /** 插入位置（目标父容器内的序号）；对象容器同样按插入顺序 */
  index: number
  /** 对象容器用：目标键名；缺省沿用原键名，冲突时自动加后缀 */
  key?: string
}

export interface MoveResult {
  data: unknown
  /** 移动后节点的新路径 */
  path: JsonPath
}

function isDescendant(path: JsonPath, maybeAncestor: JsonPath): boolean {
  return (
    path.length > maybeAncestor.length &&
    maybeAncestor.every((seg, i) => seg === path[i])
  )
}

/**
 * 移动（重排）节点：支持同容器排序与跨容器移动。
 * 无法移动（移根 / 移进自己的子树 / 目标不是容器）返回 null，调用方回退不动作。
 */
export function moveNode(data: unknown, plan: MovePlan): MoveResult | null {
  const { from, toParent, index } = plan
  if (from.length === 0) return null
  if (isDescendant(toParent, from)) return null // 不能移进自己的子树
  const movedKey = from[from.length - 1]
  const value = getAtPath(data, from)
  if (value === undefined) return null

  // 1. 摘出节点
  const removed = removeAtPath(data, from)

  // 2. 同容器内前移时，移除原元素使插入序号左移一位
  const sameParent =
    from.length === toParent.length + 1 &&
    from.slice(0, -1).every((seg, i) => seg === toParent[i])
  let targetIndex = index
  if (sameParent) {
    const fromIndex = Number(movedKey)
    if (Number.isInteger(fromIndex) && fromIndex < index) targetIndex = index - 1
  }

  // 3. 插入目标容器（整体重建容器，保持其余元素原序）
  const targetValue = getAtPath(removed, toParent)
  if (targetValue === null || typeof targetValue !== 'object') return null

  if (Array.isArray(targetValue)) {
    const clamped = Math.max(0, Math.min(targetIndex, targetValue.length))
    const next = [...targetValue]
    next.splice(clamped, 0, value)
    return { data: setAtPath(removed, toParent, next), path: [...toParent, String(clamped)] }
  }

  if (isRecord(targetValue)) {
    const desiredKey = uniqueKey(targetValue, plan.key ?? movedKey)
    const entries = Object.entries(targetValue)
    const clamped = Math.max(0, Math.min(targetIndex, entries.length))
    entries.splice(clamped, 0, [desiredKey, value])
    return {
      data: setAtPath(removed, toParent, Object.fromEntries(entries)),
      path: [...toParent, desiredKey],
    }
  }
  return null
}

function compareKeys(a: string, b: string): number {
  return a.localeCompare(b, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' })
}

/**
 * 对象键改名（保持原位置）。目标键已存在时返回 null（由调用方提示冲突）。
 */
export function renameKey(
  data: unknown,
  path: JsonPath,
  newKey: string,
): { data: unknown; path: JsonPath } | null {
  if (path.length === 0) return null
  if (newKey === '') return null
  const parentPath = path.slice(0, -1)
  const oldKey = path[path.length - 1]
  if (newKey === oldKey) return null
  const parent = getAtPath(data, parentPath)
  if (!isRecord(parent)) return null
  if (newKey in parent) return null

  const entries = Object.entries(parent).map(([k, v]) =>
    k === oldKey ? [newKey, v] : [k, v],
  )
  return { data: setAtPath(data, parentPath, Object.fromEntries(entries)), path: [...parentPath, newKey] }
}

/**
 * 对象按键名排序（自然序：数字后缀按数值比较）。数组不参与（数组保持原序，
 * 递归模式只递归进数组元素继续找对象）。
 */
export function sortObjectKeys(data: unknown, path: JsonPath, recursive: boolean): unknown {
  function sortValue(value: unknown): unknown {
    if (Array.isArray(value)) return recursive ? value.map(sortValue) : value
    if (!isRecord(value)) return value
    const rebuilt: Record<string, unknown> = {}
    for (const key of [...Object.keys(value)].sort(compareKeys)) {
      rebuilt[key] = recursive ? sortValue(value[key]) : value[key]
    }
    return rebuilt
  }

  if (!isRecord(getAtPath(data, path))) return data
  return setAtPath(data, path, sortValue(getAtPath(data, path)))
}
