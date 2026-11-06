<script setup lang="ts">
import { computed, ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'

import type { GraphEntry, GraphNodeModel } from './buildGraph'

/**
 * 图谱卡片节点：对象/数组渲染为行列表（与树形视图同款语法四色）。
 * 容器行点击展开/收起子卡片；标量行点击复制 key（对齐 TreeRow 的交互约定）。
 * 行高严格 28px——layout.ts 的 nodeHeight 依赖它保证连线锚点对位。
 */

const props = defineProps<{ model: GraphNodeModel }>()

const emit = defineEmits<{ toggle: [entry: GraphEntry] }>()

const isRoot = computed(() => props.model.path.length === 0)

/** 空容器 / 空根的占位文案（与树形视图「空对象 / 空数组」一致） */
const emptyLabel = computed(() => (props.model.type === 'array' ? '空数组' : '空对象'))

function badge(entry: GraphEntry): string {
  if (entry.childCount === 0) return entry.containerType === 'array' ? '[]' : '{}'
  return entry.containerType === 'array' ? `[${entry.childCount}]` : `{${entry.childCount}}`
}

const tailLabel = computed(() =>
  props.model.truncatedRows ? `… 还有 ${props.model.totalEntries - props.model.entries.length} 项` : '',
)

// ── 点击复制 key（TreeRow 同款瞬时反馈）────────────────────────
const copiedKey = ref<string | null>(null)
let copiedTimer: number | undefined

async function copyKey(entry: GraphEntry) {
  try {
    await navigator.clipboard.writeText(entry.key)
    copiedKey.value = entry.key
  } catch {
    copiedKey.value = null
  }
  window.clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => {
    copiedKey.value = null
  }, 1500)
}

function onScalarRowClick(entry: GraphEntry) {
  void copyKey(entry)
}

function onContainerRowClick(entry: GraphEntry) {
  if (entry.childCount === 0) return
  emit('toggle', entry)
}
</script>

<template>
  <div class="h-full w-full overflow-clip rounded-md border border-border bg-card font-mono text-xs shadow-card">
    <Handle v-if="!isRoot" type="target" :position="Position.Left" class="graph-card-handle" />
    <Handle type="source" :position="Position.Right" class="graph-card-handle" />

    <!-- 标量根：单行值 -->
    <div v-if="model.type === 'root-scalar'" class="flex h-7 items-center justify-end px-3">
      <span class="truncate text-json-number" :title="model.scalarPreview ?? ''">
        {{ model.scalarPreview }}
      </span>
    </div>

    <template v-else>
      <div v-if="model.entries.length === 0" class="flex h-7 items-center px-3 text-mute">
        {{ emptyLabel }}
      </div>
      <template v-for="entry in model.entries" :key="entry.key">
        <!-- 容器行：点击展开/收起子卡片 -->
        <button
          v-if="entry.containerType !== null"
          type="button"
          class="group flex h-7 w-full items-center justify-between gap-3 px-3 text-left transition-colors duration-150"
          :class="entry.childCount > 0 ? 'cursor-pointer hover:bg-muted' : 'cursor-default'"
          :title="entry.key"
          @click.stop="onContainerRowClick(entry)"
        >
          <span class="min-w-0 truncate group-hover:text-foreground" :class="entry.childId !== null ? 'text-accent' : 'text-foreground'">
            {{ entry.key }}
            <span v-if="copiedKey === entry.key" class="ml-1 text-accent">已复制 ✓</span>
          </span>
          <span
            class="shrink-0 font-medium"
            :class="entry.childId !== null ? 'text-accent' : 'text-mute'"
          >
            {{ badge(entry) }}
          </span>
        </button>
        <!-- 标量行：点击复制 key -->
        <div
          v-else
          class="flex h-7 w-full cursor-pointer items-center justify-between gap-3 px-3 hover:bg-muted"
          :title="entry.key"
          @click.stop="onScalarRowClick(entry)"
        >
          <span class="min-w-0 truncate text-foreground">
            {{ entry.key }}
            <span v-if="copiedKey === entry.key" class="ml-1 text-accent">已复制 ✓</span>
          </span>
          <span
            class="min-w-0 max-w-[62%] truncate"
            :class="{
              'text-json-string': entry.kind === 'string',
              'text-json-number': entry.kind === 'number',
              'text-json-boolean': entry.kind === 'boolean',
              'text-json-null': entry.kind === 'null',
            }"
          >
            {{ entry.value }}
          </span>
        </div>
      </template>
      <!-- 行数截断尾行 -->
      <div v-if="model.truncatedRows" class="flex h-7 items-center px-3 text-mute">
        {{ tailLabel }}
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 连接点：弱化为边缘小圆点，不参与视觉焦点 */
.graph-card-handle {
  width: 7px;
  height: 7px;
  border: 1px solid var(--color-border-hover);
  background: var(--color-card);
}
</style>
