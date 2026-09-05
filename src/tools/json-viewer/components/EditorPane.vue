<script setup lang="ts">
import { computed, ref } from 'vue'

import CodeEditor from '@/shared/components/code-editor/CodeEditor.vue'

import { useJsonViewerStore } from '../stores/jsonViewer'

const store = useJsonViewerStore()

const dragDepth = ref(0)
const editorRef = ref<InstanceType<typeof CodeEditor> | null>(null)

const errorMark = computed(() => {
  const r = store.result
  if (r === null || r.ok || r.location === null) return null
  return { line: r.location.line, column: r.location.column, message: r.location.message }
})

function onDrop(event: DragEvent) {
  dragDepth.value = 0
  const file = event.dataTransfer?.files?.[0]
  if (file) void store.loadFile(file)
}

/** 转发重新测量（Tab 容器从 display:none 恢复后 CodeMirror 需要重测） */
function remeasure() {
  editorRef.value?.remeasure()
}

defineExpose({ remeasure })
</script>

<template>
  <div
    class="relative flex h-full min-h-0 flex-col overflow-hidden rounded-card border bg-card shadow-card transition-shadow"
    :class="dragDepth > 0 ? 'border-primary ring-2 ring-primary/30' : 'border-line/60'"
    @dragenter.prevent="dragDepth += 1"
    @dragover.prevent
    @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
    @drop.prevent="onDrop"
  >
    <div class="min-h-0 flex-1">
      <CodeEditor ref="editorRef" v-model="store.input" language="json" :error-mark="errorMark" />
    </div>
    <div
      v-if="dragDepth > 0"
      class="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary-soft/70 text-sm font-medium text-primary-strong"
    >
      松开以载入文件
    </div>
  </div>
</template>
