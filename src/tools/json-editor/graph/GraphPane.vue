<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Position, VueFlow, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

import { useJsonEditorStore } from '../stores/jsonEditor'
import { buildGraph, defaultExpandedIds, graphNodeId, MAX_GRAPH_NODES } from './buildGraph'
import type { GraphEntry, GraphNodeModel } from './buildGraph'
import { layoutGraph, NODE_WIDTH } from './layout'
import GraphNodeCard from './GraphNodeCard.vue'
import type { JsonPath } from '../editor/mutations'

/**
 * 图谱面板：数据源的容器结构 → 卡片节点图（Vue Flow + dagre 层次布局）。
 * 缩放 / 平移 / 小地图由 Vue Flow 提供；展开状态按路径记忆（与树形视图同语义）：
 * 默认按「层级少于 5 层全展开」规则生成，用户手动展开/收起后即接管、不再自动重置。
 */

const store = useJsonEditorStore()

const userTouched = ref(false)

const expandedIds = ref<ReadonlySet<string>>(defaultExpandedIds(store.data))

// 数据源变化且用户尚未手动干预时，按默认展开规则重新生成（打字编辑的防抖校验也算）
watch(
  () => store.data,
  (data) => {
    if (!userTouched.value) expandedIds.value = defaultExpandedIds(data)
  },
)

const graph = computed(() => (store.hasData ? buildGraph(store.data, expandedIds.value) : null))

const flowNodes = computed(() => {
  const g = graph.value
  if (g === null) return []
  const positions = layoutGraph(g.nodes)
  return g.nodes.map((node) => ({
    id: node.id,
    type: 'json-card',
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: node,
    width: NODE_WIDTH,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }))
})

const flowEdges = computed(() =>
  (graph.value?.edges ?? []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: 't',
  })),
)

function toggleEntry(nodePath: JsonPath, entry: GraphEntry) {
  if (entry.containerType === null || entry.childCount === 0) return
  // 截断后禁止再展开（收起不受限），与 buildGraph 的预算语义一致
  if (graph.value?.truncated === true && entry.childId === null) return
  userTouched.value = true
  const childId = graphNodeId([...nodePath, entry.key])
  const next = new Set(expandedIds.value)
  if (entry.childId !== null) next.delete(childId)
  else next.add(childId)
  expandedIds.value = next
}

function onCardToggle(nodeProps: NodeProps, entry: GraphEntry) {
  toggleEntry((nodeProps.data as GraphNodeModel).path, entry)
}

const { updateNodeInternals } = useVueFlow()

// 行级 Handle 随展开/收起增删，且节点内部测量可能早于 slot 内容挂载——图变化后强制重测
watch(flowNodes, () => nextTick(() => updateNodeInternals()))
onMounted(() => nextTick(() => updateNodeInternals()))
</script>

<template>
  <div
    class="relative h-full min-h-0 overflow-clip rounded-panel border border-border bg-card shadow-card"
  >
    <template v-if="store.hasData && graph !== null">
      <VueFlow
        class="json-graph"
        :nodes="flowNodes"
        :edges="flowEdges"
        :min-zoom="0.1"
        :max-zoom="2.5"
        :default-edge-options="{ type: 'default' }"
        :nodes-connectable="false"
        fit-view-on-init
      >
        <template #node-json-card="nodeProps">
          <GraphNodeCard :model="nodeProps.data as GraphNodeModel" @toggle="(e) => onCardToggle(nodeProps, e)" />
        </template>
        <Background variant="lines" :gap="28" />
        <MiniMap pannable zoomable position="bottom-right" :width="180" :height="120" />
        <Controls position="bottom-left" />
      </VueFlow>
      <div
        v-if="graph.truncated"
        class="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-card"
      >
        图规模较大：已达 {{ MAX_GRAPH_NODES }} 节点上限，仅显示部分结构
      </div>
    </template>
    <div
      v-else-if="store.dataStale"
      class="flex h-full items-center justify-center text-sm text-muted-foreground"
    >
      图谱视图已暂停同步——文本重新通过校验后自动恢复
    </div>
    <div v-else class="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
      解析成功后在此查看结构图谱：缩放、拖动画布，点击容器行展开子卡片
    </div>
  </div>
</template>

<style scoped>
/* Vue Flow 主题色 → DESIGN.md token：SVG 颜色为表现属性，须以 CSS 覆盖（attribute 不支持 var()） */
:deep(.vue-flow__background pattern path) {
  stroke: var(--color-border);
}
:deep(.vue-flow__background pattern circle) {
  fill: var(--color-border);
}
:deep(.vue-flow__edge-path) {
  stroke: var(--color-border-hover);
}

/* MiniMap：卡片底 + hairline 边框 */
:deep(.vue-flow__minimap) {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: var(--shadow-card);
}
:deep(.vue-flow__minimap svg) {
  background: var(--color-card);
}
:deep(.vue-flow__minimap-node) {
  fill: var(--color-border-hover);
}
:deep(.vue-flow__minimap-mask) {
  fill: color-mix(in srgb, var(--color-card) 72%, transparent);
}

/* Controls：卡片化按钮组 */
:deep(.vue-flow__controls) {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: var(--shadow-card);
}
:deep(.vue-flow__controls-button) {
  background: var(--color-card);
  border-bottom: 1px solid var(--color-border);
}
:deep(.vue-flow__controls-button:hover) {
  background: var(--color-muted);
}
:deep(.vue-flow__controls-button svg) {
  fill: var(--color-muted-foreground);
}
</style>
