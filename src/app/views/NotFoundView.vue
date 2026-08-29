<script setup lang="ts">
import { NButton } from 'naive-ui'

import WorkbenchNav from '@/app/layouts/WorkbenchNav.vue'
</script>

<template>
  <div class="flex min-h-screen">
    <aside class="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line/60 bg-card md:flex">
      <div class="flex-1 overflow-y-auto">
        <WorkbenchNav />
      </div>
    </aside>
    <main class="flex flex-1 items-center justify-center md:pl-60">
      <div class="text-center">
        <p class="text-5xl font-semibold tracking-tight text-primary">404</p>
        <p class="mt-3 text-[15px] text-ink-muted">页面不存在或已被移动。</p>
        <NButton type="primary" secondary class="mt-6" @click="$router.push('/')">
          回到首页
        </NButton>
      </div>
    </main>
  </div>
</template>
