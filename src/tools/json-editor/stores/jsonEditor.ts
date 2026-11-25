import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'

import { loadZodJson, removeZodJson, saveZodJson } from '@/shared/storage/zodStorage'

import { locateJsonError } from '../parser/locate'
import type { JsonErrorLocation } from '../parser/locate'
import type { RepairFix } from '../parser/repair'
import { jsonEditorPersistSchema, nextTabName, nextUntitledTabName, persistedTabsWithinBudget } from '../schemas'
import type { MultiTabPersist, PersistedJsonTab } from '../schemas'
import { defaultExpandedIds } from '../graph/buildGraph'
import { clearTreeInteractions, createTreeSessionState, type TreeEditSession } from '../document/tabModel'
import {
  clearDocumentHistoryStorage,
  loadDocumentHistory,
  displayName,
  recordDocument,
  removeDocument,
  saveDocumentHistory,
  type DocumentHistoryEntry,
  type DocumentKind,
} from '../document/documentHistory'
import { HistoryStack, type EditorSnapshot } from '../editor/history'
import {
  getAtPath,
  moveNode,
  nextObjectKey,
  removeAtPath,
  renameKey,
  setAtPath,
  sortObjectKeys,
} from '../editor/mutations'
import type { JsonPath } from '../editor/mutations'

const PERSIST_KEY = 'tw:json-editor:input'
/** 旧查看器的持久化 key：一次性迁移到新 key 后删除 */
const LEGACY_PERSIST_KEY = 'tw:json-viewer:input'

// 软上限：超出即警告、暂停自动行为，但不阻止使用（见 CONTEXT.md「软上限」）
const SOFT_CAP_BYTES = 1024 * 1024
export const UPLOAD_CAP_BYTES = 20 * 1024 * 1024
/**
 * 树编辑降级阈值（ADR-0005 Consequences）：超过后树形编辑降级为只读。
 * 依实测定值——全量重序列化（2 空格 JSON.stringify，树编辑每次 O(n) 成本）：
 * 8MB ≈ 28ms、12MB ≈ 44ms、20MB ≈ 72ms（M 系列芯片参考机），8MB 为响应性上限。
 */
const TREE_EDIT_MAX_BYTES = 8 * 1024 * 1024
const AUTO_VALIDATE_DEBOUNCE_MS = 300
const MAX_TABS = 50

export type JsonParseResult =
  | { ok: true; data: unknown }
  | { ok: false; location: JsonErrorLocation | null; rawMessage: string }

export type OutputMode = 'format' | 'minify'
/** 顶层模式：编辑 / 对比 */
export type ToolMode = 'edit' | 'diff'

/** 文档历史条目的来源元信息（记录与恢复共用） */
export interface LoadMeta {
  kind: DocumentKind
  name: string | null
  url: string | null
}

interface JsonTab {
  id: string
  name: string
  input: string
  data: unknown
  result: JsonParseResult | null
  dataStale: boolean
  outputMode: OutputMode
  loadError: string | null
  copied: boolean
  copiedTimer: number | null
  repairCandidate: { text: string; fixes: RepairFix[] } | null
  pendingLoad: { text: string; label: string; meta: LoadMeta } | null
  tree: ReturnType<typeof createTreeSessionState>
  graphExpandedIds: ReadonlySet<string>
  graphUserTouched: boolean
  graphSelectedCellPath: JsonPath | null
  lastGraphData: unknown
  history: HistoryStack
  historyVersion: number
  lastSettled: EditorSnapshot
  validateTimer: number | null
  lastValidationFailed: boolean
  loadingUrl: boolean
}

const byteEncoder = new TextEncoder()

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function migrateLegacyKey(): void {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(PERSIST_KEY) !== null) return
  const legacy = localStorage.getItem(LEGACY_PERSIST_KEY)
  if (legacy === null) return
  localStorage.setItem(PERSIST_KEY, legacy)
  localStorage.removeItem(LEGACY_PERSIST_KEY)
}

function loadWorkspace(): MultiTabPersist {
  const fallback: MultiTabPersist = {
    version: 2,
    tabs: [{ id: createTabId(), name: nextUntitledTabName([]), input: '' }],
    activeTabId: '',
  }
  const persisted = loadZodJson(
    PERSIST_KEY,
    jsonEditorPersistSchema,
    jsonEditorPersistSchema.parse({}),
  )
  if ('input' in persisted) {
    const name = nextUntitledTabName([])
    const id = createTabId()
    return { version: 2, tabs: [{ id, name, input: persisted.input }], activeTabId: id }
  }

  const ids = new Set(persisted.tabs.map((tab) => tab.id))
  const tabs = persisted.tabs.filter((tab, index) => ids.delete(tab.id) && index < MAX_TABS)
  if (tabs.length === 0) return fallback
  const activeTabId = tabs.some((tab) => tab.id === persisted.activeTabId)
    ? persisted.activeTabId
    : tabs[0].id
  return { version: 2, tabs, activeTabId }
}

