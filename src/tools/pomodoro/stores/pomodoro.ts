import { computed, reactive, watch } from 'vue'
import { defineStore } from 'pinia'

import { getTool } from '@/core/tools/registry'
import { loadZodJson, saveZodJson } from '@/shared/storage/zodStorage'

import { playChime, prepareAudio } from '../utils/audio'
import { sendNotification } from '../utils/notify'
import {
  pomodoroSettingsSchema,
  runtimeSchema,
  sessionListSchema,
  taskListSchema,
} from '../schemas'
import type { PomodoroPhase, PomodoroSession } from '../schemas'

const SETTINGS_KEY = 'tw:pomodoro:settings'
const TASKS_KEY = 'tw:pomodoro:tasks'
const SESSIONS_KEY = 'tw:pomodoro:sessions'
const RUNTIME_KEY = 'tw:pomodoro:runtime'

const SESSIONS_CAP = 2000

export const phaseMeta: Record<PomodoroPhase, { label: string }> = {
  focus: { label: '专注' },
  shortBreak: { label: '短休' },
  longBreak: { label: '长休' },
}

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const usePomodoroStore = defineStore('pomodoro', () => {
  const settings = reactive(
    loadZodJson(SETTINGS_KEY, pomodoroSettingsSchema, pomodoroSettingsSchema.parse({})),
  )
  const tasks = reactive(loadZodJson(TASKS_KEY, taskListSchema, []))
  const sessions = reactive(loadZodJson(SESSIONS_KEY, sessionListSchema, []))
  const runtime = reactive(loadZodJson(RUNTIME_KEY, runtimeSchema, runtimeSchema.parse({})))

  let ticker: number | null = null

  // ── 派生 ──────────────────────────────────────────────────────

  const totalMs = computed(() => {
    const minutes =
      runtime.phase === 'focus'
        ? settings.focusMinutes
        : runtime.phase === 'shortBreak'
          ? settings.shortBreakMinutes
          : settings.longBreakMinutes
    return minutes * 60_000
  })

  const clockText = computed(() => {
    const total = Math.ceil(runtime.remainingMs / 1000)
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  })

  const statusLabel = computed(() => {
    if (runtime.status === 'paused') return '已暂停'
    if (runtime.status === 'running')
      return runtime.phase === 'focus' ? '专注中' : '休息中'
    return '准备就绪'
  })

  const cycleDots = computed(() => {
    const filled =
      runtime.phase === 'longBreak'
        ? settings.longBreakEvery
        : runtime.completedFocusInCycle % settings.longBreakEvery
    return Array.from({ length: settings.longBreakEvery }, (_, i) => i < filled)
  })

  const todayStart = computed(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  })
  const todayFocusSessions = computed(() =>
    sessions.filter((s) => s.phase === 'focus' && s.endedAt >= todayStart.value),
  )
  const todayFocusCount = computed(() => todayFocusSessions.value.length)
  const todayFocusMinutes = computed(() =>
    todayFocusSessions.value.reduce((acc, s) => acc + s.minutes, 0),
  )

  // ── 计时核心：时间戳驱动，不依赖 tick 累计 ────────────────────

  function tick() {
    if (runtime.status !== 'running' || runtime.endsAt === null) return
    runtime.remainingMs = Math.max(0, runtime.endsAt - Date.now())
    if (runtime.remainingMs === 0) completePhase()
  }

  function startTicker() {
    if (ticker === null) ticker = window.setInterval(tick, 250)
  }

  function stopTicker() {
    if (ticker !== null) {
      window.clearInterval(ticker)
      ticker = null
    }
  }

  function start() {
    if (runtime.status === 'running') return
    prepareAudio()
    const target =
      runtime.status === 'paused' && runtime.remainingMs > 0
        ? runtime.remainingMs
        : totalMs.value
    if (target <= 0) return
    runtime.remainingMs = target
    runtime.endsAt = Date.now() + target
    runtime.status = 'running'
    startTicker()
  }

  function pause() {
    if (runtime.status !== 'running') return
    runtime.remainingMs = Math.max(0, (runtime.endsAt ?? Date.now()) - Date.now())
    runtime.endsAt = null
    runtime.status = 'paused'
    stopTicker()
  }

  function reset() {
    stopTicker()
    runtime.status = 'idle'
    runtime.endsAt = null
    runtime.remainingMs = totalMs.value
  }

  /** 仅 idle 时可切换模式 */
  function switchPhase(phase: PomodoroPhase) {
    if (runtime.status !== 'idle' || runtime.phase === phase) return
    runtime.phase = phase
    runtime.remainingMs = totalMs.value
  }

  /** 跳过当前段：不记账，直接进入下一段（运行中/暂停可用） */
  function skip() {
    if (runtime.status === 'idle') return
    stopTicker()
    advanceTo(nextPhaseAfter(runtime.phase, runtime.completedFocusInCycle))
  }

  function nextPhaseAfter(finished: PomodoroPhase, focusDone: number): PomodoroPhase {
    if (finished !== 'focus') return 'focus'
    return focusDone > 0 && focusDone % settings.longBreakEvery === 0
      ? 'longBreak'
      : 'shortBreak'
  }

  function advanceTo(phase: PomodoroPhase) {
    runtime.phase = phase
    runtime.status = 'idle'
    runtime.endsAt = null
    runtime.remainingMs = totalMs.value
  }

  /**
   * 当前段自然结束：记账 → 推进 → 提示（quiet=true 时静默，
   * 用于「离开页面期间已结束」的恢复路径）。
   */
  function completePhase(quiet = false) {
    stopTicker()
    const finished = runtime.phase
    recordSession(finished)
    if (finished === 'focus') {
      if (runtime.activeTaskId !== null) creditTask(runtime.activeTaskId)
      runtime.completedFocusInCycle += 1
    }
    advanceTo(nextPhaseAfter(finished, runtime.completedFocusInCycle))
    if (quiet) return
    announce(finished)
    if (settings.autoStartNext) start()
  }

  function recordSession(phase: PomodoroPhase) {
    const session: PomodoroSession = {
      id: uid(),
      phase,
      taskId: phase === 'focus' ? runtime.activeTaskId : null,
      minutes: Math.max(1, Math.round(totalMs.value / 60_000)),
      endedAt: Date.now(),
    }
    sessions.push(session)
    if (sessions.length > SESSIONS_CAP) {
      sessions.splice(0, sessions.length - SESSIONS_CAP)
    }
  }

  function creditTask(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (task) task.completedPomodoros += 1
  }

  function announce(finished: PomodoroPhase) {
    if (settings.soundEnabled) playChime()
    if (settings.notifyEnabled) {
      sendNotification(
        finished === 'focus' ? '专注完成' : '休息结束',
        finished === 'focus' ? '已完成一个番茄，休息一下吧。' : '准备好了，就继续下一个番茄。',
      )
    }
  }

  // ── 任务 ──────────────────────────────────────────────────────

  function addTask(title: string) {
    const trimmed = title.trim()
    if (!trimmed) return
    tasks.unshift({
      id: uid(),
      title: trimmed,
      estimatedPomodoros: 1,
      completedPomodoros: 0,
      done: false,
      createdAt: Date.now(),
    })
    if (runtime.activeTaskId === null) runtime.activeTaskId = tasks[0]?.id ?? null
  }

  function removeTask(taskId: string) {
    const index = tasks.findIndex((t) => t.id === taskId)
    if (index === -1) return
    tasks.splice(index, 1)
    if (runtime.activeTaskId === taskId) {
      runtime.activeTaskId = tasks.find((t) => !t.done)?.id ?? null
    }
  }

  function toggleTaskDone(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    task.done = !task.done
    if (task.done && runtime.activeTaskId === taskId) {
      runtime.activeTaskId = tasks.find((t) => !t.done)?.id ?? null
    }
  }

  /** 点击任务行切换「当前专注对象」；已完成的任务不可选中 */
  function setActiveTask(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.done) return
    runtime.activeTaskId = runtime.activeTaskId === taskId ? null : taskId
  }

  function changeEstimate(taskId: string, delta: number) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    task.estimatedPomodoros = Math.min(20, Math.max(1, task.estimatedPomodoros + delta))
  }

  function resetSettings() {
    Object.assign(settings, pomodoroSettingsSchema.parse({}))
  }

  // ── 持久化（runtime 只在关键跃迁时落盘，不随 tick 写）─────────

  watch(settings, (v) => saveZodJson(SETTINGS_KEY, v), { deep: true })
  watch(tasks, (v) => saveZodJson(TASKS_KEY, v), { deep: true })
  watch(sessions, (v) => saveZodJson(SESSIONS_KEY, v), { deep: true })
  watch(
    () => [
      runtime.phase,
      runtime.status,
      runtime.endsAt,
      runtime.completedFocusInCycle,
      runtime.activeTaskId,
    ],
    () => saveZodJson(RUNTIME_KEY, runtime),
  )

  // idle 时剩余时间跟随设置/模式变化
  watch(totalMs, (ms) => {
    if (runtime.status === 'idle') runtime.remainingMs = ms
  })

  // 标题栏：计时中显示倒计时，空闲显示工具名
  const toolName = getTool('pomodoro')?.manifest.name ?? '番茄任务钟'
  watch(
    [clockText, () => runtime.status, () => runtime.phase],
    () => {
      if (runtime.status === 'idle') {
        document.title = `${toolName} · 工具台`
        return
      }
      const suffix = runtime.status === 'paused' ? '（已暂停）' : ''
      document.title = `${clockText.value} · ${phaseMeta[runtime.phase].label}${suffix} · 工具台`
    },
  )

  // ── 跨刷新恢复：running → 按时间戳校正为 paused；已到点则静默记账推进 ──

  if (runtime.status === 'running') {
    const left =
      runtime.endsAt !== null ? runtime.endsAt - Date.now() : runtime.remainingMs
    runtime.status = 'paused'
    runtime.endsAt = null
    runtime.remainingMs = Math.max(0, Math.min(left, totalMs.value))
    if (runtime.remainingMs === 0) completePhase(true)
  }

  return {
    settings,
    tasks,
    sessions,
    runtime,
    totalMs,
    clockText,
    statusLabel,
    cycleDots,
    todayFocusCount,
    todayFocusMinutes,
    start,
    pause,
    reset,
    skip,
    switchPhase,
    addTask,
    removeTask,
    toggleTaskDone,
    setActiveTask,
    changeEstimate,
    resetSettings,
  }
})
