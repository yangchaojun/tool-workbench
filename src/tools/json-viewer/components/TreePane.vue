<script setup lang="ts">
import TreeView from './TreeView.vue'
import { useJsonViewerStore } from '../stores/jsonViewer'

const store = useJsonViewerStore()
</script>

<template>
  <div
    class="h-full min-h-0 overflow-hidden rounded-card border border-line/60 bg-card p-4 shadow-card"
  >
    <TreeView v-if="store.hasData" :data="store.data" />
    <div
      v-else
      class="flex h-full items-center justify-center text-sm text-ink-muted"
    >
      解析成功后在此浏览数据
    </div>
  </div>
</template>
