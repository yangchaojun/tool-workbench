<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NDropdown, NIcon, NInput, NSelect } from 'naive-ui'
import {
  AddOutline,
  CheckmarkOutline,
  ChevronDownOutline,
  ChevronForwardOutline,
  CloseOutline,
  MoveOutline,
  PencilOutline,
  ReorderTwoOutline,
  TrashOutline,
} from '@vicons/ionicons5'

import { useJsonEditorStore } from '../stores/jsonEditor'
import { jsonValueTypeLabels, type JsonValueType } from './treeTypes'
import {
  dragState,
  expandAncestors,
  pathKey,
  pendingEdit,
  scrollToNode,
  setExpanded,
  toggleExpanded,
  treeEditSession,
  type DropMode,
  type TreeEditSession,
} from './treeState'
import { getAtPath, type JsonPath } from '../editor/mutations'
import type { TreeRow } from './treeRows'

/**
 * 树形视图的单行节点（虚拟滚动用，不递归渲染子节点——子行由
 * flattenTree 扁平化后经 NVirtualList 按视口渲染，见 ADR-0005）。
 */

const props = defineProps<{
  row: TreeRow
  /** 高亮定位的路径（查找/查询定位），null 表示无 */
  highlight: JsonPath | null
}>()

const store = useJsonEditorStore()

const kindLabel = computed(() => jsonValueTypeLabels[props.row.kind])
const isArray = computed(() => props.row.kind === 'array')
const canExpand = computed(() => props.row.isContainer)
const myKey = computed(() => props.row.key)
const highlighted = computed(
  () => props.highlight !== null && pathKey(props.highlight) === myKey.value,
)

// ── 展开态 ──────────────────────────────────────────────────────

function toggle() {
  if (!canExpand.value) return
  toggleExpanded(props.row.path, props.row.depth)
}

// ── 就地编辑（会话存模块态，滚动重挂载不丢失）────────────────────

const session = computed(() => treeEditSession.session)
const editing = computed(
  () => session.value !== null && pathKey(session.value.path) === myKey.value,
)

