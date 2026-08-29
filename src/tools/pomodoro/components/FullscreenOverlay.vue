<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { NIcon } from 'naive-ui'
import { CloseOutline } from '@vicons/ionicons5'

import { useWakeLock } from '@/shared/composables/useWakeLock'

import { phaseMeta, usePomodoroStore } from '../stores/pomodoro'
import TimerRing from './TimerRing.vue'
import FlipClock from './FlipClock.vue'

// 全屏专注层：同一状态机的另一种呈现。刻意不用 naive 组件——
// 其样式未分层会压过工具类，且主题跟随全局会与强制深色沉浸冲突；
// 根节点挂 .dark class，让整套设计 token 自动切换为暗色值。
const show = defineModel<boolean>('show', { default: false })

const store = usePomodoroStore()
const wakeLock = useWakeLock()

const activeTask = computed(
  () => store.tasks.find((t) => t.id === store.runtime.activeTaskId && !t.done) ?? null,
)

const mainLabel = computed(() => {
  if (store.runtime.status === 'running') return '暂停'
  if (store.runtime.status === 'paused') return '继续'
  return `开始${phaseMeta[store.runtime.phase].label}`
})

const mainButtonStyle = computed(() => ({
  backgroundColor:
    store.runtime.phase === 'focus' ? 'var(--color-accent)' : 'var(--color-primary)',
  color: '#0c161e',
}))

function toggleRun() {
  if (store.runtime.status === 'running') store.pause()
  else store.start()
}

function exitImmersive() {
  show.value = false
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
  }
}

// 用户以 Esc 退出原生全屏时，沉浸层一并关闭
function onFullscreenChange() {
  if (!document.fullscreenElement && show.value) show.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    exitImmersive()
    return
  }
  if (e.code !== 'Space') return
  // 焦点在可交互元素上时交给原生行为（如按钮空格激活），避免双重切换
  const el = e.target as HTMLElement | null
  if (
    el &&
    (el.tagName === 'BUTTON' ||
      el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  ) {
    return
  }
  e.preventDefault()
  toggleRun()
}

function onVisibilityChange() {
  // 系统在页面隐藏时会自动释放唤醒锁，重新可见且仍在计时则补拿
  if (document.visibilityState === 'visible' && store.runtime.status === 'running') {
    void wakeLock.acquire()
  }
}

function bindListeners(bind: boolean) {
  if (bind) {
    document.addEventListener('keydown', onKeydown)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('visibilitychange', onVisibilityChange)
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

watch(show, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  bindListeners(open)
  if (!open) {
    wakeLock.release()
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
    return
  }
  if (document.fullscreenEnabled) {
    document.documentElement.requestFullscreen().catch(() => {})
  }
  if (store.runtime.status === 'running') void wakeLock.acquire()
})

watch(
  () => store.runtime.status,
  (status) => {
    if (!show.value) return
    if (status === 'running') void wakeLock.acquire()
    else wakeLock.release()
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  bindListeners(false)
  wakeLock.release()
  // 组件卸载（路由跳转/HMR）时避免留下无沉浸层的孤立原生全屏
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="immersive">
      <div
        v-if="show"
        class="dark fixed inset-0 z-[3000] flex select-none flex-col items-center justify-center gap-7 overflow-hidden bg-surface text-ink"
      >
        <button
          type="button"
          aria-label="退出全屏"
          class="absolute right-5 top-5 grid size-11 cursor-pointer place-items-center rounded-full border border-line/40 text-ink-muted transition-colors duration-200 hover:border-line hover:text-ink"
          @click="exitImmersive"
        >
          <NIcon :size="22"><CloseOutline /></NIcon>
        </button>

        <span
          class="rounded-full px-4 py-1 text-sm font-medium"
          :style="{
            backgroundColor: 'var(--color-primary-soft)',
            color: 'var(--color-primary-strong)',
          }"
        >
          {{ phaseMeta[store.runtime.phase].label }}
        </span>

        <button
          type="button"
          class="cursor-pointer"
          aria-label="切换计时"
          @click="toggleRun"
        >
          <FlipClock v-if="store.settings.clockStyle === 'flip'" large />
          <TimerRing v-else large />
        </button>

        <span
          v-if="activeTask"
          class="max-w-[80vw] truncate rounded-full bg-card/70 px-4 py-1.5 text-sm text-ink-muted"
        >
          当前任务 · {{ activeTask.title }}
        </span>

        <div class="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            class="min-w-36 cursor-pointer rounded-full px-8 py-3 text-lg font-medium transition-transform duration-200 hover:scale-[1.03]"
            :style="mainButtonStyle"
            @click="toggleRun"
          >
            {{ mainLabel }}
          </button>
          <button
            type="button"
            :disabled="store.runtime.status === 'idle'"
            class="cursor-pointer rounded-full border border-line/60 px-6 py-3 text-ink-muted transition-colors duration-200 hover:border-line hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            @click="store.skip()"
          >
            跳过
          </button>
          <button
            type="button"
            :disabled="store.runtime.status === 'idle'"
            class="cursor-pointer rounded-full border border-line/60 px-6 py-3 text-ink-muted transition-colors duration-200 hover:border-line hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            @click="store.reset()"
          >
            重置
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.immersive-enter-active,
.immersive-leave-active {
  transition: opacity 0.25s ease;
}
.immersive-enter-from,
.immersive-leave-to {
  opacity: 0;
}
</style>
