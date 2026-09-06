<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { NVirtualList } from 'naive-ui'
import type { VirtualListInst } from 'naive-ui'

import TreeRow from './TreeRow.vue'
import { flattenTree } from './treeRows'
import {
  expandAll,
  collapseAll,
  isExpanded,
  pathKey,
  setScrollToHandler,
  expandVersion,
} from './treeState'
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

/**
 * 可见行（含展开容器内的全部子行与闭合/空行）。
 * 读 expandVersion：expandAll 写入的深层路径不在既有依赖内，需版本号兜底重算。
 */
const rows = computed(() => {
  void expandVersion.value
  return flattenTree(store.data, isExpanded)
})

const virtualListRef = ref<VirtualListInst | null>(null)

/** 查找/查询/拖拽落位定位：展开态已就绪，按行索引滚动虚拟列表 */
function handleScrollTo(path: JsonPath) {
  const index = rows.value.findIndex((r) => r.type === 'node' && r.key === pathKey(path))
  if (index >= 0) virtualListRef.value?.scrollTo({ index })
}
onMounted(() => setScrollToHandler(handleScrollTo))
onBeforeUnmount(() => setScrollToHandler(null))
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="mb-2 flex shrink-0 items-center justify-between gap-2">
      <span class="truncate text-xs text-ink-muted">根：{{ rootSummary }}</span>
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          class="rounded px-1.5 py-0.5 text-xs text-ink-muted transition-colors hover:text-ink"
          @click="expandAll(store.data)"
        >
          全部展开
        </button>
        <button
          type="button"
          class="rounded px-1.5 py-0.5 text-xs text-ink-muted transition-colors hover:text-ink"
          @click="collapseAll()"
        >
          全部折叠
        </button>
      </div>
    </div>
    <div
      v-if="store.treeEditReadonly"
      class="mb-2 shrink-0 rounded bg-primary-soft/40 px-2 py-1 text-xs text-ink-muted"
    >
      文档较大，树形编辑已降级为只读（可在文本视图中修改）
    </div>
    <!-- 渲染层虚拟滚动（ADR-0005）：一次性完整解析的数据源不变，只渲染视口内节点 -->
    <NVirtualList
      ref="virtualListRef"
      :items="rows"
      :item-size="24"
      item-resizable
      class="min-h-0 flex-1"
    >
      <template #default="{ item }">
        <div
          v-if="item.type === 'close'"
          class="font-mono text-[13px] leading-6 text-ink-muted"
          :style="{ paddingLeft: `${item.depth * 14 + 2}px` }"
        >
          {{ item.name }}
        </div>
        <div
          v-else-if="item.type === 'empty'"
          class="font-mono text-[13px] italic leading-6 text-ink-muted"
          :style="{ paddingLeft: `${item.depth * 14 + 34}px` }"
        >
          {{ item.name }}
        </div>
        <TreeRow v-else :row="item" :highlight="highlight" />
      </template>
    </NVirtualList>
  </div>
</template>
