<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NIcon, NInput, NSelect, NSpin } from 'naive-ui'
import { PlayOutline, CopyOutline } from '@vicons/ionicons5'

import { runQuery, type QueryLang } from '../query/query'
import { useJsonEditorStore } from '../stores/jsonEditor'
import { expandAncestors, scrollToNode } from './treeState'
import type { JsonPath } from '../editor/mutations'
import { jsonValueType, jsonValueTypeLabels } from './treeTypes'

/**
 * 查询面板：JSONPath / JMESPath 从数据源提取结果。
 * 结果可逐条定位到树形节点、复制、或提取回编辑器（入撤销栈）。
 */

const store = useJsonEditorStore()

const lang = ref<QueryLang>('jsonpath')
const expression = ref('')
const running = ref(false)
const error = ref<string | null>(null)
const results = ref<unknown[]>([])

const langOptions = [
  { label: 'JSONPath', value: 'jsonpath' },
  { label: 'JMESPath', value: 'jmespath' },
]

async function run() {
  if (store.data === undefined) {
    error.value = '数据源为空：先确保文本是合法 JSON'
    results.value = []
    return
  }
  running.value = true
  error.value = null
  const outcome = await runQuery(lang.value, store.data, expression.value)
  running.value = false
  if (outcome.ok) {
    results.value = outcome.results
  } else {
    results.value = []
    error.value = outcome.error
  }
}

function locate(result: unknown) {
  const path = findPath(store.data, result)
  if (path === null) return
  expandAncestors(path)
  requestAnimationFrame(() => scrollToNode(path))
}

/** 在数据源里查找首个与结果深度相等的路径（=== 引用或原始值相等） */
function findPath(data: unknown, target: unknown, path: JsonPath = []): JsonPath | null {
  if (deepEqual(data, target) && path.length > 0) return path
  if (data !== null && typeof data === 'object') {
    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i += 1) {
        const found = findPath(data[i], target, [...path, String(i)])
        if (found !== null) return found
      }
    } else {
      for (const [k, v] of Object.entries(data)) {
        const found = findPath(v, target, [...path, k])
        if (found !== null) return found
      }
    }
  }
  return null
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function resultLabel(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`
  if (value === null || typeof value !== 'object') return String(value)
  const kind = jsonValueType(value)
  if (kind === 'object') return `{…} ${Object.keys(value).length} 个键`
  if (kind === 'array') return `[…] ${(value as unknown[]).length} 项`
  return jsonValueTypeLabels[kind]
}

async function copyResults() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(results.value, null, 2))
  } catch {
    /* 剪贴板不可用：静默 */
  }
}

function extractToEditor() {
  if (results.value.length === 0) return
  const extracted = results.value.length === 1 ? results.value[0] : results.value
  store.applyTextTransform(JSON.stringify(extracted, null, 2))
}
</script>

<template>
  <div class="flex flex-col gap-1.5 border-t border-border/60 pt-2">
    <div class="flex items-center gap-1.5">
      <NSelect
        v-model:value="lang"
        size="tiny"
        :options="langOptions"
        class="shrink-0"
        style="width: 7rem"
        :consistent-menu-width="false"
      />
      <NInput
        v-model:value="expression"
        size="tiny"
        class="min-w-0 flex-1 font-mono"
        :placeholder="lang === 'jsonpath' ? '$.store.book[*].title' : 'store.book[*].title'"
        clearable
        @keydown.enter="run"
      />
      <NButton size="tiny" type="primary" secondary :loading="running" @click="run">
        <template #icon>
          <NIcon :size="13"><PlayOutline /></NIcon>
        </template>
        查询
      </NButton>
    </div>

    <div v-if="error !== null" class="text-xs text-destructive">{{ error }}</div>
    <div v-else-if="results.length === 0 && expression.trim() !== ''" class="text-xs text-muted-foreground">
      {{ running ? '查询中…' : '无匹配结果' }}
    </div>

    <div v-if="results.length > 0" class="flex min-h-0 flex-col gap-1">
      <div class="flex items-center gap-1 text-xs text-muted-foreground">
        <span>{{ results.length }} 个结果</span>
        <div class="flex-1" />
        <NButton size="tiny" quaternary @click="copyResults">
          <template #icon>
            <NIcon :size="12"><CopyOutline /></NIcon>
          </template>
          复制
        </NButton>
        <NButton size="tiny" quaternary @click="extractToEditor">提取到编辑器</NButton>
      </div>
      <ul class="max-h-40 overflow-auto rounded bg-muted p-1 text-xs font-mono text-foreground">
        <li v-for="(result, i) in results" :key="i" class="truncate">
          <button
            type="button"
            class="w-full truncate rounded px-1 text-left transition-colors duration-150 hover:bg-accent-50"
            :title="JSON.stringify(result)"
            @click="locate(result)"
          >
            {{ resultLabel(result) }}
          </button>
        </li>
      </ul>
    </div>
    <NSpin v-if="running" size="small" class="self-center" />
  </div>
</template>
