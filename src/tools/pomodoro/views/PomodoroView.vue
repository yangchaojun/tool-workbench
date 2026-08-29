<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { ExpandOutline, SettingsOutline } from '@vicons/ionicons5'

import { usePomodoroStore, phaseMeta } from '../stores/pomodoro'
import TimerRing from '../components/TimerRing.vue'
import FlipClock from '../components/FlipClock.vue'
import TodayStats from '../components/TodayStats.vue'
import TaskList from '../components/TaskList.vue'
import SettingsDrawer from '../components/SettingsDrawer.vue'
import FullscreenOverlay from '../components/FullscreenOverlay.vue'
import type { PomodoroPhase } from '../schemas'

const store = usePomodoroStore()
const showSettings = ref(false)
const showFullscreen = ref(false)

const phaseKeys = Object.keys(phaseMeta) as PomodoroPhase[]

const mainLabel = computed(() => {
  if (store.runtime.status === 'running') return '暂停'
  if (store.runtime.status === 'paused') return '继续'
  return `开始${phaseMeta[store.runtime.phase].label}`
})

function onMainClick() {
  if (store.runtime.status === 'running') store.pause()
  else store.start()
}
</script>

<template>
  <section>
    <header class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">番茄任务钟</h1>
        <p class="mt-1 text-sm text-ink-muted">专注一个番茄，休息片刻，循环推进。</p>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <NButton quaternary circle aria-label="进入全屏专注" @click="showFullscreen = true">
          <template #icon>
            <NIcon :size="20"><ExpandOutline /></NIcon>
          </template>
        </NButton>
        <NButton quaternary circle aria-label="打开设置" @click="showSettings = true">
          <template #icon>
            <NIcon :size="20"><SettingsOutline /></NIcon>
          </template>
        </NButton>
      </div>
    </header>

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <!-- 计时器 -->
      <section
        class="flex flex-col items-center rounded-card border border-line/60 bg-card p-6 shadow-card md:p-8"
      >
        <div
          class="mb-8 flex rounded-full bg-primary-soft/50 p-1"
          role="tablist"
          aria-label="计时模式"
        >
          <button
            v-for="p in phaseKeys"
            :key="p"
            type="button"
            role="tab"
            :aria-selected="store.runtime.phase === p"
            :disabled="store.runtime.status !== 'idle'"
            class="cursor-pointer rounded-full px-4 py-1.5 text-sm transition-colors duration-200 disabled:cursor-not-allowed"
            :class="
              store.runtime.phase === p
                ? 'bg-card font-medium text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink disabled:hover:text-ink-muted'
            "
            @click="store.switchPhase(p)"
          >
            {{ phaseMeta[p].label }}
          </button>
        </div>

        <FlipClock v-if="store.settings.clockStyle === 'flip'" />
        <TimerRing v-else />

        <div class="mt-8 flex items-center gap-2">
          <NButton
            type="primary"
            size="large"
            round
            :secondary="store.runtime.status === 'running'"
            class="min-w-32"
            @click="onMainClick"
          >
            {{ mainLabel }}
          </NButton>
          <NButton
            quaternary
            size="large"
            round
            :disabled="store.runtime.status === 'idle'"
            @click="store.skip()"
          >
            跳过
          </NButton>
          <NButton
            quaternary
            size="large"
            round
            :disabled="store.runtime.status === 'idle'"
            @click="store.reset()"
          >
            重置
          </NButton>
        </div>
      </section>

      <!-- 统计 + 任务 -->
      <aside class="flex flex-col gap-6">
        <TodayStats />
        <TaskList />
      </aside>
    </div>

    <SettingsDrawer v-model:show="showSettings" />
    <FullscreenOverlay v-model:show="showFullscreen" />
  </section>
</template>
