<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton } from 'naive-ui'

import TreeNode from './TreeNode.vue'
import {
  jsonValueType,
  jsonValueTypeLabels,
  type TreeCommand,
} from './treeTypes'

const props = defineProps<{
  /** 最近一次合法解析的数据（undefined 表示尚无可浏览内容） */
  data: unknown
}>()

// 数据引用变化即整树重置（key 重建，展开态回到「默认展开前 2 层」）
const version = ref(0)
watch(
  () => props.data,
  () => {
    version.value += 1
    command.value = null
  },
)

const command = ref<TreeCommand | null>(null)
let seq = 0
function broadcast(kind: 'expand' | 'collapse') {
  seq += 1
  command.value = { kind, seq }
}

const rootSummary = computed(() => {
  const v = props.data
  const kind = jsonValueType(v)
  if (kind === 'object') return `对象 · ${Object.keys(v as object).length} 个键`
  if (kind === 'array') return `数组 · ${(v as unknown[]).length} 项`
  if (kind === 'string') return `字符串 · ${(v as string).length} 字符`
  return jsonValueTypeLabels[kind]
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="mb-2 flex shrink-0 items-center justify-between gap-2">
      <span class="truncate text-xs text-ink-muted">根：{{ rootSummary }}</span>
      <div class="flex shrink-0 items-center gap-1">
        <NButton size="tiny" quaternary @click="broadcast('expand')">全部展开</NButton>
        <NButton size="tiny" quaternary @click="broadcast('collapse')">全部折叠</NButton>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-auto pr-1">
      <TreeNode :key="version" name="(根)" :value="data" :depth="0" :command="command" />
    </div>
  </div>
</template>
