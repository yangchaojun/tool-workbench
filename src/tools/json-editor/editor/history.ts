/**
 * 统一历史栈（见 ADR-0003）：文本编辑与树形编辑共享的撤销/重做序列。
 *
 * 模型是「改动前快照」：每次提交改动前把改动前的状态压入 past；
 * undo 用当前状态换回上一个快照。连续文本键入（同 kind 且落在合并窗口内）
 * 不重复压栈，即一段连续输入只算一个历史条目。
 */

export interface EditorSnapshot {
  /** 文本视图内容 */
  text: string
  /** 数据源；文本尚未通过校验时为上一次合法数据或 undefined */
  data: unknown
}

export type HistoryKind = 'text' | 'tree' | 'action'

export const HISTORY_CAP = 100
/** 连续文本键入的合并窗口（毫秒） */
export const TEXT_COALESCE_MS = 800

export class HistoryStack {
  private past: EditorSnapshot[] = []
  private future: EditorSnapshot[] = []
  private lastKind: HistoryKind | null = null
  private lastPushAt = 0
  /** 变更计数器：store 借它让 canUndo/canRedo 保持响应式 */
  version = 0

  constructor(
    private readonly cap: number = HISTORY_CAP,
    private readonly coalesceMs: number = TEXT_COALESCE_MS,
  ) {}

  /** 提交一次改动：prev 是改动前的状态 */
  push(prev: EditorSnapshot, kind: HistoryKind, now: number = Date.now()): void {
    const coalesce =
      kind === 'text' && this.lastKind === 'text' && now - this.lastPushAt < this.coalesceMs
    if (!coalesce) {
      this.past.push(prev)
      if (this.past.length > this.cap) this.past.shift()
    }
    this.future = []
    this.lastKind = kind
    this.lastPushAt = now
    this.version += 1
  }

  /** 回退：current 是撤销前的状态；无路可退返回 null */
  undo(current: EditorSnapshot): EditorSnapshot | null {
    const prev = this.past.pop()
    if (prev === undefined) return null
    this.future.push(current)
    this.lastKind = null
    this.version += 1
    return prev
  }

  /** 重做：current 是重做前的状态；无路可进返回 null */
  redo(current: EditorSnapshot): EditorSnapshot | null {
    const next = this.future.pop()
    if (next === undefined) return null
    this.past.push(current)
    this.lastKind = null
    this.version += 1
    return next
  }

  clear(): void {
    this.past = []
    this.future = []
    this.lastKind = null
    this.version += 1
  }

  hasPast(): boolean {
    return this.past.length > 0
  }

  hasFuture(): boolean {
    return this.future.length > 0
  }
}
