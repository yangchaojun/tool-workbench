<script setup lang="ts">
import { computed, ref } from 'vue'

import TreeNode from './TreeNode.vue'
import { collapseAll, expandAll } from './treeState'
import { useJsonEditorStore } from '../stores/jsonEditor'
import { jsonValueType, jsonValueTypeLabels } from './treeTypes'
import type { JsonPath } from '../editor/mutations'

const props = defineProps<{
  /** 高亮定位的路径（查找/查询定位），null 表示无 */
  highlight: JsonPath | null
}>()

const store = useJsonEditorStore()

const rootSummary = computed(() => {
  const v = store.data
  const kind = jsonValueType(v)
  if (kind === 'object') return `对象 · ${Object.keys(v as object).length} 个键`
  if (kind === 'array') return `数组 · ${(v as unknown[]).length} 项`
  if (kind === 'string') return `字符串 · ${(v as string).length} 字符`
  return jsonValueTypeLabels[kind]
})

function onExpandAll() {
  expandAll(store.data)
  // 触发整树刷新展开态：数据引用未变，靠重新挂载刷新（用 toggle key 不可行，
  // 直接遍历展开态即可——TreeNode 在展开态变化时通过自身 watch 同步）
  forceRefresh.value += 1
}
const forceRefresh = ref(0)

function onCollapseAll() {
  collapseAll()
  forceRefresh.value += 1
}

</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="mb-2 flex shrink-0 items-center justify-between gap-2">
      <span class="truncate text-xs text-ink-muted">根：{{ rootSummary }}</span>
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          class="rounded px-1.5 py-0.5 text-xs text-ink-muted transition-colors hover:text-ink"
          @click="onExpandAll"
        >
          全部展开
        </button>
        <button
          type="button"
          class="rounded px-1.5 py-0.5 text-xs text-ink-muted transition-colors hover:text-ink"
          @click="onCollapseAll"
        >
          全部折叠
        </button>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-auto pr-1">
      <TreeNode
        :key="`root-${forceRefresh}`"
        name="(根)"
        :path="[]"
        :value="store.data"
        :depth="0"
        :parent-is-array="false"
        :highlight="highlight"
      />
    </div>
  </div>
</template>
