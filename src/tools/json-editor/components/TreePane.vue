<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NIcon, NInput } from 'naive-ui'
import {
  ArrowDownOutline,
  ArrowUpOutline,
  SearchOutline,
} from '@vicons/ionicons5'

import TreeView from './TreeView.vue'
import QueryPanel from './QueryPanel.vue'
import { useJsonEditorStore } from '../stores/jsonEditor'
import { expandAncestors, pathKey, scrollToNode } from './treeState'
import type { JsonPath as MutPath } from '../editor/mutations'

/**
 * 树形面板：查找定位（key / 字符串值匹配）+ 查询面板（JSONPath/JMESPath）。
 * 数据源过期（文本未通过校验）时只读。
 */

const store = useJsonEditorStore()

// ── 查找定位 ────────────────────────────────────────────────────
const findText = ref('')
const matchPaths = ref<MutPath[]>([])
const matchIndex = ref(0)

const matches = computed(() => {
  const query = findText.value.trim().toLowerCase()
  if (query === '' || store.data === undefined) return []
  const out: MutPath[] = []
  walk(store.data, [], query)
  return out

  function walk(value: unknown, path: MutPath, q: string) {
    if (path.length > 0) {
      const key = path[path.length - 1]
      if (key.toLowerCase().includes(q) || (typeof value === 'string' && value.toLowerCase().includes(q))) {
        out.push(path)
      }
    }
    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        value.forEach((item, i) => walk(item, [...path, String(i)], q))
      } else {
        for (const [k, v] of Object.entries(value)) walk(v, [...path, k], q)
      }
    }
  }
})

watch(matches, (list, old) => {
  // 数据引用变化（树编辑）但匹配集相同时不重置定位，避免每次编辑都跳动
  const same =
    old !== undefined &&
    list.length === old.length &&
    list.every((p, i) => pathKey(p) === pathKey(old[i]))
  if (same) {
    matchPaths.value = list
    return
  }
  matchPaths.value = list
  matchIndex.value = 0
  if (list.length > 0) locate(list[0])
})


function step(direction: 1 | -1) {
  if (matchPaths.value.length === 0) return
  matchIndex.value = (matchIndex.value + direction + matchPaths.value.length) % matchPaths.value.length
  locate(matchPaths.value[matchIndex.value])
}

function locate(path: MutPath) {
  expandAncestors(path)
  requestAnimationFrame(() => scrollToNode(path))
}

const highlight = computed<MutPath | null>(() =>
  matchPaths.value.length > 0 ? matchPaths.value[matchIndex.value] : null,
)
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col overflow-clip rounded-panel border bg-card p-4"
    :class="store.hasData ? 'border-border' : 'border-border/60'"
  >
    <template v-if="store.hasData">
      <div class="mb-2 flex shrink-0 items-center gap-1.5">
        <NInput
          v-model:value="findText"
          size="tiny"
          class="min-w-0 flex-1 font-mono"
          placeholder="查找 key / 字符串值"
          clearable
        >
          <template #prefix>
            <NIcon :size="13" class="text-muted-foreground"><SearchOutline /></NIcon>
          </template>
        </NInput>
        <span v-if="matches.length > 0" class="shrink-0 text-xs text-muted-foreground">
          {{ matchIndex + 1 }}/{{ matches.length }}
        </span>
        <button
          type="button"
          class="shrink-0 rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-40"
          aria-label="上一个匹配"
          :disabled="matches.length === 0"
          @click="step(-1)"
        >
          <NIcon :size="14"><ArrowUpOutline /></NIcon>
        </button>
        <button
          type="button"
          class="shrink-0 rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-40"
          aria-label="下一个匹配"
          :disabled="matches.length === 0"
          @click="step(1)"
        >
          <NIcon :size="14"><ArrowDownOutline /></NIcon>
        </button>
      </div>
      <div class="mb-2 shrink-0">
        <QueryPanel />
      </div>
      <div class="min-h-0 flex-1">
        <TreeView :highlight="highlight" />
      </div>
    </template>
    <div
      v-else-if="store.dataStale"
      class="flex h-full items-center justify-center text-sm text-muted-foreground"
    >
      树形视图已暂停同步——文本重新通过校验后自动恢复
    </div>
    <div v-else class="flex h-full items-center justify-center text-sm text-muted-foreground">
      解析成功后在此编辑数据：增删改节点、拖拽排序、按键名排序
    </div>
  </div>
</template>
