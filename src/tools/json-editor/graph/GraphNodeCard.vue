<script setup lang="ts">
import { computed, ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'

import { SCALAR_MAX_CHARS } from './buildGraph'
import type { GraphEntry, GraphNodeModel, TableCell } from './buildGraph'
import type { JsonPath } from '../editor/mutations'
import { ROW_H, TABLE_COL, TABLE_INDEX_COL } from './layout'

/**
 * 图谱卡片节点：对象/数组渲染为行列表（与树形视图同款语法四色）。
 * 容器行点击展开/收起子卡片；标量 key 点击查看完整值，value 点击复制 key。
 * 行高严格 28px——layout.ts 的 nodeHeight 依赖它保证连线锚点对位。
 * 连线锚点：每个已展开的容器行在右缘持有行级 source Handle（按行居中），
 * 子卡片在左缘首行高度持有 target Handle——连线从对应 key 的行出发（参考 Treeease）。
 */

const props = defineProps<{ model: GraphNodeModel }>()

const emit = defineEmits<{
  toggle: [entry: GraphEntry]
  'cell-select': [path: JsonPath]
}>()

const isRoot = computed(() => props.model.path.length === 0)

/** 子卡片 target Handle 的纵坐标：首行中心 */
const targetTop = `${ROW_H / 2}px`

/** 空容器 / 空根的占位文案（与树形视图「空对象 / 空数组」一致） */
const emptyLabel = computed(() => (props.model.type === 'array' ? '空数组' : '空对象'))

function badge(entry: GraphEntry): string {
  if (entry.childCount === 0) return entry.containerType === 'array' ? '[]' : '{}'
  return entry.containerType === 'array' ? `[${entry.childCount}]` : `{${entry.childCount}}`
}

function onContainerRowClick(entry: GraphEntry) {
  if (entry.childCount === 0) return
  emit('toggle', entry)
}

// ── value 点击复制 key（TreeRow 同款瞬时反馈）───────────────────
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

function onScalarKeyClick(entry: GraphEntry) {
  emit('cell-select', [...props.model.path, entry.key])
}

function onScalarValueClick(entry: GraphEntry) {
  void copyKey(entry)
}

// ── 表格节点单元格 ─────────────────────────────────────────────
function cellPreview(value: string): string {
  return value.length > SCALAR_MAX_CHARS ? `${value.slice(0, SCALAR_MAX_CHARS - 1)}…` : value
}

function columnStyle(columnIndex: number) {
  return { flexBasis: `${props.model.tableColumnWidths?.[columnIndex] ?? TABLE_COL}px` }
}

function selectCell(path: JsonPath, rowIndex: number, columnIndex: number) {
  emit('cell-select', [...path, String(rowIndex), props.model.tableColumns?.[columnIndex] ?? ''])
}

const cellClass = (cell: TableCell) =>
  ({
    string: 'text-json-string',
    number: 'text-json-number',
    boolean: 'text-json-boolean',
    null: 'text-json-null',
  })[cell.kind]

/** 可见行数（表格节点为数据行数，常规卡片为 entries.length） */
const visibleRowCount = computed(() =>
  props.model.tableColumns !== null ? props.model.tableCells.length : props.model.entries.length,
)

const tailLabel = computed(() =>
  props.model.truncatedRows ? `… 还有 ${props.model.totalEntries - visibleRowCount.value} 项` : '',
)
</script>

<template>
  <div class="relative h-full w-full overflow-clip rounded-md border border-border bg-card font-mono text-xs shadow-card">
    <Handle
      v-if="!isRoot"
      type="target"
      :position="Position.Left"
      id="t"
      :style="{ top: targetTop }"
      class="graph-card-handle"
    />

    <!-- 标量根：单行值 -->
    <div v-if="model.type === 'root-scalar'" class="flex h-7 items-center justify-end px-3">
      <span class="truncate text-json-number" :title="model.scalarPreview ?? ''">
        {{ model.scalarPreview }}
      </span>
    </div>

    <template v-else>
      <!-- 表格节点：对象数组（元素全为统一标量对象）内联为网格 -->
      <template v-if="model.tableColumns !== null">
        <div class="flex h-7 border-b border-border bg-muted/60">
          <span class="table-index-cell" :style="{ width: `${TABLE_INDEX_COL}px` }" />
          <span
            v-for="(column, columnIndex) in model.tableColumns"
            :key="column"
            class="table-data-cell truncate font-medium text-foreground"
            :style="columnStyle(columnIndex)"
            :title="column"
          >
            {{ column }}
          </span>
        </div>
        <div
          v-for="(row, rowIndex) in model.tableCells"
          :key="rowIndex"
          class="flex h-7 border-b border-border last:border-b-0"
        >
          <span
            class="table-index-cell text-mute"
            :style="{ width: `${TABLE_INDEX_COL}px` }"
          >{{ rowIndex }}</span>
          <button
            v-for="(cell, columnIndex) in row"
            :key="columnIndex"
            type="button"
            class="table-data-cell min-w-0 truncate text-left"
            :class="[cellClass(cell), cell.value === '' ? 'cursor-default text-mute' : 'cursor-pointer hover:bg-muted']"
            :style="columnStyle(columnIndex)"
            :title="cell.value === '' ? `${model.tableColumns?.[columnIndex] ?? ''}：缺省` : cell.value"
            :aria-label="cell.value === '' ? `${model.tableColumns?.[columnIndex] ?? ''}：缺省` : `查看 ${model.tableColumns?.[columnIndex] ?? ''} 的完整值`"
            :disabled="cell.value === ''"
            @click.stop="selectCell(model.path, rowIndex, columnIndex)"
          >
            {{ cell.value === '' ? '缺省' : cellPreview(cell.value) }}
          </button>
        </div>
      </template>
      <template v-else>
        <div v-if="model.entries.length === 0" class="flex h-7 items-center px-3 text-mute">
          {{ emptyLabel }}
        </div>
        <template v-for="entry in model.entries" :key="entry.key">
        <!-- 容器行：点击展开/收起子卡片；已展开行在右缘持有行级连线锚点 -->
        <button
          v-if="entry.containerType !== null"
          type="button"
          class="group relative flex h-7 w-full items-center justify-between gap-3 px-3 text-left transition-colors duration-150"
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
          <Handle
            v-if="entry.childId !== null"
            type="source"
            :position="Position.Right"
            :id="`row:${entry.key}`"
            class="graph-card-handle"
          />
        </button>
        <!-- 标量行：key 查看完整值，value 复制 key -->
        <div class="flex h-7 w-full items-center justify-between gap-3 px-3 hover:bg-muted">
          <button
            type="button"
            class="min-w-0 truncate text-left text-foreground hover:text-accent"
            :title="`查看 ${entry.key} 的完整值`"
            :aria-label="`查看 ${entry.key} 的完整值`"
            @click.stop="onScalarKeyClick(entry)"
          >
            {{ entry.key }}
          </button>
          <button
            type="button"
            class="min-w-0 max-w-[62%] truncate text-right"
            :class="{
              'text-json-string': entry.kind === 'string',
              'text-json-number': entry.kind === 'number',
              'text-json-boolean': entry.kind === 'boolean',
              'text-json-null': entry.kind === 'null',
            }"
            :title="`复制 key：${entry.key}`"
            :aria-label="`复制 key：${entry.key}`"
            @click.stop="onScalarValueClick(entry)"
          >
            {{ entry.value }}
            <span v-if="copiedKey === entry.key" class="ml-1 text-accent">已复制 ✓</span>
          </button>
        </div>
        </template>
        <!-- 行数截断尾行 -->
        <div v-if="model.truncatedRows" class="flex h-7 items-center px-3 text-mute">
          {{ tailLabel }}
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
/* 连线锚点：纯几何锚（参考图无圆点装饰），不参与交互 */
.graph-card-handle {
  width: 6px;
  height: 6px;
  border: none;
  background: transparent;
  pointer-events: none;
}

/* 索引列定宽，数据列 flex-basis 使用 tableColumnWidths，与布局宽度一致 */
.table-index-cell {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-right: 1px solid var(--color-border);
  padding: 0 6px;
}
.table-data-cell {
  display: flex;
  min-width: 0;
  flex: 0 1 auto;
  align-items: center;
  justify-content: flex-end;
  border-right: 1px solid var(--color-border);
  padding: 0 10px;
}
.table-data-cell:last-child {
  border-right: none;
}

button.table-data-cell {
  height: 100%;
  font: inherit;
  color: inherit;
  background: transparent;
}
</style>