function createTabId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const useJsonEditorStore = defineStore('json-editor', () => {
  migrateLegacyKey()
  const workspace = loadWorkspace()

  // ── 状态 ──────────────────────────────────────────────────────
  const tabs = shallowRef<JsonTab[]>([])
  const activeTabId = ref('')
  /** 数据源：最近一次合法解析的数据（shallow，树形编辑直接作用于它，见 ADR-0003） */
  const data = shallowRef<unknown>(undefined)
  /** 最近一次校验结果；null 表示尚未校验（空输入或超限待手动） */
  const result = shallowRef<JsonParseResult | null>(null)
  /** 数据源是否已落后于文本（文本校验失败）——此时树只读 */
  const dataStale = ref(false)
  const mode = ref<ToolMode>('edit')
  const outputMode = ref<OutputMode>('format')
  /** 载入类错误（上传读取 / URL 拉取 / 响应非法），状态栏展示 */
  const loadError = ref<string | null>(null)
  const copied = ref(false)
  /** 修复预览的待应用候选（RepairModal 消费）；null 表示无进行中的修复 */
  const repairCandidate = ref<{ text: string; fixes: RepairFix[] } | null>(null)
  /** URL 拉取进行中（历史面板加载按钮的 loading 态） */
  const loadingUrl = ref(false)
  const tabLoadingUrls = ref<Record<string, boolean>>({})
  /** 每个标签自己的树/图谱会话状态。 */
  const treeState = ref<ReturnType<typeof createTreeSessionState>>(createTreeSessionState())
  const graphExpandedIds = ref<ReadonlySet<string>>(new Set())
  const graphUserTouched = ref(false)
  const graphSelectedCellPath = ref<JsonPath | null>(null)
  /**
   * 文档历史（CONTEXT.md「文档历史」，与统一历史栈无关）：
   * 仅显式载入动作自动记录，手动粘贴经显式保存记录。
   */
  const docHistory = ref<DocumentHistoryEntry[]>(loadDocumentHistory())
  /** 当前标签的输入非空且与目标内容不同时挂起，待用户确认覆盖。 */
  const pendingLoad = ref<{ text: string; label: string; meta: LoadMeta } | null>(null)

  const historyVersion = ref(0)
  const canUndo = computed(() => {
    void historyVersion.value
    return active?.history.hasPast() ?? false
  })
  const canRedo = computed(() => {
    void historyVersion.value
    return active?.history.hasFuture() ?? false
  })

  let validateTimer: number | null = null
  let active: JsonTab | null = null
  const input = ref('')
  let lastSettled: EditorSnapshot = { text: '', data: undefined }

  // ── 派生 ──────────────────────────────────────────────────────
  const activeTab = computed(() => tabs.value.find((tab) => tab.id === activeTabId.value) ?? null)
  const byteSize = computed(() => byteEncoder.encode(input.value).length)
  const overSoftCap = computed(() => byteSize.value > SOFT_CAP_BYTES)
  const hasData = computed(() => data.value !== undefined && !dataStale.value)
  /** 树编辑降级：超过阈值时树形编辑只读（ADR-0005，阈值实测见常量注释） */
  const treeEditReadonly = computed(() => byteSize.value > TREE_EDIT_MAX_BYTES)

  const formatted = computed<string | null>(() =>
    data.value === undefined ? null : JSON.stringify(data.value, null, 2),
  )
  const minified = computed<string | null>(() =>
    data.value === undefined ? null : JSON.stringify(data.value),
  )

  // ── 标签与会话状态 ────────────────────────────────────────────

  function makeTab(source: PersistedJsonTab): JsonTab {
    const history = new HistoryStack()
    const tree = createTreeSessionState()
    return {
      ...source,
      data: undefined,
      result: null,
      dataStale: false,
      outputMode: 'format',
      loadError: null,
      copied: false,
      copiedTimer: null,
      repairCandidate: null,
      pendingLoad: null,
      tree,
      graphExpandedIds: new Set(),
      graphUserTouched: false,
      graphSelectedCellPath: null,
      lastGraphData: undefined,
      history,
      historyVersion: 0,
      lastSettled: { text: source.input, data: undefined },
      validateTimer: null,
      lastValidationFailed: false,
      loadingUrl: false,
    }
  }

  function syncHistoryVersion() {
    if (active === null) return
    active.historyVersion = active.history.version
    historyVersion.value = active.history.version
  }

  function attachActiveTab() {
    active = activeTab.value
    if (active === null) return
    input.value = active.input
    data.value = active.data
    result.value = active.result
    dataStale.value = active.dataStale
    outputMode.value = active.outputMode
    loadError.value = active.loadError
    copied.value = active.copied
    repairCandidate.value = active.repairCandidate
    loadingUrl.value = active.loadingUrl
    pendingLoad.value = active.pendingLoad
    historyVersion.value = active.historyVersion
    lastSettled = active.lastSettled
    treeState.value = active.tree
    graphExpandedIds.value = active.graphExpandedIds
    graphUserTouched.value = active.graphUserTouched
    graphSelectedCellPath.value = active.graphSelectedCellPath
  }

  function detachActiveTab() {
    if (active === null) return
    active.data = data.value
    active.result = result.value
    active.dataStale = dataStale.value
    active.outputMode = outputMode.value
    active.loadError = loadError.value
    active.copied = copied.value
    active.repairCandidate = repairCandidate.value
    active.pendingLoad = pendingLoad.value
    active.loadingUrl = loadingUrl.value
    active.historyVersion = historyVersion.value
    active.lastSettled = lastSettled
    if (!active.lastValidationFailed) active.lastValidationFailed = dataStale.value
    active.graphExpandedIds = graphExpandedIds.value
    active.graphUserTouched = graphUserTouched.value
    active.graphSelectedCellPath = graphSelectedCellPath.value
    active.lastGraphData = data.value
    active.tree.expanded = treeState.value.expanded
    active.tree.expandVersion = treeState.value.expandVersion
    active.tree.scrollToHandler = treeState.value.scrollToHandler
    active.tree.editSession = treeState.value.editSession
    active.tree.dragFrom = treeState.value.dragFrom
    active.tree.dragTarget = treeState.value.dragTarget
    active.tree.pendingEdit = treeState.value.pendingEdit
  }

  function switchTab(id: string): boolean {
    const next = tabs.value.find((tab) => tab.id === id)
    if (next === undefined || id === activeTabId.value) return false
    detachActiveTab()
    activeTabId.value = id
    attachActiveTab()
    return true
  }

  function addTab(input = '', name?: string): string {
    if (tabs.value.length >= MAX_TABS) return activeTabId.value
    const id = createTabId()
    const tab = makeTab({
      id,
      name: nextTabName(name ?? '', tabs.value.map((item) => item.name)),
      input,
    })
    detachActiveTab()
    tabs.value.push(tab)
    activeTabId.value = id
    attachActiveTab()
    if (input !== '') scheduleValidation()
    persist()
    return id
  }

  function closeTab(id: string): boolean {
    const index = tabs.value.findIndex((tab) => tab.id === id)
    if (index < 0 || tabs.value.length === 1) return false
    const closing = tabs.value[index]
    if (closing.validateTimer !== null) window.clearTimeout(closing.validateTimer)
    if (closing.copiedTimer !== null) window.clearTimeout(closing.copiedTimer)
    clearTreeInteractions(closing.tree)

    const wasActive = id === activeTabId.value
    if (wasActive) detachActiveTab()
    tabs.value.splice(index, 1)
    if (wasActive) {
      const next = tabs.value[Math.min(index, tabs.value.length - 1)]
      activeTabId.value = next.id
      attachActiveTab()
    }
    persist()
    return true
  }

  function renameTab(id: string, rawName: string): boolean {
    const tab = tabs.value.find((item) => item.id === id)
    const name = rawName.trim()
    if (tab === undefined || name === '' || name.length > 120) return false
    tab.name = name
    persist()
    return true
  }

  // ── 校验：引擎造值，定位器找错（docs/adr/0002）─────────────────

  function markSettled() {
    lastSettled = { text: input.value, data: data.value }
    if (active !== null) active.lastSettled = lastSettled
  }

  function validateTab(tab: JsonTab): boolean {
    const text = tab.input
    if (text.trim() === '') {
      tab.data = undefined
      tab.result = null
      tab.dataStale = false
      return true
    }
    try {
      tab.data = JSON.parse(text)
      tab.result = { ok: true, data: tab.data }
      tab.dataStale = false
      return true
    } catch (error) {
      tab.result = {
        ok: false,
        location: locateJsonError(text),
        rawMessage: error instanceof Error ? error.message : String(error),
      }
      tab.dataStale = tab.data !== undefined
      return false
    }
  }

  function applyValidatedTab(tab: JsonTab) {
    if (tab.input !== tab.lastSettled.text) tab.history.push({ text: tab.input, data: tab.data }, 'text')
    tab.lastSettled = { text: tab.input, data: tab.data }
    tab.historyVersion = tab.history.version
    if (tab !== active) return
    historyVersion.value = tab.history.version
    data.value = tab.data
    result.value = tab.result
    dataStale.value = tab.dataStale
    lastSettled = tab.lastSettled
    active.lastSettled = lastSettled
  }

  function validate() {
    if (active === null) return
    if (validateTimer !== null) {
      window.clearTimeout(validateTimer)
      validateTimer = null
    }
    if (active.validateTimer !== null) {
      window.clearTimeout(active.validateTimer)
      active.validateTimer = null
    }
    if (active.validateTimer !== null) {
      window.clearTimeout(active.validateTimer)
      active.validateTimer = null
    }
    active.lastValidationFailed = !validateTab(active)
    active.lastGraphData = active.data
    active.graphExpandedIds = defaultExpandedIds(active.data)
    active.graphUserTouched = false
    graphExpandedIds.value = active.graphExpandedIds
    graphUserTouched.value = false
    markSettled()
    applyValidatedTab(active)
  }

  function scheduleValidation() {
    if (active === null || active.validateTimer !== null) return
    const tab = active
    tab.validateTimer = window.setTimeout(() => {
      tab.validateTimer = null
      tab.lastValidationFailed = !validateTab(tab)
      if (!sameJsonValue(tab.lastGraphData, tab.data)) {
        tab.lastGraphData = tab.data
        tab.graphExpandedIds = defaultExpandedIds(tab.data)
        tab.graphUserTouched = false
        if (tab === active) {
          graphExpandedIds.value = tab.graphExpandedIds
          graphUserTouched.value = false
        }
      }
      applyValidatedTab(tab)
      persist()
    }, AUTO_VALIDATE_DEBOUNCE_MS)
  }

  watch(input, (text, oldText) => {
    if (text === oldText) return
    if (validateTimer !== null) window.clearTimeout(validateTimer)
    validateTimer = null
    persist()
    // 超软上限：自动校验暂停（防每键全量重解析），等手动触发。
    if (!overSoftCap.value) {
      scheduleValidation()
    } else if (data.value !== undefined) {
      dataStale.value = true
      if (active !== null) {
        active.dataStale = true
        active.lastValidationFailed = true
      }
      markSettled()
    }
  })

  watch(
    () => activeTabId.value,
    () => persist(),
  )

  onScopeDispose(() => {
    if (validateTimer !== null) window.clearTimeout(validateTimer)
    for (const tab of tabs.value) {
      if (tab.validateTimer !== null) window.clearTimeout(tab.validateTimer)
      if (tab.copiedTimer !== null) window.clearTimeout(tab.copiedTimer)
    }
  })

  watch(copied, (value) => {
    if (active !== null) active.copied = value
  })

  watch(repairCandidate, (value) => {
    if (active !== null) active.repairCandidate = value
  })

  watch(pendingLoad, (value) => {
    if (active !== null) active.pendingLoad = value
  })

  watch(loadingUrl, (value) => {
    if (active !== null) active.loadingUrl = value
  })

  function syncTabLoading(id: string, value: boolean) {
    tabLoadingUrls.value[id] = value
    const tab = tabs.value.find((item) => item.id === id)
    if (tab !== undefined) tab.loadingUrl = value
    if (activeTabId.value === id) loadingUrl.value = value
  }

  function persist() {
    const persisted = persistedTabsWithinBudget(
      tabs.value.map(({ id, name, input }) => ({ id, name, input })),
      activeTabId.value,
    )
    if (persisted.length === 0) {
      removeZodJson(PERSIST_KEY)
      return
    }
    const payload: MultiTabPersist = {
      version: 2,
      tabs: persisted,
      activeTabId: persisted.some((tab) => tab.id === activeTabId.value)
        ? activeTabId.value
        : persisted[0].id,
    }
    saveZodJson(PERSIST_KEY, payload)
  }

  // ── 统一历史栈（ADR-0003）──────────────────────────────────────

  /** 文本键入防抖提交：以最近一次已提交状态为改动前快照入栈（连续键入合并） */
  function commitTextInput() {
    if (active === null || input.value === lastSettled.text) return
    active.history.push({ ...lastSettled }, 'text')
    syncHistoryVersion()
  }

  /** 恢复快照：文本与数据源一起回退；快照数据缺失时退回校验路径 */
  function restoreSnapshot(snapshot: EditorSnapshot) {
    if (active === null) return
    input.value = snapshot.text
    active.input = snapshot.text
    if (snapshot.text.trim() === '') {
      data.value = undefined
      result.value = null
      dataStale.value = false
      active.data = undefined
      active.result = null
      active.dataStale = false
    } else if (snapshot.data !== undefined) {
      data.value = snapshot.data
      result.value = { ok: true, data: snapshot.data }
      dataStale.value = false
      active.data = snapshot.data
      active.result = result.value
      active.dataStale = false
    } else {
      validateTab(active)
      data.value = active.data
      result.value = active.result
      dataStale.value = active.dataStale
    }
    active.lastGraphData = active.data
    active.graphExpandedIds = defaultExpandedIds(active.data)
    active.graphUserTouched = false
    graphExpandedIds.value = active.graphExpandedIds
    graphUserTouched.value = false
    markSettled()
  }

  function undo(): boolean {
    if (active === null) return false
    const snapshot = active.history.undo({ text: input.value, data: data.value })
    if (snapshot === null) return false
    syncHistoryVersion()
    restoreSnapshot(snapshot)
    return true
  }

  function redo(): boolean {
    if (active === null) return false
    const snapshot = active.history.redo({ text: input.value, data: data.value })
    if (snapshot === null) return false
    syncHistoryVersion()
    restoreSnapshot(snapshot)
    return true
  }

  /**
   * 数据源变化后的统一收口：序列化回文本视图、入栈、持久化。
   * prevText/prevData 是编辑前状态，作为历史快照。
   */
  function afterDataChange(next: unknown, prevText: string, prevData: unknown) {
    if (active === null) return
    data.value = next
    input.value = next === undefined ? '' : JSON.stringify(next, null, 2)
    result.value = next === undefined ? null : { ok: true, data: next }
    dataStale.value = false
    active.input = input.value
    active.data = next
    active.result = result.value
    active.dataStale = false
    active.lastValidationFailed = false
    if (!sameJsonValue(active.lastGraphData, data.value)) {
      active.lastGraphData = data.value
      active.graphExpandedIds = defaultExpandedIds(data.value)
      active.graphUserTouched = false
      graphExpandedIds.value = active.graphExpandedIds
      graphUserTouched.value = false
    }
    active.history.push({ text: prevText, data: prevData }, 'tree')
    markSettled()
    syncHistoryVersion()
    persist()
  }

  // ── 树形编辑动作（不可变操作，见 editor/mutations）──────────────

  function editNode(path: JsonPath, value: unknown): boolean {
    if (!hasData.value || treeEditReadonly.value) return false
    const next = setAtPath(data.value, path, value)
    if (next === data.value) return false
    afterDataChange(next, lastSettled.text, lastSettled.data)
    return true
  }

  /**
   * 就地编辑一个成员：键改名（可选）与值更新（可选）合并为一次历史记录。
   * newKey 为 null 表示不改键名；changeValue 为 false 表示值未变。
   * 键名冲突（对象内已存在同名键）返回 false。
   */
  function editEntry(
    path: JsonPath,
    newKey: string | null,
    value: unknown,
    changeValue: boolean,
  ): boolean {
    if (!hasData.value || treeEditReadonly.value) return false
    if (newKey !== null) {
      const renamed = renameKey(data.value, path, newKey)
      if (renamed === null) return false
      if (!changeValue) {
        afterDataChange(renamed.data, lastSettled.text, lastSettled.data)
        return true
      }
      const next = setAtPath(renamed.data, renamed.path, value)
      afterDataChange(next, lastSettled.text, lastSettled.data)
      return true
    }
    if (!changeValue) return false
    return editNode(path, value)
  }

  function removeNode(path: JsonPath): boolean {
    if (!hasData.value || treeEditReadonly.value || path.length === 0) return false
    const next = removeAtPath(data.value, path)
    afterDataChange(next, lastSettled.text, lastSettled.data)
    return true
  }

  function addObjectChild(parentPath: JsonPath, key: string, value: unknown): boolean {
    if (!hasData.value || treeEditReadonly.value) return false
    const parent = getAtPath(data.value, parentPath)
    if (parent === null || typeof parent !== 'object' || Array.isArray(parent)) return false
    const next = setAtPath(data.value, [...parentPath, key], value)
    afterDataChange(next, lastSettled.text, lastSettled.data)
    return true
  }

  function addArrayChild(parentPath: JsonPath, value: unknown): boolean {
    if (!hasData.value || treeEditReadonly.value) return false
    const parent = getAtPath(data.value, parentPath)
    if (!Array.isArray(parent)) return false
    const next = setAtPath(data.value, [...parentPath, String(parent.length)], value)
    afterDataChange(next, lastSettled.text, lastSettled.data)
    return true
  }

  function moveNodeAction(plan: Parameters<typeof moveNode>[1]): JsonPath | null {
    if (!hasData.value || treeEditReadonly.value) return null
    const moved = moveNode(data.value, plan)
    if (moved === null) return null
    afterDataChange(moved.data, lastSettled.text, lastSettled.data)
    return moved.path
  }

  function sortKeys(path: JsonPath, recursive: boolean): boolean {
    if (!hasData.value || treeEditReadonly.value) return false
    const next = sortObjectKeys(data.value, path, recursive)
    if (next === data.value) return false
    afterDataChange(next, lastSettled.text, lastSettled.data)
    return true
  }

  function nextKeyFor(parentPath: JsonPath): string | null {
    const parent = getAtPath(data.value, parentPath)
    if (parent === null || typeof parent !== 'object' || Array.isArray(parent)) return null
    return nextObjectKey(parent as Record<string, unknown>)
  }

  // ── 树/图谱交互状态 ────────────────────────────────────────────

  function setExpanded(path: JsonPath, open: boolean): void {
    treeState.value.expanded.set(pathKey(path), open)
    treeState.value.expandVersion += 1
  }

  function toggleExpanded(path: JsonPath, depth: number): boolean {
    const next = !isExpanded(path, depth)
    setExpanded(path, next)
    return next
  }

  function isExpanded(path: JsonPath, depth: number): boolean {
    return treeState.value.expanded.get(pathKey(path)) ?? depth < 2
  }

  function expandAncestors(path: JsonPath): void {
    for (let i = 1; i < path.length; i += 1) setExpanded(path.slice(0, i), true)
  }

  function collapseAll(): void {
    treeState.value.expanded.clear()
    treeState.value.expandVersion += 1
  }

  function expandAll(): void {
    const paths: JsonPath[] = []
    collectContainerPaths(data.value, [], paths)
    for (const path of paths) treeState.value.expanded.set(pathKey(path), true)
    treeState.value.expandVersion += 1
  }

  function setScrollToHandler(handler: ((path: JsonPath) => void) | null): void {
    treeState.value.scrollToHandler = handler
  }

  function scrollToNode(path: JsonPath): void {
    treeState.value.scrollToHandler?.(path)
  }

  const treeEditSession = computed({
    get: () => treeState.value.editSession,
    set: (session) => {
      treeState.value.editSession = session
    },
  })
  const treeStateProxy = computed(() => ({
    expandVersion: treeState.value.expandVersion,
    editSession: treeState.value.editSession,
    dragFrom: treeState.value.dragFrom,
    dragTarget: treeState.value.dragTarget,
    pendingEdit: treeState.value.pendingEdit,
  }))
  const dragState = computed(() => treeStateProxy.value)
  const pendingEdit = computed(() => treeStateProxy.value)

  function setTreeEditSession(session: TreeEditSession | null): void {
    treeState.value.editSession = session
  }

  function setGraphExpandedIds(ids: ReadonlySet<string>, userTouched: boolean): void {
    graphExpandedIds.value = ids
    graphUserTouched.value = userTouched
    if (active !== null) {
      active.graphExpandedIds = ids
      active.graphUserTouched = userTouched
    }
  }

  function selectGraphCell(path: JsonPath | null): void {
    graphSelectedCellPath.value = path
    if (active !== null) active.graphSelectedCellPath = path
  }

  // ── 处理类动作（整段文本替换，入栈）────────────────────────────

  /**
   * 把整段文本替换为给定内容（转义/Unicode/修复确认/统一载入/清空共用）。
   * forceValidate：显式载入必须让数据源跟上文本——软上限暂停的是键入路径的
   * 自动校验（防每键全量重解析），不是载入路径的这一次性解析。
   */
  function applyTextTransform(text: string, forceValidate = false) {
    if (active === null) return
    commitTextInput()
    input.value = text
    active.input = text
    active.lastValidationFailed = false
    if (forceValidate || !overSoftCap.value) validate()
    markSettled()
    persist()
  }

  // ── 修复 ───────────────────────────────────────────────────────

  function applyRepair(text: string) {
    repairCandidate.value = null
    if (active !== null) active.repairCandidate = null
    applyTextTransform(text)
  }

  // ── 原有动作 ───────────────────────────────────────────────────

  /** 格式化/压缩：整段重写输入文本（数据不变），一次历史记录 */
  function rewriteInput(text: string, nextMode: OutputMode) {
    if (active === null) return
    commitTextInput()
    input.value = text
    active.input = text
    result.value = { ok: true, data: data.value }
    dataStale.value = false
    outputMode.value = nextMode
    if (active !== null) {
      active.result = result.value
      active.dataStale = false
      active.outputMode = nextMode
      active.lastValidationFailed = false
    }
    markSettled()
    persist()
  }

  function format() {
    if (formatted.value === null) return
    rewriteInput(formatted.value, 'format')
  }

  function minify() {
    if (minified.value === null) return
    rewriteInput(minified.value, 'minify')
  }

  async function copyResult(): Promise<boolean> {
    const text = outputMode.value === 'format' ? formatted.value : minified.value
    if (text === null) return false
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      if (active?.copiedTimer !== null && active?.copiedTimer !== undefined) {
        window.clearTimeout(active.copiedTimer)
      }
      const tab = active
      if (tab !== null) {
        tab.copiedTimer = window.setTimeout(() => {
          tab.copied = false
          tab.copiedTimer = null
          if (tab === active) copied.value = false
        }, 1500)
      }
      return true
    } catch {
      return false
    }
  }

  function download() {
    const text = formatted.value
    if (text === null) return
    const name = active?.name.toLowerCase().endsWith('.json') ? active.name : `${active?.name ?? 'data'}.json`
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
    URL.revokeObjectURL(url)
  }

  // ── 载入（上传 / URL / 历史恢复）：统一确认门 + 文档历史记录 ────

  /** 把一次成功载入记入文档历史并持久化 */
  function recordLoaded(meta: LoadMeta, text: string) {
    docHistory.value = recordDocument(docHistory.value, {
      kind: meta.kind,
      name: meta.name,
      url: meta.url,
      content: text,
      timestamp: Date.now(),
    })
    saveDocumentHistory(docHistory.value)
  }

  /**
   * 载入入口：当前输入非空且与目标不同 → 挂起待确认；否则直接应用。
   * 上传、URL 拉取、文档历史恢复共用同一确认逻辑。
   * 返回「是否已实际载入」——挂起待确认（用户可能取消）不算。
   */
  function offerLoad(text: string, meta: LoadMeta, label: string): boolean {
    if (input.value !== '' && input.value !== text) {
      pendingLoad.value = { text, label, meta }
      if (active !== null) active.pendingLoad = pendingLoad.value
      return false
    }
    applyLoaded(text, meta)
    return true
  }

  function applyLoaded(text: string, meta: LoadMeta) {
    pendingLoad.value = null
    if (active !== null) active.pendingLoad = null
    applyTextTransform(text, true)
    recordLoaded(meta, text)
  }

  function confirmPendingLoad() {
    if (pendingLoad.value === null) return
    applyLoaded(pendingLoad.value.text, pendingLoad.value.meta)
  }

  function cancelPendingLoad() {
    pendingLoad.value = null
    if (active !== null) active.pendingLoad = null
  }

  /**
   * 远程加载（CONTEXT.md）：用户点击触发的单次裸 GET——无自定义请求头、
   * 无自动重试、无代理（ADR-0004）。响应体能 JSON.parse 即载入；
   * 失败时区分「浏览器跨域/网络受限」与「内容非法」，如实提示。
   */
  async function loadUrl(rawUrl: string): Promise<boolean> {
    const url = rawUrl.trim()
    const requestTab = active
    const requestId = requestTab?.id ?? ''
    if (pendingLoad.value !== null) return false
    loadError.value = null
    if (requestTab !== null) requestTab.loadError = null
    if (url === '') return false
    syncTabLoading(requestId, true)
    try {
      const response = await fetch(url)
        const failed = (message: string): false => {
          if (requestTab !== null) requestTab.loadError = message
          if (requestTab === active) loadError.value = message
          return false
        }
        if (!response.ok) {
          return failed(`加载失败：服务器返回 ${response.status}（${url}）`)
        }
        const text = await response.text()
        try {
          JSON.parse(text)
        } catch (error) {
          const location = locateJsonError(text)
          return failed(
            location !== null
              ? `响应不是合法 JSON（第 ${location.line} 行 第 ${location.column} 列：${location.message}）`
              : `响应不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
          )
        }
        if (requestTab !== active) return false
        const loaded = offerLoad(text, { kind: 'url', name: null, url }, `远程 ${url}`)
        if (loaded && requestTab !== null) {
          requestTab.name = nextTabName(
            new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '',
            tabs.value.map((tab) => tab.name),
          )
          persist()
        }
        return loaded
      } catch {
        const message =
          '加载失败：浏览器跨域限制或网络不可达——可打开该 URL 复制响应内容后粘贴'
        if (requestTab !== null) requestTab.loadError = message
        if (requestTab === active) loadError.value = message
        return false
    } finally {
      syncTabLoading(requestId, false)
    }
  }

  async function loadFile(file: File) {
    const requestTab = active
    if (requestTab === null || pendingLoad.value !== null) return
    loadError.value = null
    requestTab.loadError = null
    if (file.size > UPLOAD_CAP_BYTES) {
      loadError.value = `文件过大（${formatBytes(file.size)}），上传上限 ${formatBytes(UPLOAD_CAP_BYTES)}`
      return
    }
    try {
      const requestTab = active
      const text = await file.text()
      if (requestTab !== active) return
      offerLoad(text, { kind: 'file', name: file.name, url: null }, `文件 ${file.name}`)
      if (pendingLoad.value === null && requestTab !== null) {
        requestTab.name = nextTabName(file.name, tabs.value.map((tab) => tab.name))
        persist()
      }
    } catch {
      if (requestTab === active) loadError.value = `无法读取文件 ${file.name}`
      requestTab.loadError = `无法读取文件 ${file.name}`
    }
  }

  // ── 文档历史动作（命名避开统一历史栈：一律 docHistory 口径）──────

  /** 显式保存当前输入到文档历史（手动粘贴不自动记录） */
  function saveCurrentToDocHistory(): boolean {
    if (input.value.trim() === '') return false
    recordLoaded({ kind: 'paste', name: null, url: null }, input.value)
    return true
  }

  /** 恢复条目：有缓存走确认门载入；URL 条目无缓存时重新拉取 */
  function restoreFromDocHistory(id: string): boolean {
    const entry = docHistory.value.find((e) => e.id === id)
    if (entry === undefined) return false
    if (entry.content !== null) {
      offerLoad(entry.content, { kind: entry.kind, name: entry.name, url: entry.url }, displayName(entry))
      return true
    }
    if (entry.kind === 'url' && entry.url !== null) {
      void loadUrl(entry.url)
      return true
    }
    return false
  }

  /** URL 条目的次级动作：无视缓存直接重新拉取 */
  function refetchDocHistoryEntry(id: string): boolean {
    const entry = docHistory.value.find((e) => e.id === id)
    if (entry === undefined || entry.url === null) return false
    void loadUrl(entry.url)
    return true
  }

  function removeDocHistoryEntry(id: string) {
    docHistory.value = removeDocument(docHistory.value, id)
    saveDocumentHistory(docHistory.value)
  }

  function clearDocumentHistory() {
    docHistory.value = []
    clearDocumentHistoryStorage()
  }

  function clear() {
    applyTextTransform('')
    loadError.value = null
    if (active !== null) active.loadError = null
  }

  // 首次进入即呈现已恢复输入的校验结果
  for (const persistedTab of workspace.tabs) {
    const tab = makeTab(persistedTab)
    tabs.value.push(tab)
    if (tab.input !== '' && byteEncoder.encode(tab.input).length <= SOFT_CAP_BYTES) {
      validateTab(tab)
      tab.lastGraphData = tab.data
      tab.graphExpandedIds = defaultExpandedIds(tab.data)
    }
  }
  activeTabId.value = workspace.activeTabId
  attachActiveTab()
  if (input.value !== '' && !overSoftCap.value) validate()

  return {
    tabs,
    activeTabId,
    activeTab,
    input,
    setInput(text: string) {
      if (active === null) return
      active.input = text
      input.value = text
    },
    data,
    result,
    dataStale,
    mode,
    outputMode,
    loadError,
    copied,
    repairCandidate,
    loadingUrl,
    tabLoadingUrls,
    docHistory,
    pendingLoad,
    treeEditReadonly,
    canUndo,
    canRedo,
    byteSize,
    overSoftCap,
    hasData,
    formatted,
    minified,
    treeState,
    graphExpandedIds,
    graphUserTouched,
    graphSelectedCellPath,
    treeEditSession,
    dragState,
    pendingEdit,
    addTab,
    closeTab,
    renameTab,
    switchTab,
    validate,
    undo,
    redo,
    editNode,
    editEntry,
    removeNode,
    addObjectChild,
    addArrayChild,
    moveNodeAction,
    sortKeys,
    nextKeyFor,
    setExpanded,
    toggleExpanded,
    isExpanded,
    expandAncestors,
    collapseAll,
    expandAll,
    setScrollToHandler,
    scrollToNode,
    setTreeEditSession,
    setGraphExpandedIds,
    selectGraphCell,
    applyTextTransform,
    applyRepair,
    format,
    minify,
    copyResult,
    download,
    loadFile,
    loadUrl,
    offerLoad,
    confirmPendingLoad,
    cancelPendingLoad,
    saveCurrentToDocHistory,
    restoreFromDocHistory,
    refetchDocHistoryEntry,
    removeDocHistoryEntry,
    clearDocumentHistory,
    clear,
  }
})

function sameJsonValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** 路径 → 状态键（用不可见分隔符避免键名歧义） */
function pathKey(path: JsonPath): string {
  return path.join('\u001f')
}

function collectContainerPaths(data: unknown, path: JsonPath, out: JsonPath[]): void {
  if (data === null || typeof data !== 'object') return
  out.push(path)
  if (Array.isArray(data)) {
    data.forEach((item, index) => collectContainerPaths(item, [...path, String(index)], out))
  } else {
    for (const [key, value] of Object.entries(data)) {
      collectContainerPaths(value, [...path, key], out)
    }
  }
}
