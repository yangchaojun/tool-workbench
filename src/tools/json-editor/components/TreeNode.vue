<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NDropdown, NIcon, NInput, NSelect } from 'naive-ui'
import {
  AddOutline,
  ChevronDownOutline,
  ChevronForwardOutline,
  CloseOutline,
  CheckmarkOutline,
  MoveOutline,
  PencilOutline,
  ReorderTwoOutline,
  TrashOutline,
} from '@vicons/ionicons5'

import { useJsonEditorStore } from '../stores/jsonEditor'
import {
  CHILDREN_RENDER_CAP,
  DEPTH_RENDER_CAP,
  jsonValueType,
  jsonValueTypeLabels,
  type JsonValueType,
} from './treeTypes'
import {
  dragState,
  expandAncestors,
  isExpanded,
  pathKey,
  pendingEdit,
  registerNodeEl,
  scrollToNode,
  setExpanded,
  toggleExpanded,
  unregisterNodeEl,
  type DropMode,
} from './treeState'
import { getAtPath, type JsonPath } from '../editor/mutations'

const props = defineProps<{
  name: string
  path: JsonPath
  value: unknown
  depth: number
  /** 父容器是否数组（数组子项显示索引而非引号键名） */
  parentIsArray: boolean
  /** 高亮定位的路径（查找/查询定位） */
  highlight: JsonPath | null
}>()

const store = useJsonEditorStore()

const kind = computed(() => jsonValueType(props.value))
const isContainer = computed(() => kind.value === 'object' || kind.value === 'array')
const isArray = computed(() => kind.value === 'array')
const kindLabel = computed(() => jsonValueTypeLabels[kind.value])
const myKey = computed(() => pathKey(props.path))
const highlighted = computed(
  () => props.highlight !== null && pathKey(props.highlight) === myKey.value,
)

// ── 渲染护栏 ────────────────────────────────────────────────────
const depthCapped = computed(() => isContainer.value && props.depth >= DEPTH_RENDER_CAP)
const canExpand = computed(() => isContainer.value && !depthCapped.value)

const entries = computed<Array<{ key: string; value: unknown }>>(() => {
  const v = props.value
  if (v === null || typeof v !== 'object') return []
  return isArray.value
    ? (v as unknown[]).map((value, index) => ({ key: String(index), value }))
    : Object.entries(v as Record<string, unknown>).map(([key, value]) => ({ key, value }))
})

const showAll = ref(false)
const visibleEntries = computed(() =>
  showAll.value ? entries.value : entries.value.slice(0, CHILDREN_RENDER_CAP),
)
const hiddenCount = computed(() =>
  Math.max(0, entries.value.length - CHILDREN_RENDER_CAP),
)

// ── 展开态 ──────────────────────────────────────────────────────
const open = ref(isExpanded(props.path, props.depth))
watch(
  () => [myKey.value, props.depth] as const,
  () => {
    open.value = isExpanded(props.path, props.depth)
  },
)

function toggle() {
  if (!canExpand.value) return
  open.value = toggleExpanded(props.path, props.depth)
}

// ── 就地编辑 ────────────────────────────────────────────────────
const editing = ref(false)
const editKey = ref('')
const editType = ref<JsonValueType>('string')
const editText = ref('')
const editBool = ref(false)
const editError = ref<string | null>(null)

