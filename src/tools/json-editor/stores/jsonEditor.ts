import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'

import { loadZodJson, removeZodJson, saveZodJson } from '@/shared/storage/zodStorage'

import { locateJsonError } from '../parser/locate'
import type { JsonErrorLocation } from '../parser/locate'
import type { RepairFix } from '../parser/repair'
import { jsonEditorPersistSchema } from '../schemas'
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
const PERSIST_CAP_BYTES = 256 * 1024
export const UPLOAD_CAP_BYTES = 20 * 1024 * 1024
/**
 * 树编辑降级阈值（ADR-0005 Consequences）：超过后树形编辑降级为只读。
 * 依实测定值——全量重序列化（2 空格 JSON.stringify，树编辑每次 O(n) 成本）：
 * 8MB ≈ 28ms、12MB ≈ 44ms、20MB ≈ 72ms（M 系列芯片参考机），8MB 为响应性上限。
 */
const TREE_EDIT_MAX_BYTES = 8 * 1024 * 1024
const AUTO_VALIDATE_DEBOUNCE_MS = 300

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

export const useJsonEditorStore = defineStore('json-editor', () => {
  migrateLegacyKey()
  const persisted = loadZodJson(
    PERSIST_KEY,
    jsonEditorPersistSchema,
    jsonEditorPersistSchema.parse({}),
  )

  // ── 状态 ──────────────────────────────────────────────────────
  const input = ref(persisted.input)
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
  /**
   * 文档历史（CONTEXT.md「文档历史」，与统一历史栈无关）：
   * 仅显式载入动作自动记录，手动粘贴经显式保存记录。
   */
  const docHistory = ref<DocumentHistoryEntry[]>(loadDocumentHistory())
  /**
   * 统一载入确认门：当前输入非空且与目标内容不同时挂起，待用户确认覆盖。
   * 上传、URL 拉取、文档历史恢复共用（CONTEXT.md「输入」：处理动作需用户确认才改写）。
   */
  const pendingLoad = ref<{ text: string; label: string; meta: LoadMeta } | null>(null)

  const history = new HistoryStack()
  const historyVersion = ref(0)
  const canUndo = computed(() => {
    void historyVersion.value
    return history.hasPast()
  })
  const canRedo = computed(() => {
    void historyVersion.value
    return history.hasFuture()
  })

  /**
   * 最近一次「已提交」的快照锚点：文本键入合并窗口的起点。
   * 文本防抖提交时以它为改动前状态入栈。
   */
  let lastSettled: EditorSnapshot = { text: persisted.input, data: undefined }

  // ── 派生 ──────────────────────────────────────────────────────
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

  // ── 校验：引擎造值，定位器找错（docs/adr/0002）─────────────────

  function markSettled() {
    lastSettled = { text: input.value, data: data.value }
  }

  function validate() {
    const text = input.value
    if (text.trim() === '') {
      result.value = null
      data.value = undefined
      dataStale.value = false
      markSettled()
      return
    }
    try {
      data.value = JSON.parse(text)
      result.value = { ok: true, data: data.value }
      dataStale.value = false
      markSettled()
    } catch (error) {
      result.value = {
        ok: false,
        location: locateJsonError(text),
        rawMessage: error instanceof Error ? error.message : String(error),
      }
      dataStale.value = data.value !== undefined
      markSettled()
    }
  }

  let debounceTimer: number | null = null

  watch(input, () => {
    if (debounceTimer !== null) window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null
      // 超软上限：自动校验暂停（防每键全量重解析），等手动触发；
      // 数据源已落后于文本时树暂停同步（编辑动作被守卫拦下），避免基于旧数据改写新文本。
      // 显式载入走 applyTextTransform 的强制校验，不经过此分支。
      if (!overSoftCap.value) {
        commitTextInput()
        validate()
      } else if (input.value !== lastSettled.text) {
        dataStale.value = data.value !== undefined
      }
      persist()
    }, AUTO_VALIDATE_DEBOUNCE_MS)
  })

  function persist() {
    // 上限按 UTF-8 字节计（256KB），与 CONTEXT.md「软上限」口径一致
    if (byteSize.value <= PERSIST_CAP_BYTES) {
      saveZodJson(PERSIST_KEY, { input: input.value })
    } else {
      removeZodJson(PERSIST_KEY)
    }
  }

  // ── 统一历史栈（ADR-0003）─────────────────────────────────────

  function syncHistoryVersion() {
    historyVersion.value = history.version
  }

  /** 文本键入防抖提交：以最近一次已提交状态为改动前快照入栈（连续键入合并） */
  function commitTextInput() {
    if (input.value === lastSettled.text) return
    history.push({ ...lastSettled }, 'text')
    syncHistoryVersion()
  }

  /** 恢复快照：文本与数据源一起回退；快照数据缺失时退回校验路径 */
  function restoreSnapshot(snapshot: EditorSnapshot) {
    input.value = snapshot.text
    if (snapshot.text.trim() === '') {
      data.value = undefined
      result.value = null
      dataStale.value = false
    } else if (snapshot.data !== undefined) {
      data.value = snapshot.data
      result.value = { ok: true, data: snapshot.data }
      dataStale.value = false
    } else {
      data.value = undefined
      validate()
    }
    markSettled()
    persist()
  }

  function undo(): boolean {
    const snapshot = history.undo({ text: input.value, data: data.value })
    if (snapshot === null) return false
    syncHistoryVersion()
    restoreSnapshot(snapshot)
    return true
  }

  function redo(): boolean {
    const snapshot = history.redo({ text: input.value, data: data.value })
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
    data.value = next
    input.value = next === undefined ? '' : JSON.stringify(next, null, 2)
    result.value = next === undefined ? null : { ok: true, data: next }
    dataStale.value = false
    history.push({ text: prevText, data: prevData }, 'tree')
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

  // ── 处理类动作（整段文本替换，入栈）────────────────────────────

  /**
   * 把整段文本替换为给定内容（转义/Unicode/修复确认/统一载入/清空共用）。
   * forceValidate：显式载入必须让数据源跟上文本——软上限暂停的是键入路径的
   * 自动校验（防每键全量重解析），不是载入路径的这一次性解析。
   */
  function applyTextTransform(text: string, forceValidate = false) {
    commitTextInput()
    input.value = text
    if (forceValidate || !overSoftCap.value) validate()
    markSettled()
    persist()
  }

  // ── 修复 ───────────────────────────────────────────────────────

  function applyRepair(text: string) {
    repairCandidate.value = null
    applyTextTransform(text)
  }

  // ── 原有动作 ───────────────────────────────────────────────────

  /** 格式化/压缩：整段重写输入文本（数据不变），一次历史记录 */
  function rewriteInput(text: string, mode: OutputMode) {
    commitTextInput()
    input.value = text
    result.value = { ok: true, data: data.value }
    dataStale.value = false
    outputMode.value = mode
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
      window.setTimeout(() => {
        copied.value = false
      }, 1500)
      return true
    } catch {
      return false
    }
  }

  function download() {
    const text = formatted.value
    if (text === null) return
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'data.json'
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
      return false
    }
    applyLoaded(text, meta)
    return true
  }

  function applyLoaded(text: string, meta: LoadMeta) {
    pendingLoad.value = null
    applyTextTransform(text, true)
    recordLoaded(meta, text)
  }

  function confirmPendingLoad() {
    if (pendingLoad.value === null) return
    applyLoaded(pendingLoad.value.text, pendingLoad.value.meta)
  }

  function cancelPendingLoad() {
    pendingLoad.value = null
  }

  /**
   * 远程加载（CONTEXT.md）：用户点击触发的单次裸 GET——无自定义请求头、
   * 无自动重试、无代理（ADR-0004）。响应体能 JSON.parse 即载入；
   * 失败时区分「浏览器跨域/网络受限」与「内容非法」，如实提示。
   */
  async function loadUrl(rawUrl: string): Promise<boolean> {
    const url = rawUrl.trim()
    loadError.value = null
    if (url === '') return false
    loadingUrl.value = true
    try {
      const response = await fetch(url)
      if (!response.ok) {
        loadError.value = `加载失败：服务器返回 ${response.status}（${url}）`
        return false
      }
      const text = await response.text()
      try {
        JSON.parse(text)
      } catch (error) {
        const location = locateJsonError(text)
        loadError.value =
          location !== null
            ? `响应不是合法 JSON（第 ${location.line} 行 第 ${location.column} 列：${location.message}）`
            : `响应不是合法 JSON：${error instanceof Error ? error.message : String(error)}`
        return false
      }
      return offerLoad(text, { kind: 'url', name: null, url }, `远程 ${url}`)
    } catch {
      loadError.value =
        '加载失败：浏览器跨域限制或网络不可达——可打开该 URL 复制响应内容后粘贴'
      return false
    } finally {
      loadingUrl.value = false
    }
  }

  async function loadFile(file: File) {
    loadError.value = null
    if (file.size > UPLOAD_CAP_BYTES) {
      loadError.value = `文件过大（${formatBytes(file.size)}），上传上限 ${formatBytes(UPLOAD_CAP_BYTES)}`
      return
    }
    try {
      offerLoad(await file.text(), { kind: 'file', name: file.name, url: null }, `文件 ${file.name}`)
    } catch {
      loadError.value = `无法读取文件 ${file.name}`
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
  }

  // 首次进入即呈现已恢复输入的校验结果
  if (input.value !== '' && !overSoftCap.value) validate()

  return {
    input,
    data,
    result,
    dataStale,
    mode,
    outputMode,
    loadError,
    copied,
    repairCandidate,
    loadingUrl,
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
    applyTextTransform,
    applyRepair,
    format,
    minify,
    copyResult,
    download,
    loadFile,
    loadUrl,
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
