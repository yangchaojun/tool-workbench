<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { NButton, NIcon, NInput } from 'naive-ui'
import { AddOutline, CloseOutline, PencilOutline } from '@vicons/ionicons5'

import { useJsonEditorStore } from '../stores/jsonEditor'

const store = useJsonEditorStore()

const editingId = ref<string | null>(null)
const draftName = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

function startRename(id: string, name: string) {
  editingId.value = id
  draftName.value = name
  void nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
}

function finishRename() {
  if (editingId.value === null) return
  store.renameTab(editingId.value, draftName.value)
  editingId.value = null
}

function cancelRename() {
  editingId.value = null
}

watch(
  () => store.activeTabId,
  () => {
    editingId.value = null
  },
)
</script>

<template>
  <div class="flex min-h-9 shrink-0 items-stretch gap-1 overflow-x-auto border-b border-border bg-muted/30 px-2">
    <div
      v-for="tab in store.tabs"
      :key="tab.id"
      class="group relative flex min-w-28 max-w-56 shrink-0 items-center gap-1 border-b-2 px-2 text-sm transition-colors"
      :class="
        tab.id === store.activeTabId
          ? 'border-accent bg-card text-foreground'
          : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
      "
      @dblclick="startRename(tab.id, tab.name)"
    >
      <NInput
        v-if="editingId === tab.id"
        ref="nameInput"
        v-model:value="draftName"
        size="tiny"
        class="min-w-0 flex-1"
        aria-label="标签名称"
        @keydown.enter="finishRename"
        @keydown.esc="cancelRename"
        @blur="finishRename"
      />
      <template v-else>
        <button
          type="button"
          class="min-w-0 flex-1 truncate py-1.5 text-left"
          :title="`${tab.name}（双击重命名）`"
          @click="store.switchTab(tab.id)"
        >
          {{ tab.name }}
        </button>
        <button
          type="button"
          class="grid size-5 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
          aria-label="重命名标签"
          title="重命名"
          @click.stop="startRename(tab.id, tab.name)"
        >
          <NIcon :size="12"><PencilOutline /></NIcon>
        </button>
      </template>
      <button
        type="button"
        class="grid size-5 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
        :aria-label="`关闭 ${tab.name}`"
        title="关闭标签"
        :disabled="store.tabs.length === 1"
        @click.stop="store.closeTab(tab.id)"
      >
        <NIcon :size="12"><CloseOutline /></NIcon>
      </button>
    </div>
    <NButton
      size="tiny"
      quaternary
      class="my-1 shrink-0"
      title="新建标签"
      aria-label="新建标签"
      @click="store.addTab()"
    >
      <template #icon>
        <NIcon :size="15"><AddOutline /></NIcon>
      </template>
    </NButton>
  </div>
</template>
