<script setup lang="ts">
import { computed } from 'vue'

import { usePomodoroStore } from '../stores/pomodoro'

const store = usePomodoroStore()

const CIRCUMFERENCE = 2 * Math.PI * 124

const dashOffset = computed(() => {
  const ratio =
    store.totalMs > 0
      ? Math.min(1, Math.max(0, store.runtime.remainingMs / store.totalMs))
      : 0
  return CIRCUMFERENCE * (1 - ratio)
})

const progressColor = computed(() =>
  store.runtime.phase === 'focus' ? 'var(--color-accent)' : 'var(--color-primary)',
)
</script>

<template>
  <div class="relative mx-auto aspect-square w-64 md:w-72" role="timer">
    <svg viewBox="0 0 280 280" class="size-full -rotate-90">
      <circle
        cx="140"
        cy="140"
        r="124"
        fill="none"
        stroke="var(--color-line)"
        :stroke-width="10"
        opacity="0.8"
      />
      <circle
        cx="140"
        cy="140"
        r="124"
        fill="none"
        :stroke="progressColor"
        :stroke-width="10"
        stroke-linecap="round"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="dashOffset"
        class="transition-[stroke-dashoffset] duration-300 ease-linear"
      />
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
      <span class="text-5xl font-semibold tracking-tight tabular-nums md:text-6xl">
        {{ store.clockText }}
      </span>
      <span class="text-sm text-ink-muted">{{ store.statusLabel }}</span>
      <span class="mt-1 flex gap-1.5" aria-hidden="true">
        <i
          v-for="(on, i) in store.cycleDots"
          :key="i"
          class="size-1.5 rounded-full"
          :class="on ? 'bg-accent' : 'bg-line'"
        />
      </span>
    </div>
  </div>
</template>
