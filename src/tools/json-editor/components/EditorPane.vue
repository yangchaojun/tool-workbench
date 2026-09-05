<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { NIcon } from 'naive-ui'
import { SearchOutline } from '@vicons/ionicons5'
import type { EditorView } from '@codemirror/view'

import CodeEditor from '@/shared/components/code-editor/CodeEditor.vue'

import { useJsonEditorStore } from '../stores/jsonEditor'
import FindReplaceBar from './FindReplaceBar.vue'

const store = useJsonEditorStore()

const dragDepth = ref(0)
const editorRef = ref<InstanceType<typeof CodeEditor> | null>(null)
const findOpen = ref(false)

const errorMark = computed(() => {
  const r = store.result
  if (r === null || r.ok || r.location === null) return null
  return { line: r.location.line, column: r.location.column, message: r.location.message }
})

function getView(): EditorView | null {
  return (editorRef.value?.getView() as EditorView | undefined) ?? null
}

function onDrop(event: DragEvent) {
  dragDepth.value = 0
  const file = event.dataTransfer?.files?.[0]
  if (file) void store.loadFile(file)
}

function openFind() {
  findOpen.value = true
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault()
    findOpen.value = true
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

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
    <FindReplaceBar v-if="findOpen" :get-view="getView" @close="findOpen = false" />

    <!-- 查找入口（覆盖在编辑器右上角外沿） -->
    <button
      v-if="!findOpen"
      type="button"
      class="absolute right-3 top-2 z-10 rounded p-1.5 text-ink-muted transition-colors hover:bg-primary-soft/60 hover:text-ink"
      aria-label="查找替换（⌘F）"
      title="查找替换（⌘F）"
      @click="openFind"
    >
      <NIcon :size="15"><SearchOutline /></NIcon>
    </button>

    <div class="min-h-0 flex-1">
      <CodeEditor
        ref="editorRef"
        v-model="store.input"
        language="json"
        :history="false"
        :error-mark="errorMark"
      />
    </div>
    <div
      v-if="dragDepth > 0"
      class="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary-soft/70 text-sm font-medium text-primary-strong"
    >
      松开以载入文件
    </div>
  </div>
</template>
