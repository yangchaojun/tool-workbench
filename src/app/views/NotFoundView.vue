<script setup lang="ts">
import { NButton } from 'naive-ui'
</script>

<template>
  <div class="flex min-h-[55vh] flex-col items-center justify-center text-center">
    <p class="text-5xl font-semibold tracking-tight text-primary">404</p>
    <p class="mt-3 text-[15px] text-ink-muted">页面不存在或已被移动。</p>
    <NButton type="primary" secondary class="mt-6" @click="$router.push('/')">
      回到首页
    </NButton>
  </div>
</template>
