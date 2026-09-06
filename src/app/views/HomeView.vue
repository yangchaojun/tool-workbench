<script setup lang="ts">
import { listTools } from '@/core/tools/registry'

const tools = listTools()

const now = new Date()
const dateLabel = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(now)

function greetingFor(hour: number): string {
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}
const greeting = greetingFor(now.getHours())
</script>

<template>
  <section>
    <header class="mb-8">
      <p class="mb-1 text-sm text-accent">{{ dateLabel }}</p>
      <h1 class="text-2xl font-medium tracking-tight md:text-3xl">{{ greeting }}</h1>
      <p class="mt-2 text-[15px] text-muted-foreground">挑一件小事，从这里开始。</p>
    </header>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <RouterLink
        v-for="tool in tools"
        :key="tool.manifest.id"
        :to="`/tools/${tool.manifest.id}`"
        class="rounded-panel border border-border bg-card p-5 transition-colors duration-150 hover:border-border-hover"
      >
        <div class="flex items-start gap-4">
          <span
            class="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
          >
            <component :is="tool.icon" class="text-[22px]" />
          </span>
          <div class="min-w-0">
            <h2 class="font-medium">{{ tool.manifest.name }}</h2>
            <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
              {{ tool.manifest.description }}
            </p>
          </div>
        </div>
      </RouterLink>
    </div>

    <p class="mt-10 text-xs text-muted-foreground/80">
      更多工具按注册契约接入，见 README「新增一个工具」。
    </p>
  </section>
</template>
