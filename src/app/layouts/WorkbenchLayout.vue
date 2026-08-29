<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NButton, NDrawer, NIcon } from 'naive-ui'
import { MenuOutline } from '@vicons/ionicons5'

import WorkbenchNav from './WorkbenchNav.vue'

const route = useRoute()
const drawerOpen = ref(false)

// 路由变化即收起移动端抽屉；离开工具页时恢复基础标题（计时中的标题由番茄钟 store 接管）
watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false
  },
)
watch(
  () => route.name,
  (name) => {
    if (name !== 'tool') document.title = '工具台'
  },
)
</script>

<template>
  <div class="min-h-screen">
    <!-- 桌面侧边栏 -->
    <aside
      class="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line/60 bg-card md:flex"
    >
      <div class="flex-1 overflow-y-auto">
        <WorkbenchNav />
      </div>
    </aside>

    <!-- 移动端顶栏 -->
    <header
      class="sticky top-0 z-20 flex h-14 items-center gap-1 border-b border-line/60 bg-card/85 px-3 backdrop-blur md:hidden"
    >
      <NButton quaternary circle aria-label="打开导航" @click="drawerOpen = true">
        <template #icon>
          <NIcon :size="20"><MenuOutline /></NIcon>
        </template>
      </NButton>
      <span class="text-[15px] font-semibold tracking-tight">工具台</span>
    </header>

    <NDrawer v-model:show="drawerOpen" placement="left" :width="272">
      <div class="h-full overflow-y-auto bg-card px-3 py-2">
        <WorkbenchNav />
      </div>
    </NDrawer>

    <main class="md:pl-60">
      <div class="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
        <RouterView />
      </div>
    </main>
  </div>
</template>
