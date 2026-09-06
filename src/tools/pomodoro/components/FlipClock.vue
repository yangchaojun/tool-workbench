<script setup lang="ts">
import { computed } from 'vue'

import { usePomodoroStore } from '../stores/pomodoro'
import FlipDigit from './FlipDigit.vue'

// large 尺寸供全屏专注层使用，与 TimerRing 的约定一致
const props = withDefaults(defineProps<{ large?: boolean }>(), { large: false })

const store = usePomodoroStore()

const digits = computed(() => {
  const [m1, m2, s1, s2] = store.clockText.replace(':', '').split('')
  return [m1 ?? '0', m2 ?? '0', s1 ?? '0', s2 ?? '0'] as const
})

// 环形模式里由进度环承担的阶段色，翻页模式收敛到冒号点与状态标签
const phaseColor = computed(() =>
  store.runtime.phase === 'focus' ? 'var(--color-accent)' : 'var(--color-primary)',
)
</script>

<template>
  <div
    class="flex flex-col items-center gap-6"
    role="timer"
    :aria-label="`剩余 ${store.clockText}`"
  >
    <div class="flex items-center" :class="props.large ? 'gap-2.5' : 'gap-1.5'" aria-hidden="true">
      <FlipDigit :digit="digits[0]" :large="props.large" />
      <FlipDigit :digit="digits[1]" :large="props.large" />
      <span
        class="flex flex-col items-center justify-center"
        :class="props.large ? 'gap-2.5 px-2' : 'gap-1.5 px-0.5'"
        :style="{ color: phaseColor }"
      >
        <i class="block rounded-full bg-current" :class="props.large ? 'size-2.5' : 'size-1.5'" />
        <i class="block rounded-full bg-current" :class="props.large ? 'size-2.5' : 'size-1.5'" />
      </span>
      <FlipDigit :digit="digits[2]" :large="props.large" />
      <FlipDigit :digit="digits[3]" :large="props.large" />
    </div>
    <div class="flex flex-col items-center gap-3">
      <span class="text-sm font-medium" :style="{ color: phaseColor }">{{ store.statusLabel }}</span>
      <span class="flex gap-1.5" aria-hidden="true">
        <i
          v-for="(on, i) in store.cycleDots"
          :key="i"
          class="size-1.5 rounded-full"
          :class="on ? 'bg-accent' : 'bg-border'"
        />
      </span>
    </div>
  </div>
</template>
