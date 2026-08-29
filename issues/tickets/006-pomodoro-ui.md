---
id: "006"
title: 番茄钟界面实现
labels: [wayfinder:task]
status: closed
assignee: zcode-agent
blocked-by: ["003", "004", "005"]
created: 2026-08-29
---

## Question

按 003 的设计 tokens 与 005 的状态机实现番茄任务钟页面：

- 环形倒计时（SVG 进度环）+ 模式切换 + 开始/暂停/跳过/重置。
- 任务列表：添加、预估番茄数、选中当前任务、勾选完成、删除；正在专注的任务高亮。
- 今日统计条：今日番茄数 / 专注分钟 / 完成任务数。
- 设置抽屉：时长、长休间隔、自动开始、声音、通知、每日目标。
- `document.title` 显示剩余时间；遵循设计 tokens，简洁清晰。

## Resolution

已落地 `views/PomodoroView.vue` + `components/{TimerRing,TodayStats,TaskList,SettingsDrawer}.vue`，桌面双栏（计时卡 + 统计/任务列）、移动端单列：

- **TimerRing**：SVG 进度环，剩余比例驱动 `stroke-dashoffset`（300ms linear 过渡），专注=强调橙 / 休息=主 teal；中心为 tabular-nums 时钟 + 状态标签 + 长休节奏圆点。
- **交互**：模式段控（仅 idle 可切）；主按钮开始/继续/暂停随状态变形；跳过/重置仅非 idle 可用；`document.title` 计时中显示 `mm:ss · 专注（已暂停）· 工具台`。
- **任务列表**：回车/按钮添加、行内预估步进（±，1-20）、点击行切换当前专注对象（橙色高亮环）、勾选完成（划线 + 活跃指针顺延）、hover 删除；空态 NEmpty。
- **今日统计**：今日番茄（强调色）/ 专注分钟 / 目标进度条（todayFocus / dailyGoal）。
- **设置抽屉**：NDrawer + 五个数字字段 + 三个开关；通知开关开启时请求权限、失败回退并 message.warning；恢复默认一键回 Zod 默认值。
- **走查中修正的两个真实问题**：① naive-ui NInput `inheritAttrs: false` 吞掉 fallthrough keydown —— 回车提交须经 `:input-props` 直接绑内层 input，并带 `isComposing` 守卫（输入法组词回车不提交）；② 图标添加按钮补 `aria-label`（无障碍 checklist）。