const typeOptions = [
  { label: '字符串', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' },
  { label: 'null', value: 'null' },
  { label: '对象', value: 'object' },
  { label: '数组', value: 'array' },
]

const parentIsObject = computed(() => !props.parentIsArray)

function startEdit() {
  if (!store.hasData) return
  editError.value = null
  editType.value = kind.value
  if (typeof props.value === 'string') editText.value = props.value
  else if (typeof props.value === 'number') editText.value = String(props.value)
  else editText.value = ''
  editBool.value = props.value === true
  editKey.value = props.name
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  editError.value = null
}

function buildValue(): unknown {
  switch (editType.value) {
    case 'object':
      return {}
    case 'array':
      return []
    case 'null':
      return null
    case 'boolean':
      return editBool.value
    case 'number': {
      const n = Number(editText.value)
      if (editText.value.trim() === '' || Number.isNaN(n)) return undefined
      return n
    }
    case 'string':
      return editText.value
  }
}

function confirmEdit() {
  editError.value = null
  const value = buildValue()
  if (value === undefined) {
    editError.value = '数字格式不合法'
    return
  }
  if (parentIsObject.value && editKey.value.trim() === '') {
    editError.value = '键名不能为空'
    return
  }
  const keyChanged = parentIsObject.value && editKey.value !== props.name
  const newKey = keyChanged ? editKey.value : null
  if (!keyChanged && !valueChanged()) {
    editing.value = false
    return
  }
  const ok = store.editEntry(props.path, newKey, value, valueChanged())
  if (!ok) {
    editError.value = '键名冲突或编辑失败'
    return
  }
  editing.value = false
}

function valueChanged(): boolean {
  if (editType.value !== kind.value) return true
  if (editType.value === 'string') return editText.value !== props.value
  if (editType.value === 'number') return Number(editText.value) !== props.value
  if (editType.value === 'boolean') return editBool.value !== props.value
  return false
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
)

// ── 添加 / 删除 / 排序 ─────────────────────────────────────────

function addChild() {
  if (!isContainer.value || depthCapped.value) return
  setExpanded(props.path, true)
  open.value = true
  if (isArray.value) {
    const index = (props.value as unknown[]).length
    if (store.addArrayChild(props.path, null)) {
      pendingEdit.path = [...props.path, String(index)]
    }
  } else {
    const key = store.nextKeyFor(props.path)
    if (key === null) return
    if (store.addObjectChild(props.path, key, null)) {
      pendingEdit.path = [...props.path, key]
    }
  }
}

function removeSelf() {
  store.removeNode(props.path)
}

const sortOptions = [
  { label: '按 key 排序（仅本层）', key: 'level' },
  { label: '按 key 排序（含子孙递归）', key: 'recursive' },
]

function onSort(key: string | number) {
  void store.sortKeys(props.path, key === 'recursive')
}

// ── 拖拽 ────────────────────────────────────────────────────────
const rowEl = ref<HTMLElement | null>(null)

onMounted(() => {
  if (rowEl.value !== null) registerNodeEl(myKey.value, rowEl.value)
})
onBeforeUnmount(() => unregisterNodeEl(myKey.value))
watch(myKey, (key) => {
  if (rowEl.value !== null) registerNodeEl(key, rowEl.value)
})

function onDragStart(event: DragEvent) {
  if (props.path.length === 0) {
    event.preventDefault()
    return
  }
  dragState.from = props.path
  event.dataTransfer?.setData('text/plain', myKey.value)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  dragState.from = null
  dragState.target = null
}

/** 计算本行的落点模式 */
function computeDropMode(event: DragEvent): DropMode {
  if (isContainer.value && !open.value) return 'inside'
  const rect = rowEl.value!.getBoundingClientRect()
  const ratio = (event.clientY - rect.top) / rect.height
  if (isContainer.value) {
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
  dragState.target = { path: props.path, mode: computeDropMode(event) }
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
    toParent = props.path
    const container = getAtPath(store.data, toParent)
    index =
      container !== null && typeof container === 'object'
        ? Object.keys(container as object).length
        : 0
  } else {
    const parentPath = props.path.slice(0, -1)
    const parent = getAtPath(store.data, parentPath)
    if (parent === null || typeof parent !== 'object') return
    const keys = Array.isArray(parent)
      ? parent.map((_, i) => String(i))
      : Object.keys(parent)
    const pos = keys.indexOf(props.name)
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
const lengthLabel = computed(() =>
  isContainer.value ? `${entries.value.length} 项` : '',
)
</script>

<template>
  <div class="tree-node font-mono text-[13px] leading-6">
    <div
      ref="rowEl"
      class="group relative flex items-start gap-1 rounded px-1 transition-colors"
      :class="{
        'hover:bg-primary-soft/40': dropHint === null && !highlighted,
        'bg-primary-soft/70': highlighted,
        'ring-1 ring-primary': dropHint === 'inside',
        'border-t-2 border-t-primary': dropHint === 'before',
        'border-b-2 border-b-primary': dropHint === 'after',
      }"
      :style="{ paddingLeft: `${depth * 14 + 2}px` }"
      @dragover="onDragOver"
      @drop="onDrop"
    >
      <!-- 折叠开关 -->
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

      <!-- 拖拽把手 -->
      <button
        v-if="path.length > 0"
        type="button"
        class="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-ink-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
        aria-label="拖拽移动"
        draggable="true"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
      >
        <NIcon :size="13"><MoveOutline /></NIcon>
      </button>

      <!-- 就地编辑态 -->
      <div v-if="editing" class="flex min-w-0 flex-1 flex-wrap items-center gap-1 py-0.5">
        <NInput
          v-if="parentIsObject"
          v-model:value="editKey"
          size="tiny"
          placeholder="键名"
          class="w-32 font-mono"
          @keydown.enter="confirmEdit"
          @keydown.esc="cancelEdit"
        />
        <NSelect
          v-model:value="editType"
          size="tiny"
          :options="typeOptions"
          class="w-24"
          :consistent-menu-width="false"
        />
        <NInput
          v-if="editType === 'string' || editType === 'number'"
          v-model:value="editText"
          size="tiny"
          class="min-w-24 flex-1 font-mono"
          :placeholder="editType === 'number' ? '数字' : '字符串'"
          @keydown.enter="confirmEdit"
          @keydown.esc="cancelEdit"
        />
        <NSelect
          v-else-if="editType === 'boolean'"
          :value="editBool ? 'true' : 'false'"
          size="tiny"
          class="w-24"
          :consistent-menu-width="false"
          :options="[
            { label: 'true', value: 'true' },
            { label: 'false', value: 'false' },
          ]"
          @update:value="(v: string) => (editBool = v === 'true')"
        />
        <span v-if="editError !== null" class="text-xs text-red-600 dark:text-red-400">
          {{ editError }}
        </span>
        <button
          type="button"
          class="rounded p-1 text-emerald-600 hover:bg-primary-soft dark:text-emerald-400"
          aria-label="确认"
          @click="confirmEdit"
        >
          <NIcon :size="14"><CheckmarkOutline /></NIcon>
        </button>
        <button
          type="button"
          class="rounded p-1 text-ink-muted hover:text-ink"
          aria-label="取消"
          @click="cancelEdit"
        >
          <NIcon :size="14"><CloseOutline /></NIcon>
        </button>
      </div>

      <!-- 展示态 -->
      <div v-else class="min-w-0 flex-1 whitespace-pre-wrap break-all">
        <span v-if="parentIsArray" class="text-ink-muted">{{ name }}</span>
        <span v-else class="text-primary-strong" :title="name">"{{ name }}"</span>
        <span class="text-ink-muted">:&nbsp;</span>

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

        <span v-else :title="previewTitle" class="text-accent">{{ preview }}</span>

        <span
          class="ml-1.5 select-none text-xs text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
        >
          {{ kindLabel }}<template v-if="lengthLabel"> · {{ lengthLabel }}</template>
        </span>
      </div>

      <!-- 悬停操作 -->
      <div
        v-if="!editing"
        class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <button
          type="button"
          class="rounded p-0.5 text-ink-muted transition-colors hover:text-primary-strong"
          :title="isContainer ? '添加子项' : '编辑'"
          :aria-label="isContainer ? '添加子项' : '编辑'"
          @click="isContainer ? addChild() : startEdit()"
        >
          <NIcon :size="13"><AddOutline v-if="isContainer" /><PencilOutline v-else /></NIcon>
        </button>
        <button
          v-if="isContainer"
          type="button"
          class="rounded p-0.5 text-ink-muted transition-colors hover:text-primary-strong"
          aria-label="编辑"
          @click="startEdit"
        >
          <NIcon :size="13"><PencilOutline /></NIcon>
        </button>
        <NDropdown
          v-if="kind === 'object'"
          trigger="click"
          :options="sortOptions"
          @select="onSort"
        >
          <button
            type="button"
            class="rounded p-0.5 text-ink-muted transition-colors hover:text-primary-strong"
            aria-label="排序"
          >
            <NIcon :size="13"><ReorderTwoOutline /></NIcon>
          </button>
        </NDropdown>
        <button
          v-if="path.length > 0"
          type="button"
          class="rounded p-0.5 text-ink-muted transition-colors hover:text-red-500"
          aria-label="删除"
          @click="removeSelf"
        >
          <NIcon :size="13"><TrashOutline /></NIcon>
        </button>
      </div>
    </div>

    <!-- 子节点 -->
    <template v-if="isContainer && open && !depthCapped">
      <TreeNode
        v-for="entry in visibleEntries"
        :key="entry.key"
        :name="entry.key"
        :path="[...path, entry.key]"
        :value="entry.value"
        :depth="depth + 1"
        :parent-is-array="isArray"
        :highlight="highlight"
      />
      <div
        v-if="hiddenCount > 0"
        class="py-0.5 text-ink-muted italic"
        :style="{ paddingLeft: `${(depth + 1) * 14 + 34}px` }"
      >
        <button
          v-if="!showAll"
          type="button"
          class="cursor-pointer hover:underline"
          @click="showAll = true"
        >
          …其余 {{ hiddenCount }} 项已省略，点击全部显示
        </button>
      </div>
      <div
        v-if="entries.length === 0"
        class="text-ink-muted italic"
        :style="{ paddingLeft: `${(depth + 1) * 14 + 34}px` }"
      >
        {{ isArray ? '空数组' : '空对象' }}
      </div>
      <div class="text-ink-muted" :style="{ paddingLeft: `${depth * 14 + 2}px` }">
        {{ isArray ? ']' : '}' }}
      </div>
    </template>
  </div>
</template>
