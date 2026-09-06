<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue'

import { getTool } from '@/core/tools/registry'

const props = defineProps<{ toolId: string }>()

const tool = computed(() => getTool(props.toolId))
const view = computed(() => (tool.value ? defineAsyncComponent(tool.value.component) : null))

watch(
  tool,
  (t) => {
    document.title = t ? `${t.manifest.name} · 工具台` : '工具台'
  },
  { immediate: true },
)
</script>

<template>
  <component :is="view" v-if="view" />
  <section v-else class="py-16 text-center">
    <p class="text-sm text-muted-foreground">没有找到工具「{{ toolId }}」。</p>
    <p class="mt-1 text-xs text-muted-foreground/70">请检查链接，或回到首页查看可用工具。</p>
  </section>
</template>
