<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NIcon } from 'naive-ui'
import { ChevronDownOutline, ChevronForwardOutline } from '@vicons/ionicons5'

import {
  CHILDREN_RENDER_CAP,
  DEPTH_RENDER_CAP,
  jsonValueTypeLabels,
  jsonValueType,
  type TreeCommand,
} from './treeTypes'

const props = defineProps<{
  name: string
  value: unknown
  depth: number
  command: TreeCommand | null
}>()

const isContainer = computed(() => {
  const kind = jsonValueType(props.value)
  return kind === 'object' || kind === 'array'
})
const isArray = computed(() => jsonValueType(props.value) === 'array')

const kindLabel = computed(() => jsonValueTypeLabels[jsonValueType(props.value)])

const entries = computed<Array<{ key: string; value: unknown }>>(() => {
  const v = props.value
  if (v === null || typeof v !== 'object') return []
  return isArray.value
    ? (v as unknown[]).map((value, index) => ({ key: String(index), value }))
    : Object.entries(v as Record<string, unknown>).map(([key, value]) => ({ key, value }))
})

const lengthLabel = computed(() => {
  if (!isContainer.value) return ''
  return `${entries.value.length} 项`
})

// 深度护栏：超过即渲染为「停止展开」的叶子
const depthCapped = computed(() => isContainer.value && props.depth >= DEPTH_RENDER_CAP)
const canExpand = computed(() => isContainer.value && !depthCapped.value)

const open = ref(props.depth < 2)
watch(
  () => props.command,
  (cmd) => {
    if (cmd !== null && canExpand.value) open.value = cmd.kind === 'expand'
  },
)

function toggle() {
  if (canExpand.value) open.value = !open.value
}

const visibleEntries = computed(() => entries.value.slice(0, CHILDREN_RENDER_CAP))
const hiddenCount = computed(() =>
  Math.max(0, entries.value.length - CHILDREN_RENDER_CAP),
)

// 基本类型值的行内预览：长字符串截断，完整内容放 title
const preview = computed(() => {
  const v = props.value
  if (typeof v === 'string') {
    const quoted = `"${v}"`
    return quoted.length > 80 ? `${quoted.slice(0, 79)}…` : quoted
  }
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
})

const previewTitle = computed(() =>
  typeof props.value === 'string' ? `"${props.value}"` : '',
)
</script>

<template>
  <div class="tree-node font-mono text-[13px] leading-6">
    <div
      class="group flex items-start gap-1 rounded px-1 hover:bg-primary-soft/40"
      :style="{ paddingLeft: `${depth * 14 + 2}px` }"
    >
      <!-- 折叠开关（容器且有展开余量） -->
      <button
        v-if="canExpand"
        type="button"
        class="mt-0.5 shrink-0 cursor-pointer rounded p-0.5 text-ink-muted transition-colors hover:text-ink"
        :aria-expanded="open"
        :aria-label="open ? '折叠' : '展开'"
        @click="toggle"
      >
        <NIcon :size="13">
          <ChevronDownOutline v-if="open" />
          <ChevronForwardOutline v-else />
        </NIcon>
      </button>
      <span v-else class="inline-block w-[18px] shrink-0" />

      <div class="min-w-0 flex-1 whitespace-pre-wrap break-all">
        <span class="text-primary-strong" :title="name">"{{ name }}"</span>
        <span class="text-ink-muted">:&nbsp;</span>

        <!-- 容器：折叠态显示摘要，展开态渲染子节点 -->
        <template v-if="isContainer">
          <template v-if="open && !depthCapped">
            <span class="text-ink-muted">{{ isArray ? '[' : '{' }}</span>
          </template>
          <template v-else>
            <button
              v-if="!depthCapped"
              type="button"
              class="cursor-pointer text-ink hover:underline"
              @click="toggle"
            >
              {{ isArray ? '[…]' : '{…}' }}
            </button>
            <span v-else class="text-ink-muted italic">嵌套超过 {{ DEPTH_RENDER_CAP }} 层，已停止展开</span>
            <span class="ml-1.5 select-none text-xs text-ink-muted">{{ lengthLabel }}</span>
          </template>
        </template>

        <!-- 基本类型：行内预览 -->
        <span v-else :title="previewTitle" class="text-accent">{{ preview }}</span>

        <!-- 悬停徽标：类型 + 长度 -->
        <span
          class="ml-1.5 select-none text-xs text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
        >
          {{ kindLabel }}<template v-if="lengthLabel"> · {{ lengthLabel }}</template>
        </span>
      </div>
    </div>

    <!-- 子节点 -->
    <template v-if="isContainer && open && !depthCapped">
      <TreeNode
        v-for="entry in visibleEntries"
        :key="entry.key"
        :name="entry.key"
        :value="entry.value"
        :depth="depth + 1"
        :command="command"
      />
      <div
        v-if="hiddenCount > 0"
        class="py-0.5 text-ink-muted italic"
        :style="{ paddingLeft: `${(depth + 1) * 14 + 34}px` }"
      >
        …其余 {{ hiddenCount }} 项已省略
      </div>
      <div v-if="hiddenCount === 0 && entries.length === 0" class="text-ink-muted italic" :style="{ paddingLeft: `${(depth + 1) * 14 + 34}px` }">
        {{ isArray ? '空数组' : '空对象' }}
      </div>
      <div class="text-ink-muted" :style="{ paddingLeft: `${depth * 14 + 2}px` }">
        {{ isArray ? ']' : '}' }}
      </div>
    </template>
  </div>
</template>
