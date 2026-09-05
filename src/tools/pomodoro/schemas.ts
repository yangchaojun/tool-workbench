import { z } from 'zod'

// ── 领域常量 ────────────────────────────────────────────────────

export const phaseEnum = z.enum(['focus', 'shortBreak', 'longBreak'])
export type PomodoroPhase = z.output<typeof phaseEnum>

// ── 设置（约定：所有字段必须带默认值，供 zodStorage 缺字段回落）────

export const pomodoroSettingsSchema = z.object({
  /** 最大 99：与 MM:SS 时钟（含翻页钟）的 4 位显示保持一致 */
  focusMinutes: z.number().int().min(1).max(99).default(25),
  shortBreakMinutes: z.number().int().min(1).max(30).default(5),
  longBreakMinutes: z.number().int().min(5).max(60).default(15),
  /** 每完成 N 个专注进入长休 */
  longBreakEvery: z.number().int().min(2).max(10).default(4),
  autoStartNext: z.boolean().default(false),
  soundEnabled: z.boolean().default(true),
  notifyEnabled: z.boolean().default(false),
  dailyGoal: z.number().int().min(1).max(24).default(8),
  /** 时钟动画形态：ring 环形倒计时 / flip 翻页时钟 */
  clockStyle: z.enum(['ring', 'flip']).default('ring'),
})
export type PomodoroSettings = z.output<typeof pomodoroSettingsSchema>

// ── 任务 ────────────────────────────────────────────────────────

export const pomodoroTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(60),
  estimatedPomodoros: z.number().int().min(1).max(20).default(1),
  completedPomodoros: z.number().int().min(0).default(0),
  done: z.boolean().default(false),
  createdAt: z.number().int(),
})
export type PomodoroTask = z.output<typeof pomodoroTaskSchema>

// ── 专注记录（今日统计的数据源）────────────────────────────────

export const pomodoroSessionSchema = z.object({
  id: z.string().min(1),
  phase: phaseEnum,
  taskId: z.string().nullable(),
  minutes: z.number().int().min(1).max(180),
  endedAt: z.number().int(),
})
export type PomodoroSession = z.output<typeof pomodoroSessionSchema>

// ── 运行时状态（跨刷新恢复用）──────────────────────────────────

export const runtimeSchema = z.object({
  phase: phaseEnum.default('focus'),
  status: z.enum(['idle', 'running', 'paused']).default('idle'),
  /** running 时的绝对截止时间戳（抗后台节流/休眠，回到页面即可校正） */
  endsAt: z.number().nullable().default(null),
  remainingMs: z.number().int().min(0).default(25 * 60_000),
  /** 本轮长休周期内已完成的专注数 */
  completedFocusInCycle: z.number().int().min(0).default(0),
  activeTaskId: z.string().nullable().default(null),
})
export type PomodoroRuntime = z.output<typeof runtimeSchema>

// ── 列表 schema ─────────────────────────────────────────────────

export const taskListSchema = z.array(pomodoroTaskSchema)
export const sessionListSchema = z.array(pomodoroSessionSchema)
