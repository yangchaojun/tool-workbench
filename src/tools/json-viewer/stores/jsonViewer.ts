import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'

import { loadZodJson, removeZodJson, saveZodJson } from '@/shared/storage/zodStorage'

import { locateJsonError } from '../parser/locate'
import type { JsonErrorLocation } from '../parser/locate'
import { jsonViewerPersistSchema } from '../schemas'

const PERSIST_KEY = 'tw:json-viewer:input'

// 软上限：超过即警告/暂停，但不阻止使用（见 CONTEXT.md「软上限」）
const SOFT_CAP_BYTES = 1024 * 1024
const PERSIST_CAP_BYTES = 256 * 1024
const UPLOAD_CAP_BYTES = 5 * 1024 * 1024
const AUTO_VALIDATE_DEBOUNCE_MS = 300

export type JsonParseResult =
  | { ok: true; data: unknown }
  | { ok: false; location: JsonErrorLocation | null; rawMessage: string }

export type OutputMode = 'format' | 'minify'

const byteEncoder = new TextEncoder()

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export const useJsonViewerStore = defineStore('json-viewer', () => {
  const persisted = loadZodJson(
    PERSIST_KEY,
    jsonViewerPersistSchema,
    jsonViewerPersistSchema.parse({}),
  )

  // ── 状态 ──────────────────────────────────────────────────────
  const input = ref(persisted.input)
  /** 最近一次校验结果；null 表示尚未校验（空输入或超限待手动） */
  const result = shallowRef<JsonParseResult | null>(null)
  /** 复制跟随的输出模式（格式化 / 压缩），由最近一次格式化/压缩动作设定 */
  const outputMode = ref<OutputMode>('format')
  const uploadError = ref<string | null>(null)
  const copied = ref(false)

  // ── 派生 ──────────────────────────────────────────────────────
  const byteSize = computed(() => byteEncoder.encode(input.value).length)
  const overSoftCap = computed(() => byteSize.value > SOFT_CAP_BYTES)
  const hasData = computed(() => result.value !== null && result.value.ok)

  /** 供树形视图消费的最近一次合法数据（shallow，避免大对象深度响应） */
  const data = computed<unknown>(() => {
    const r = result.value
    return r !== null && r.ok ? r.data : undefined
  })

  const formatted = computed<string | null>(() => {
    const r = result.value
    return r !== null && r.ok ? JSON.stringify(r.data, null, 2) : null
  })
  const minified = computed<string | null>(() => {
    const r = result.value
    return r !== null && r.ok ? JSON.stringify(r.data) : null
  })

  // ── 校验：引擎造值，定位器找错（docs/adr/0002）─────────────────

  function validate() {
    const text = input.value
    if (text.trim() === '') {
      result.value = null
      return
    }
    try {
      result.value = { ok: true, data: JSON.parse(text) }
    } catch (error) {
      result.value = {
        ok: false,
        location: locateJsonError(text),
        rawMessage: error instanceof Error ? error.message : String(error),
      }
    }
  }

  let debounceTimer: number | null = null

  watch(input, () => {
    if (debounceTimer !== null) window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null
      // 超软上限：自动校验暂停（防每键全量重解析），等手动触发
      if (!overSoftCap.value) validate()
      persist()
    }, AUTO_VALIDATE_DEBOUNCE_MS)
  })

  function persist() {
    // 上限按 UTF-8 字节计（256KB），与 CONTEXT.md「软上限」口径一致；
    // schemas.ts 的字符 max 仅作读取防御（坏数据整体回落）
    if (byteSize.value <= PERSIST_CAP_BYTES) {
      saveZodJson(PERSIST_KEY, { input: input.value })
    } else {
      removeZodJson(PERSIST_KEY)
    }
  }

  // 首次进入即呈现已恢复输入的校验结果
  if (input.value !== '' && !overSoftCap.value) validate()

  // ── 动作 ──────────────────────────────────────────────────────

  function writeOutput(text: string, mode: OutputMode) {
    outputMode.value = mode
    input.value = text
  }

  function format() {
    if (formatted.value !== null) writeOutput(formatted.value, 'format')
  }

  function minify() {
    if (minified.value !== null) writeOutput(minified.value, 'minify')
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
      input.value = await file.text()
    } catch {
      uploadError.value = `无法读取文件 ${file.name}`
    }
  }

  function clear() {
    input.value = ''
    uploadError.value = null
  }

  return {
    input,
    result,
    outputMode,
    uploadError,
    copied,
    byteSize,
    overSoftCap,
    hasData,
    data,
    formatted,
    minified,
    validate,
    format,
    minify,
    copyResult,
    download,
    loadFile,
    clear,
  }
})
