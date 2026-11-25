import { z } from 'zod'

const persistedTabSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120).default('Untitled'),
  input: z.string().max(262_144).default(''),
})

const multiTabPersistSchema = z.object({
  version: z.literal(2),
  tabs: z.array(persistedTabSchema).min(1),
  activeTabId: z.string().min(1),
})

export const jsonEditorPersistSchema = z.union([
  multiTabPersistSchema,
  z.object({ input: z.string().max(262_144).default('') }),
])

export type JsonEditorPersist = z.output<typeof jsonEditorPersistSchema>
export type PersistedJsonTab = z.output<typeof persistedTabSchema>
export type MultiTabPersist = z.output<typeof multiTabPersistSchema>

export function nextUntitledTabName(names: readonly string[]): string {
  const used = new Set(names)
  let index = 1
  while (used.has(`Untitled ${index}`)) index += 1
  return `Untitled ${index}`
}

export function nextTabName(base: string, names: readonly string[]): string {
  const trimmed = base.trim()
  if (trimmed === '') return nextUntitledTabName(names)
  const used = new Set(names)
  if (!used.has(trimmed)) return trimmed

  const extensionIndex = trimmed.lastIndexOf('.')
  const stem = extensionIndex > 0 ? trimmed.slice(0, extensionIndex) : trimmed
  const extension = extensionIndex > 0 ? trimmed.slice(extensionIndex) : ''
  let index = 2
  while (used.has(`${stem} ${index}${extension}`)) index += 1
  return `${stem} ${index}${extension}`
}

/** 序列化后的完整工作区预算，包含标签名和 JSON 元数据。 */
export const TAB_PERSIST_BUDGET_BYTES = 256 * 1024

function workspaceBytes(tabs: readonly { id: string; name: string; input: string }[], activeTabId: string): number {
  return new TextEncoder().encode(JSON.stringify({ version: 2, tabs, activeTabId })).length
}

export function persistedTabsWithinBudget<T extends { id: string; name: string; input: string }>(
  tabs: readonly T[],
  activeTabId: string,
  budgetBytes = TAB_PERSIST_BUDGET_BYTES,
): T[] {
  let candidates = tabs
  if (workspaceBytes(candidates, activeTabId) <= budgetBytes) return [...candidates]

  candidates = tabs.slice(0, -1)
  if (candidates.length > 0 && workspaceBytes(candidates, candidates[0].id) <= budgetBytes) {
    return [...candidates]
  }

  const first = tabs[0]
  if (first === undefined) return []
  const empty = { ...first, input: '' }
  return workspaceBytes([empty], empty.id) <= budgetBytes ? [empty] : []
}
