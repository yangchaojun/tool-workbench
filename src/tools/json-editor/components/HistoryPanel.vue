<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { NButton, NIcon, NInput } from 'naive-ui'
import {
  ClipboardOutline,
  CloudDownloadOutline,
  DocumentTextOutline,
  GlobeOutline,
  SaveOutline,
  TrashOutline,
} from '@vicons/ionicons5'

import { formatBytes, useJsonEditorStore } from '../stores/jsonEditor'
import { displayName } from '../document/documentHistory'
import type { DocumentHistoryEntry } from '../document/documentHistory'

/**
 * 文档历史面板（CONTEXT.md「文档历史」）：顶部 URL 远程加载入口 +
 * 按时间倒序的已载入文档列表 + 底部清空与显式保存。
 */

const store = useJsonEditorStore()
const { input, docHistory } = storeToRefs(store)
const loadingUrl = computed(() => store.tabLoadingUrls[store.activeTabId] === true)

const urlText = ref('')
const confirmingClear = ref(false)

async function loadFromUrl() {
  const ok = await store.loadUrl(urlText.value)
  if (ok) urlText.value = ''
}

function kindIcon(entry: DocumentHistoryEntry) {
  if (entry.kind === 'url') return GlobeOutline
  if (entry.kind === 'file') return DocumentTextOutline
  return ClipboardOutline
}

/** 有全文缓存可直接恢复；URL 条目无缓存时可重新拉取 */
function canRestore(entry: DocumentHistoryEntry): boolean {
  return entry.content !== null || (entry.kind === 'url' && entry.url !== null)
}

function timeLabel(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function restoreEntry(entry: DocumentHistoryEntry) {
  if (canRestore(entry)) store.restoreFromDocHistory(entry.id)
}

function refetchEntry(entry: DocumentHistoryEntry) {
  store.refetchDocHistoryEntry(entry.id)
}

function removeEntry(entry: DocumentHistoryEntry) {
  store.removeDocHistoryEntry(entry.id)
}

function saveCurrent() {
  store.saveCurrentToDocHistory()
}

function onClear() {
  if (!confirmingClear.value) {
    confirmingClear.value = true
    return
  }
  store.clearDocumentHistory()
  confirmingClear.value = false
}
</script>

<template>
  <div class="flex flex-col gap-2 text-sm">
    <!-- URL 远程加载（ADR-0004：用户主动触发的单次裸 GET） -->
    <div class="flex items-center gap-1.5">
      <NInput
        v-model:value="urlText"
        size="small"
        placeholder="https://example.com/data.json"
        class="min-w-0 flex-1 font-mono"
        clearable
        @keydown.enter="loadFromUrl"
      />
      <NButton size="small" type="primary" secondary :loading="loadingUrl" @click="loadFromUrl">
        加载
      </NButton>
    </div>

    <div v-if="docHistory.length === 0" class="px-1 py-3 text-center text-xs text-muted-foreground">
      暂无文档历史——上传或从 URL 载入后自动记录
    </div>

    <div v-else class="-mx-1 max-h-72 overflow-y-auto px-1">
      <div
        v-for="entry in docHistory"
        :key="entry.id"
        class="group flex items-center gap-2 rounded px-1.5 py-1.5"
        :class="canRestore(entry) ? 'cursor-pointer hover:bg-muted' : 'cursor-default opacity-60'"
        :title="canRestore(entry) ? '载入此文档' : '内容超出 256KB 未缓存，无法直接恢复'"
        @click="restoreEntry(entry)"
      >
        <NIcon :size="14" class="shrink-0 text-muted-foreground"><component :is="kindIcon(entry)" /></NIcon>
        <span class="min-w-0 flex-1 truncate font-mono text-xs" :title="displayName(entry)">
          {{ displayName(entry) }}
        </span>
        <span v-if="entry.content === null" class="shrink-0 text-xs text-muted-foreground">未缓存</span>
        <span class="shrink-0 text-xs text-muted-foreground">
          {{ formatBytes(entry.byteSize) }} · {{ timeLabel(entry.timestamp) }}
        </span>
        <button
          v-if="entry.url !== null"
          type="button"
          class="grid size-6 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-accent group-hover:opacity-100 group-focus-within:opacity-100"
          aria-label="重新拉取"
          title="重新拉取"
          @click.stop="refetchEntry(entry)"
        >
          <NIcon :size="13"><CloudDownloadOutline /></NIcon>
        </button>
        <button
          v-if="entry.url !== null"
          type="button"
          class="grid size-6 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100"
          aria-label="删除此条"
          title="删除此条"
          @click.stop="removeEntry(entry)"
        >
          <NIcon :size="13"><TrashOutline /></NIcon>
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between border-t border-border pt-2">
      <NButton
        size="tiny"
        quaternary
        :disabled="input.trim() === ''"
        @click="saveCurrent()"
      >
        <template #icon>
          <NIcon :size="14"><SaveOutline /></NIcon>
        </template>
        保存当前内容
      </NButton>
      <NButton
        size="tiny"
        quaternary
        type="error"
        :disabled="docHistory.length === 0"
        @click="onClear"
      >
        <template #icon>
          <NIcon :size="14"><TrashOutline /></NIcon>
        </template>
        {{ confirmingClear ? '确认清空？' : '清空' }}
      </NButton>
    </div>
  </div>
</template>