const typeOptions = [
  { label: '字符串', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' },
  { label: 'null', value: 'null' },
  { label: '对象', value: 'object' },
  { label: '数组', value: 'array' },
]

function startEdit() {
  if (!store.hasData || store.treeEditReadonly) return
  const v = props.row.value
  treeEditSession.session = {
    path: [...props.row.path],
    name: props.row.name,
    type: props.row.kind as JsonValueType,
    text: typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '',
    bool: v === true,
    error: null,
  }
}

function cancelEdit() {
  treeEditSession.session = null
}

function setEditBool(v: string) {
  const s = treeEditSession.session
  if (s !== null) s.bool = v === 'true'
}

function buildValue(s: TreeEditSession): unknown {
  switch (s.type) {
    case 'object':
      return {}
    case 'array':
      return []
    case 'null':
      return null
    case 'boolean':
      return s.bool
    case 'number': {
      const n = Number(s.text)
      if (s.text.trim() === '' || Number.isNaN(n)) return undefined
      return n
    }
    case 'string':
      return s.text
  }
}

function valueChanged(s: TreeEditSession): boolean {
  if (s.type !== props.row.kind) return true
  const v = props.row.value
  if (s.type === 'string') return s.text !== v
  if (s.type === 'number') return Number(s.text) !== v
  if (s.type === 'boolean') return s.bool !== v
  return false
}

function confirmEdit() {
  const s = treeEditSession.session
  if (s === null) return
  s.error = null
  const value = buildValue(s)
  if (value === undefined) {
    s.error = '数字格式不合法'
    return
  }
  const parentIsObject = !props.row.parentIsArray
  if (parentIsObject && s.name.trim() === '') {
    s.error = '键名不能为空'
    return
  }
  const keyChanged = parentIsObject && s.name !== props.row.name
  const newKey = keyChanged ? s.name : null
  const changeValue = valueChanged(s)
  if (!keyChanged && !changeValue) {
    treeEditSession.session = null
    return
  }
  const ok = store.editEntry(props.row.path, newKey, value, changeValue)
  if (!ok) {
    s.error = '键名冲突或编辑失败'
    return
  }
  treeEditSession.session = null
}

// 新增子项后自动进入编辑态
watch(
  () => pendingEdit.path,
  (p) => {
    if (p !== null && pathKey(p) === myKey.value) {
      pendingEdit.path = null
      startEdit()
    }
  },
  // 新挂载的行也要接住「添加子项后自动进入编辑」的一次性信号
  { immediate: true },
)

// ── 添加 / 删除 / 排序 ─────────────────────────────────────────

function addChild() {
  if (!props.row.isContainer || store.treeEditReadonly) return
  setExpanded(props.row.path, true)
  if (isArray.value) {
    const index = (props.row.value as unknown[]).length
    if (store.addArrayChild(props.row.path, null)) {
      pendingEdit.path = [...props.row.path, String(index)]
    }
  } else {
    const key = store.nextKeyFor(props.row.path)
    if (key === null) return
    if (store.addObjectChild(props.row.path, key, null)) {
      pendingEdit.path = [...props.row.path, key]
    }
  }
}

function removeSelf() {
  store.removeNode(props.row.path)
}

const sortOptions = [
  { label: '按 key 排序（仅本层）', key: 'level' },
  { label: '按 key 排序（含子孙递归）', key: 'recursive' },
]

function onSort(key: string | number) {
  void store.sortKeys(props.row.path, key === 'recursive')
}

// ── 拖拽 ────────────────────────────────────────────────────────
const rowEl = ref<HTMLElement | null>(null)

function onDragStart(event: DragEvent) {
  if (props.row.path.length === 0 || store.treeEditReadonly) {
    event.preventDefault()
    return
  }
  dragState.from = props.row.path
  event.dataTransfer?.setData('text/plain', myKey.value)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  dragState.from = null
  dragState.target = null
}

/** 计算本行的落点模式 */
function computeDropMode(event: DragEvent): DropMode {
  if (props.row.isContainer && !props.row.open) return 'inside'
  const rect = rowEl.value!.getBoundingClientRect()
  const ratio = (event.clientY - rect.top) / rect.height
  if (props.row.isContainer) {
    // 展开的容器：上半部插到容器之前，下半部落入容器内（追加）
    return ratio < 0.5 ? 'before' : 'inside'
  }
  return ratio < 0.5 ? 'before' : 'after'
}

function onDragOver(event: DragEvent) {
  if (dragState.from === null) return
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragState.target = { path: props.row.path, mode: computeDropMode(event) }
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  const from = dragState.from
  const mode = dragState.target !== null && pathKey(dragState.target.path) === myKey.value
    ? dragState.target.mode
    : computeDropMode(event)
  dragState.from = null
  dragState.target = null
  if (from === null) return
  dropNode(from, mode)
}

function dropNode(from: JsonPath, mode: DropMode) {
  if (pathKey(from) === myKey.value) return
  let toParent: JsonPath
  let index: number
  if (mode === 'inside') {
    toParent = props.row.path
    const container = getAtPath(store.data, toParent)
    index =
      container !== null && typeof container === 'object'
        ? Object.keys(container as object).length
        : 0
  } else {
    const parentPath = props.row.path.slice(0, -1)
    const parent = getAtPath(store.data, parentPath)
    if (parent === null || typeof parent !== 'object') return
    const keys = Array.isArray(parent)
      ? parent.map((_, i) => String(i))
      : Object.keys(parent)
    const pos = keys.indexOf(props.row.name)
    if (pos < 0) return
    index = mode === 'before' ? pos : pos + 1
    toParent = parentPath
  }
  // 同容器相邻位置 = 无操作
  const sameParent =
    from.length === toParent.length + 1 &&
    from.slice(0, -1).every((seg, i) => seg === toParent[i])
  if (sameParent) {
    const fromPos = isArrayParent(toParent)
      ? Number(from[from.length - 1])
      : objectKeyPosition(toParent, from[from.length - 1])
    if (fromPos === index || fromPos === index - 1) return
  }
  const newPath = store.moveNodeAction({ from, toParent, index })
  if (newPath !== null) {
    // 跟随节点落位：展开目标祖先并滚动
    expandAncestors(newPath)
    requestAnimationFrame(() => scrollToNode(newPath))
  }
}

function isArrayParent(parentPath: JsonPath): boolean {
  return Array.isArray(getAtPath(store.data, parentPath))
}

function objectKeyPosition(parentPath: JsonPath, key: string): number {
  const parent = getAtPath(store.data, parentPath)
  if (parent === null || typeof parent !== 'object') return -1
  return Object.keys(parent).indexOf(key)
}

const dropHint = computed<DropMode | null>(() => {
  if (dragState.target === null) return null
  return pathKey(dragState.target.path) === myKey.value ? dragState.target.mode : null
})

// ── 值预览 ──────────────────────────────────────────────────────
const preview = computed(() => {
  const v = props.row.value
  if (typeof v === 'string') {
    const quoted = `"${v}"`
    return quoted.length > 80 ? `${quoted.slice(0, 79)}…` : quoted
  }
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
})
const previewTitle = computed(() =>
  typeof props.row.value === 'string' ? `"${props.row.value}"` : '',
)
const lengthLabel = computed(() =>
  props.row.isContainer ? `${props.row.childCount} 项` : '',
)
/** 值预览按 JSON 类型接四色语法 token（MASTER.md「JSON / Code Syntax Colors」） */
const previewClass = computed(() => {
  const v = props.row.value
  if (typeof v === 'string') return 'text-json-string'
  if (typeof v === 'number') return 'text-json-number'
  if (typeof v === 'boolean') return 'text-json-boolean'
  if (v === null) return 'text-json-null'
  return ''
})
</script>

<template>
  <div
    ref="rowEl"
    class="tree-node group relative flex min-h-[26px] items-center gap-1 rounded px-1 py-0.5 font-mono text-json transition-colors"
    :class="{
      'hover:bg-muted': dropHint === null && !highlighted,
      'bg-accent-50': highlighted,
      'ring-1 ring-accent': dropHint === 'inside',
      'border-t-2 border-t-accent': dropHint === 'before',
      'border-b-2 border-b-accent': dropHint === 'after',
    }"
    :style="{ paddingLeft: `${row.depth * 14 + 2}px` }"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <!-- 折叠开关 -->
    <button
      v-if="canExpand"
      type="button"
      class="grid size-6 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground transition-colors duration-150 hover:text-foreground"
      :aria-expanded="row.open"
      :aria-label="row.open ? '折叠' : '展开'"
      @click="toggle"
    >
      <NIcon :size="13">
        <ChevronDownOutline v-if="row.open" />
        <ChevronForwardOutline v-else />
      </NIcon>
    </button>
    <span v-else class="inline-block size-6 shrink-0" />

    <!-- 拖拽把手 -->
    <button
      v-if="row.path.length > 0 && !store.treeEditReadonly"
      type="button"
      class="grid size-6 shrink-0 cursor-grab place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
      aria-label="拖拽移动"
      draggable="true"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
    >
      <NIcon :size="13"><MoveOutline /></NIcon>
    </button>

    <!-- 就地编辑态 -->
    <div v-if="editing && session !== null" class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
      <NInput
        v-if="!row.parentIsArray"
        v-model:value="session.name"
        size="tiny"
        placeholder="键名"
        class="w-32 font-mono"
        @keydown.enter="confirmEdit"
        @keydown.esc="cancelEdit"
      />
      <NSelect
        v-model:value="session.type"
        size="tiny"
        :options="typeOptions"
        style="width: 6rem"
        :consistent-menu-width="false"
      />
      <NInput
        v-if="session.type === 'string' || session.type === 'number'"
        v-model:value="session.text"
        size="tiny"
        class="min-w-24 flex-1 font-mono"
        :placeholder="session.type === 'number' ? '数字' : '字符串'"
        @keydown.enter="confirmEdit"
        @keydown.esc="cancelEdit"
      />
      <NSelect
        v-else-if="session.type === 'boolean'"
        :value="session.bool ? 'true' : 'false'"
        size="tiny"
        style="width: 6rem"
        :consistent-menu-width="false"
        :options="[
          { label: 'true', value: 'true' },
          { label: 'false', value: 'false' },
        ]"
        @update:value="setEditBool"
      />
      <span v-if="session.error !== null" class="text-xs text-destructive">
        {{ session.error }}
      </span>
      <button
        type="button"
        class="grid size-6 place-items-center rounded text-accent transition-colors duration-150 hover:bg-muted"
        aria-label="确认"
        @click="confirmEdit"
      >
        <NIcon :size="14"><CheckmarkOutline /></NIcon>
      </button>
      <button
        type="button"
        class="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground"
        aria-label="取消"
        @click="cancelEdit"
      >
        <NIcon :size="14"><CloseOutline /></NIcon>
      </button>
    </div>

    <!-- 展示态 -->
    <div v-else class="min-w-0 flex-1 truncate">
      <span v-if="row.parentIsArray" class="text-muted-foreground">{{ row.name }}</span>
      <span v-else class="font-medium text-foreground" :title="row.name">"{{ row.name }}"</span>
      <span class="text-muted-foreground">:&nbsp;</span>

      <template v-if="row.isContainer">
        <template v-if="row.open">
          <span class="text-muted-foreground">{{ isArray ? '[' : '{' }}</span>
        </template>
        <template v-else>
          <button
            type="button"
            class="cursor-pointer text-foreground hover:underline"
            @click="toggle"
          >
            {{ isArray ? '[…]' : '{…}' }}
          </button>
          <span class="ml-1.5 select-none text-xs text-muted-foreground">{{ lengthLabel }}</span>
        </template>
      </template>

      <span v-else :title="previewTitle" :class="previewClass">{{ preview }}</span>

      <span
        class="ml-1.5 select-none text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
      >
        {{ kindLabel }}<template v-if="lengthLabel"> · {{ lengthLabel }}</template>
      </span>
    </div>

    <!-- 悬停操作 -->
    <div
      v-if="!editing && !store.treeEditReadonly"
      class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
    >
      <button
        type="button"
        class="grid size-6 place-items-center rounded text-muted-foreground transition-colors duration-150 hover:text-accent"
        :title="row.isContainer ? '添加子项' : '编辑'"
        :aria-label="row.isContainer ? '添加子项' : '编辑'"
        @click="row.isContainer ? addChild() : startEdit()"
      >
        <NIcon :size="13"><AddOutline v-if="row.isContainer" /><PencilOutline v-else /></NIcon>
      </button>
      <button
        v-if="row.isContainer"
        type="button"
        class="grid size-6 place-items-center rounded text-muted-foreground transition-colors duration-150 hover:text-accent"
        aria-label="编辑"
        @click="startEdit"
      >
        <NIcon :size="13"><PencilOutline /></NIcon>
      </button>
      <NDropdown
        v-if="row.kind === 'object'"
        trigger="click"
        :options="sortOptions"
        @select="onSort"
      >
        <button
          type="button"
          class="grid size-6 place-items-center rounded text-muted-foreground transition-colors duration-150 hover:text-accent"
          aria-label="排序"
        >
          <NIcon :size="13"><ReorderTwoOutline /></NIcon>
        </button>
      </NDropdown>
      <button
        v-if="row.path.length > 0"
        type="button"
        class="grid size-6 place-items-center rounded text-muted-foreground transition-colors duration-150 hover:text-destructive"
        aria-label="删除"
        @click="removeSelf"
      >
        <NIcon :size="13"><TrashOutline /></NIcon>
      </button>
    </div>
  </div>
</template>
