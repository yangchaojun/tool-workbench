import { reactive } from 'vue'

import type { JsonPath } from '../editor/mutations'
import type { JsonValueType } from '../components/treeTypes'

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

export interface TreeSessionState {
  expanded: Map<string, boolean>
  expandVersion: number
  scrollToHandler: ((path: JsonPath) => void) | null
  editSession: TreeEditSession | null
  dragFrom: JsonPath | null
  dragTarget: { path: JsonPath; mode: 'before' | 'after' | 'inside' } | null
  pendingEdit: JsonPath | null
}

export function createTreeSessionState(): TreeSessionState {
  return reactive({
    expanded: new Map<string, boolean>(),
    expandVersion: 0,
    scrollToHandler: null,
    editSession: null,
    dragFrom: null,
    dragTarget: null,
    pendingEdit: null,
  })
}

export function clearTreeInteractions(state: TreeSessionState): void {
  state.scrollToHandler = null
  state.editSession = null
  state.dragFrom = null
  state.dragTarget = null
  state.pendingEdit = null
}
