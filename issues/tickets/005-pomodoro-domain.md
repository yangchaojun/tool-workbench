---
id: "005"
title: 番茄钟领域模型、状态机与持久化
labels: [wayfinder:task]
status: closed
assignee: zcode-agent
blocked-by: ["002"]
created: 2026-08-29
---

## Question

标准版番茄钟的领域层：

- 状态机：phase（focus / shortBreak / longBreak）× status（idle / running / paused）；长休节奏（每 N 个专注进入长休）；自动开始下一段。
- 计时基于时间戳（endsAt）而非累计 tick——抗浏览器后台节流与休眠唤醒。
- Zod schema：settings / task（标题、预估番茄数、已完成数、完成态）/ session record（今天统计的数据源）；localStorage 键约定 `tw:pomodoro:*`。
- 完成反馈：Notification API（权限在用户开启开关时请求）+ WebAudio 提示音（无资源文件）。

## Resolution

已落地 `src/tools/pomodoro/`（schemas.ts + stores/pomodoro.ts + utils/），UI 仅消费 store：

- **状态机**：`runtime.phase × status`；focus 完成 → `completedFocusInCycle++`，`(cycle % longBreakEvery === 0)` 决定长休/短休；break 完成 → focus。`skip` 不记账直接推进；`reset` 回到当前段起点；`switchPhase` 仅 idle 可用。
- **时间戳计时**：running 时只存 `endsAt`，250ms interval 仅做「读钟 → 校正 remainingMs → 到点 completePhase」；后台节流/休眠唤醒/切页均不偏移。**跨刷新恢复**：reload 后 running → 按时间戳校正为 paused；若已到点则静默记账并推进（不响铃不通知）。
- **Zod schema**（`schemas.ts`）：settings（8 字段全默认值）/ task（预估与已完成番茄数）/ session record（phase、taskId、minutes、endedAt）；列表 schema 派生；持久化键 `tw:pomodoro:{settings,tasks,sessions,runtime}`，runtime 仅在关键跃迁落盘（不随 tick 写）；sessions 上限 2000 条截断。
- **完成反馈**：`announce()` = WebAudio 三音上行（E5-A5-D6，AudioContext 在「开始」的用户手势中创建以满足自动播放策略）+ Notification（权限在设置开关开启时请求，拒绝则回退并提示）。
- **任务联动**：addTask 无当前任务时自动选中；focus 完成自动给当前任务 `completedPomodoros++`；任务完成/删除时活跃指针顺延。
