import { z } from 'zod'

import { loadZodJson, removeZodJson, saveZodJson } from '@/shared/storage/zodStorage'

/**
 * 文档历史：跨会话持久化的已载入文档记录（CONTEXT.md「文档历史」）。
 * 与撤销/重做的统一历史栈（editor/history.ts）完全无关。
 *
 * 记录时机由 store 侧决定：仅显式载入动作（上传/URL 拉取）自动记录，
 * 手动粘贴经显式「保存到文档历史」记录。本模块只负责纯逻辑与持久化。
 */

export const DOCUMENT_HISTORY_KEY = 'tw:json-editor:doc-history'
/** 条目上限：超出淘汰最旧 */
export const DOC_HISTORY_MAX_ENTRIES = 20
/** 内容上限：≤256KB 存全文，超出只存元信息（与输入持久化软上限口径一致） */
export const DOC_HISTORY_CONTENT_CAP_BYTES = 256 * 1024
/** 存储总字节预算：满时按最旧优先把全文条目降级为仅元信息 */
export const DOC_HISTORY_BUDGET_BYTES = 1024 * 1024
/** 每条元信息的存储开销估算（id/来源/时间戳等 JSON 包装），用于预算测算 */
export const META_OVERHEAD_BYTES = 512

export type DocumentKind = 'file' | 'url' | 'paste'

export interface DocumentHistoryEntry {
  id: string
  kind: DocumentKind
  /** kind 为 file 时的文件名 */
  name: string | null
  /** kind 为 url 时的来源地址；去重合并后其它 kind 的条目也可能记住 url（供重新拉取） */
  url: string | null
  /** 全文缓存；null 表示超出内容上限未缓存 */
  content: string | null
  /** 全文指纹（内容级去重用，全文超限未缓存时是唯一可比对的痕迹） */
  contentHash: string
  /** 内容的 UTF-8 字节数（content 降级后仍保留，用于展示） */
  byteSize: number
  timestamp: number
}

const byteEncoder = new TextEncoder()

export function textBytes(text: string): number {
  return byteEncoder.encode(text).length
}

/** FNV-1a 32 位指纹（十六进制）：全文去重只要求稳定低碰撞，不要求密码学强度 */
export function contentFingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** 单条条目在 localStorage 中的估算占用（预算按此口径计） */
export function entryStoredSize(entry: DocumentHistoryEntry): number {
  return (entry.content !== null ? textBytes(entry.content) : 0) + META_OVERHEAD_BYTES
}

export interface DocumentRecordInput {
  kind: DocumentKind
  name?: string | null
  url?: string | null
  content: string
  timestamp: number
  id?: string
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createDocumentEntry(input: DocumentRecordInput): DocumentHistoryEntry {
  const byteSize = textBytes(input.content)
  return {
    id: input.id ?? newId(),
    kind: input.kind,
    name: input.name ?? null,
    url: input.url ?? null,
    content: byteSize <= DOC_HISTORY_CONTENT_CAP_BYTES ? input.content : null,
    contentHash: contentFingerprint(input.content),
    byteSize,
    timestamp: input.timestamp,
  }
}

/** 内容级去重：相同全文（按指纹）→ 顶部刷新时间戳，并记住旧条目的 URL/文件名 */
function dedupe(entries: DocumentHistoryEntry[], fresh: DocumentHistoryEntry): DocumentHistoryEntry[] {
  const index = entries.findIndex((e) => e.contentHash === fresh.contentHash)
  if (index < 0) return [fresh, ...entries]
  const old = entries[index]
  return [
    { ...fresh, url: fresh.url ?? old.url, name: fresh.name ?? old.name },
    ...entries.filter((_, i) => i !== index),
  ]
}

/**
 * 记录一次载入：去重 → 条目上限 → 字节预算降级。
 * 返回新数组（不修改入参）。
 */
export function recordDocument(
  entries: DocumentHistoryEntry[],
  input: DocumentRecordInput,
): DocumentHistoryEntry[] {
  let next = dedupe(entries, createDocumentEntry(input))
  if (next.length > DOC_HISTORY_MAX_ENTRIES) next = next.slice(0, DOC_HISTORY_MAX_ENTRIES)
  return fitBudget(next, DOC_HISTORY_BUDGET_BYTES)
}

/** 字节预算约束：超预算时最旧全文条目先降级；全部降级仍超则丢弃最旧（防御分支） */
export function fitBudget(
  entries: DocumentHistoryEntry[],
  budget: number,
): DocumentHistoryEntry[] {
  const next = [...entries]
  const total = () => next.reduce((sum, e) => sum + entryStoredSize(e), 0)
  while (total() > budget) {
    let degraded = false
    for (let i = next.length - 1; i >= 0; i -= 1) {
      if (next[i].content !== null) {
        next[i] = { ...next[i], content: null }
        degraded = true
        break
      }
    }
    if (!degraded) {
      next.pop() // 全部已仅元信息仍超预算：丢最旧
    }
  }
  return next
}

/** 按 id 删除单条；未命中返回原数组 */
export function removeDocument(
  entries: DocumentHistoryEntry[],
  id: string,
): DocumentHistoryEntry[] {
  if (!entries.some((e) => e.id === id)) return entries
  return entries.filter((e) => e.id !== id)
}

/** 列表展示名：文件名 / URL / 固定文案 */
export function displayName(entry: DocumentHistoryEntry): string {
  if (entry.kind === 'file') return entry.name ?? '未命名文件'
  if (entry.kind === 'url') return entry.url ?? '未知地址'
  return '粘贴内容'
}

// ── 持久化（zodStorage 守护，坏数据整体回落为空）────────────────
// 载入侧 schema 不设上限：合法但超限的历史应被裁剪，而不是整体判坏清空。

const documentHistoryEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(['file', 'url', 'paste']),
  name: z.string().nullable(),
  url: z.string().nullable(),
  content: z.string().nullable(),
  contentHash: z.string(),
  byteSize: z.number(),
  timestamp: z.number(),
})

const documentHistoryPersistSchema = z.object({
  entries: z.array(documentHistoryEntrySchema).default([]),
})

/** 载入侧收口：条目超限裁剪、全文超限降级、字节预算收紧 */
export function sanitizeDocumentHistory(entries: DocumentHistoryEntry[]): DocumentHistoryEntry[] {
  return fitBudget(
    entries
      .slice(0, DOC_HISTORY_MAX_ENTRIES)
      .map((e) =>
        e.content !== null && textBytes(e.content) > DOC_HISTORY_CONTENT_CAP_BYTES
          ? { ...e, content: null }
          : e,
      ),
    DOC_HISTORY_BUDGET_BYTES,
  )
}

export function loadDocumentHistory(): DocumentHistoryEntry[] {
  const persisted = loadZodJson(
    DOCUMENT_HISTORY_KEY,
    documentHistoryPersistSchema,
    documentHistoryPersistSchema.parse({}),
  )
  return sanitizeDocumentHistory(persisted.entries)
}

export function saveDocumentHistory(entries: DocumentHistoryEntry[]): void {
  saveZodJson(DOCUMENT_HISTORY_KEY, {
    entries: fitBudget(entries, DOC_HISTORY_BUDGET_BYTES).slice(0, DOC_HISTORY_MAX_ENTRIES),
  })
}

export function clearDocumentHistoryStorage(): void {
  removeZodJson(DOCUMENT_HISTORY_KEY)
}
