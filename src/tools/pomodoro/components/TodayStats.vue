<script setup lang="ts">
import { computed } from 'vue'

import { usePomodoroStore } from '../stores/pomodoro'

const store = usePomodoroStore()

const goalPct = computed(() => {
  const goal = store.settings.dailyGoal
  return Math.min(100, Math.round((store.todayFocusCount / goal) * 100))
})
</script>

<template>
  <section class="rounded-card border border-line/60 bg-card shadow-card">
    <div class="grid grid-cols-3 divide-x divide-line/60">
      <div class="p-4">
        <p class="text-xs text-ink-muted">今日番茄</p>
        <p class="mt-1.5 text-2xl font-semibold text-accent tabular-nums">
          {{ store.todayFocusCount }}
        </p>
      </div>
      <div class="p-4">
        <p class="text-xs text-ink-muted">专注分钟</p>
        <p class="mt-1.5 text-2xl font-semibold tabular-nums">
          {{ store.todayFocusMinutes }}
        </p>
      </div>
      <div class="p-4">
        <p class="text-xs text-ink-muted">今日目标</p>
        <p class="mt-1.5 text-2xl font-semibold tabular-nums">
          {{ store.todayFocusCount }}
          <span class="text-sm font-normal text-ink-muted">/ {{ store.settings.dailyGoal }}</span>
        </p>
        <div class="mt-2 h-1 overflow-hidden rounded-full bg-primary-soft/70">
          <div
            class="h-full rounded-full bg-accent transition-all duration-300"
            :style="{ width: `${goalPct}%` }"
          />
        </div>
      </div>
    </div>
  </section>
</template>
