import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'

import { loadZodJson, removeZodJson, saveZodJson } from '@/shared/storage/zodStorage'

import { locateJsonError } from '../parser/locate'
import type { JsonErrorLocation } from '../parser/locate'
import type { RepairFix } from '../parser/repair'
import { jsonEditorPersistSchema } from '../schemas'
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
const UPLOAD_CAP_BYTES = 5 * 1024 * 1024
const AUTO_VALIDATE_DEBOUNCE_MS = 300

export type JsonParseResult =
  | { ok: true; data: unknown }
  | { ok: false; location: JsonErrorLocation | null; rawMessage: string }

export type OutputMode = 'format' | 'minify'
/** 顶层模式：编辑 / 对比 */
export type ToolMode = 'edit' | 'diff'

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
  const uploadError = ref<string | null>(null)
  const copied = ref(false)
  /** 修复预览的待应用候选（RepairModal 消费）；null 表示无进行中的修复 */
  const repairCandidate = ref<{ text: string; fixes: RepairFix[] } | null>(null)

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
    }
  }

  let debounceTimer: number | null = null

  watch(input, () => {
    if (debounceTimer !== null) window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null
      // 超软上限：自动校验暂停（防每键全量重解析），等手动触发
      if (!overSoftCap.value) {
        commitTextInput()
        validate()
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
    if (!hasData.value) return false
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
    if (!hasData.value) return false
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
    if (!hasData.value || path.length === 0) return false
    const next = removeAtPath(data.value, path)
    afterDataChange(next, lastSettled.text, lastSettled.data)
    return true
  }

  function addObjectChild(parentPath: JsonPath, key: string, value: unknown): boolean {
    if (!hasData.value) return false
    const parent = getAtPath(data.value, parentPath)
    if (parent === null || typeof parent !== 'object' || Array.isArray(parent)) return false
    const next = setAtPath(data.value, [...parentPath, key], value)
    afterDataChange(next, lastSettled.text, lastSettled.data)
    return true
  }

  function addArrayChild(parentPath: JsonPath, value: unknown): boolean {
    if (!hasData.value) return false
    const parent = getAtPath(data.value, parentPath)
    if (!Array.isArray(parent)) return false
    const next = setAtPath(data.value, [...parentPath, String(parent.length)], value)
    afterDataChange(next, lastSettled.text, lastSettled.data)
    return true
  }

  function moveNodeAction(plan: Parameters<typeof moveNode>[1]): JsonPath | null {
    if (!hasData.value) return null
    const moved = moveNode(data.value, plan)
    if (moved === null) return null
    afterDataChange(moved.data, lastSettled.text, lastSettled.data)
    return moved.path
  }

  function sortKeys(path: JsonPath, recursive: boolean): boolean {
    if (!hasData.value) return false
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

  /** 把整段文本替换为给定内容（转义/Unicode/修复确认/上传/清空共用） */
  function applyTextTransform(text: string) {
    commitTextInput()
    input.value = text
    // 写入后立即校验（超软上限时暂停自动校验，交由用户手动触发）
    if (!overSoftCap.value) validate()
    persist()
  }

  // ── 修复 ───────────────────────────────────────────────────────

  function applyRepair(text: string) {
    repairCandidate.value = null
    applyTextTransform(text)
  }

  // ── 原有动作 ───────────────────────────────────────────────────

  function writeOutput(text: string, mode: OutputMode) {
    commitTextInput()
    input.value = text
    result.value = { ok: true, data: data.value }
    dataStale.value = false
    outputMode.value = mode
    persist()
  }

  function format() {
    if (formatted.value === null) return
    writeOutput(formatted.value, 'format')
  }

  function minify() {
    if (minified.value === null) return
    writeOutput(minified.value, 'minify')
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

  async function loadFile(file: File) {
    uploadError.value = null
    if (file.size > UPLOAD_CAP_BYTES) {
      uploadError.value = `文件过大（${formatBytes(file.size)}），上传上限 5MB`
      return
    }
    try {
      applyTextTransform(await file.text())
    } catch {
      uploadError.value = `无法读取文件 ${file.name}`
    }
  }

  function clear() {
    applyTextTransform('')
    uploadError.value = null
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
    uploadError,
    copied,
    repairCandidate,
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
    clear,
  }
})
