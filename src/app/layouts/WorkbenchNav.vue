<script setup lang="ts">
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import { HomeOutline, MoonOutline, SunnyOutline } from '@vicons/ionicons5'

import { listTools } from '@/core/tools/registry'
import { useThemeStore } from '@/app/stores/theme'
import { useRoute } from 'vue-router'

const route = useRoute()
const tools = listTools()
const theme = useThemeStore()

const props = withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false })
const collapsed = computed(() => props.collapsed)

const itemBase = 'flex cursor-pointer items-center rounded-lg py-2 text-sm transition-colors duration-150'
// 收起时去掉水平内边距并居中，让图标在窄栏里对齐
const itemSpacing = computed(() => (collapsed.value ? 'justify-center px-0' : 'gap-3 px-3'))
const itemIdle = 'text-muted-foreground hover:bg-muted hover:text-foreground'
const itemActive = 'bg-accent-50 font-medium text-foreground'

function isToolActive(toolId: string): boolean {
  return route.name === 'tool' && route.params.toolId === toolId
}
</script>

<template>
  <div class="flex h-full flex-col pb-5">
    <RouterLink
      to="/"
      :class="[
        'flex cursor-pointer items-center pt-5 pb-5',
        collapsed ? 'justify-center px-0' : 'gap-2.5 px-3',
      ]"
      aria-label="回到首页"
      title="工具台"
    >
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--color-primary)" />
        <circle cx="11" cy="11" r="3.2" fill="var(--color-on-primary)" />
        <circle cx="21" cy="11" r="3.2" fill="var(--color-on-primary)" />
        <circle cx="11" cy="21" r="3.2" fill="var(--color-on-primary)" />
        <circle cx="21" cy="21" r="3.2" fill="var(--color-accent)" />
      </svg>
      <span :class="collapsed ? 'hidden' : 'flex flex-col leading-tight'">
        <span class="text-base font-medium tracking-tight">工具台</span>
        <span class="text-xs text-muted-foreground">ToolWorkbench</span>
      </span>
    </RouterLink>

    <nav class="flex flex-col gap-1" aria-label="平台导航">
      <RouterLink
        to="/"
        :class="[itemBase, itemSpacing, route.name === 'home' ? itemActive : itemIdle]"
        title="首页"
      >
        <NIcon :size="18"><HomeOutline /></NIcon>
        <span :class="collapsed ? 'hidden' : undefined">首页</span>
      </RouterLink>

      <p :class="['px-3 pt-5 pb-1 text-xs text-muted-foreground', collapsed ? 'hidden' : undefined]">
        工具
      </p>
      <RouterLink
        v-for="tool in tools"
        :key="tool.manifest.id"
        :to="`/tools/${tool.manifest.id}`"
        :class="[itemBase, itemSpacing, isToolActive(tool.manifest.id) ? itemActive : itemIdle]"
        :title="tool.manifest.name"
      >
        <NIcon :size="18"><component :is="tool.icon" /></NIcon>
        <span :class="collapsed ? 'hidden' : undefined">{{ tool.manifest.name }}</span>
      </RouterLink>
    </nav>

    <div class="mt-auto flex flex-col gap-1 px-0 pt-6">
      <button
        :class="[itemBase, itemSpacing, itemIdle]"
        class="w-full border-0 bg-transparent text-left"
        :title="theme.dark ? '浅色模式' : '深色模式'"
        @click="theme.toggle()"
      >
        <NIcon :size="18">
          <SunnyOutline v-if="theme.dark" />
          <MoonOutline v-else />
        </NIcon>
        <span :class="collapsed ? 'hidden' : undefined">
          {{ theme.dark ? '浅色模式' : '深色模式' }}
        </span>
      </button>
      <p
        :class="[
          'px-3 pt-3 text-xs leading-relaxed text-muted-foreground',
          collapsed ? 'hidden' : undefined,
        ]"
      >
        本地运行 · 数据仅存于浏览器
      </p>
    </div>
  </div>
</template>
