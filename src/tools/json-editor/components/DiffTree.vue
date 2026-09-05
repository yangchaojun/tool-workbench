<script setup lang="ts">
import { computed, ref } from 'vue'
import { NIcon } from 'naive-ui'
import { ChevronDownOutline, ChevronForwardOutline } from '@vicons/ionicons5'

import { jsonValueType, jsonValueTypeLabels } from './treeTypes'
import type { DiffNode } from '../diff/diff'

/**
 * Diff 结果树：equal 容器默认折叠，含差异的容器默认展开。
 * 新增=绿、删除=红（删除线）、修改=琥珀、类型变更额外标注。
 */

const props = defineProps<{
  node: DiffNode
  depth: number
}>()

const hasChildren = computed(() => props.node.children.length > 0)
const defaultOpen = computed(() =>
  props.node.children.some((c) => c.status !== 'equal') || props.depth === 0,
)
const open = ref(defaultOpen.value)

const kindLeft = computed(() =>
  props.node.leftType !== null ? jsonValueTypeLabels[props.node.leftType] : '',
)
const kindRight = computed(() =>
  props.node.rightType !== null ? jsonValueTypeLabels[props.node.rightType] : '',
)

const statusMark = computed(() => {
  switch (props.node.status) {
    case 'added':
      return '+'
    case 'removed':
      return '−'
    case 'changed':
      return '~'
    default:
      return ''
  }
})

const rowClass = computed(() => {
  switch (props.node.status) {
    case 'added':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    case 'removed':
      return 'bg-red-500/10 text-red-600 line-through decoration-red-400/70 dark:text-red-400'
    case 'changed':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
    default:
      return ''
  }
})

function preview(value: unknown): string {
  if (typeof value === 'string') {
    const quoted = `"${value}"`
    return quoted.length > 60 ? `${quoted.slice(0, 59)}…` : quoted
  }
  if (value === null || typeof value !== 'object') return String(value)
  const kind = jsonValueType(value)
  if (kind === 'object') return `{…} ${Object.keys(value).length} 个键`
  return `[…] ${(value as unknown[]).length} 项`
}
</script>

<template>
  <div class="diff-node font-mono text-[13px] leading-6">
    <div
      class="group flex items-start gap-1 rounded px-1 hover:bg-primary-soft/40"
      :class="rowClass"
      :style="{ paddingLeft: `${depth * 14 + 2}px` }"
    >
      <button
        v-if="hasChildren"
        type="button"
        class="mt-0.5 shrink-0 cursor-pointer rounded p-0.5 text-ink-muted hover:text-ink"
        :aria-label="open ? '折叠' : '展开'"
        @click="open = !open"
      >
        <NIcon :size="13">
          <ChevronDownOutline v-if="open" />
          <ChevronForwardOutline v-else />
        </NIcon>
      </button>
      <span v-else class="inline-block w-[18px] shrink-0" />

      <span
        v-if="statusMark !== ''"
        class="mt-0.5 w-4 shrink-0 select-none text-center font-bold"
      >{{ statusMark }}</span>
      <span v-else class="w-4 shrink-0" />

      <div class="min-w-0 flex-1 break-all">
        <span v-if="depth === 0" class="text-ink-muted">(根)</span>
        <template v-else>
          <span class="text-primary-strong">"{{ node.key }}"</span>
          <span class="text-ink-muted">:&nbsp;</span>
        </template>

        <template v-if="hasChildren && open">
          <span class="text-ink-muted">{{ node.leftType !== null || node.rightType !== null ? '' : Array.isArray(node.left) ? '[' : '{' }}</span>
        </template>
        <template v-else-if="hasChildren">
          <span class="text-ink-muted">{{ Array.isArray(node.left) || Array.isArray(node.right) ? '[…]' : '{…}' }}</span>
        </template>
        <template v-else-if="node.typeChanged">
          <span class="text-ink-muted">{{ kindLeft }} → </span>
          <span>{{ preview(node.right) }}</span>
          <span class="ml-1 text-xs text-ink-muted">（{{ kindLeft }} 改为 {{ kindRight }}）</span>
        </template>
        <template v-else>
          <span>{{ preview(node.status === 'removed' ? node.left : node.right) }}</span>
          <span v-if="node.status === 'changed'" class="ml-1 text-xs text-ink-muted" :title="preview(node.left)">
            原值：{{ preview(node.left) }}
          </span>
        </template>
      </div>
    </div>

    <template v-if="hasChildren && open">
      <DiffTree v-for="child in node.children" :key="child.key" :node="child" :depth="depth + 1" />
      <div
        class="text-ink-muted"
        :style="{ paddingLeft: `${depth * 14 + 2}px` }"
      >
        {{ Array.isArray(node.left) ? ']' : '}' }}
      </div>
    </template>
  </div>
</template>
