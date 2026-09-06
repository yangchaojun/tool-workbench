---
id: "015"
title: 两个工具页组件级换肤（json-editor / pomodoro）
labels: [wayfinder:task]
status: done
assignee: zcode-agent
blocked-by: ["014"]
created: 2026-09-06
---

## Question

token 换肤后各工具 `<style scoped>` 与组件结构里的旧风格残留需要逐个修正：

- **json-editor**（EditorPane、TreePane、TreeRow、TreeView、DiffTree、QueryPanel、FindReplaceBar、HistoryPanel、RepairModal、LoadConfirmModal）：JSON 树/文本视图的语法高亮接 013 的四色 token（CodeMirror 高亮主题与 TreeRow 内联色）；工具栏按钮改 ghost 扁平（激活态 teal 50% 底）；各弹层（Modal）去阴影、10px 圆角、1px 边框；行高对齐 15px/26px。
- **pomodoro**（FlipClock、TimerRing、TaskList、SettingsDrawer、FullscreenOverlay、TodayStats、FlipDigit）：保留翻页钟/计时环的功能形态与 `tabular-nums`，但配色并入中性灰 + teal；`rounded-full` 大按钮按 MASTER.md 收敛（圆形图标按钮可保留 full，胶囊按钮改 8px）；FullscreenOverlay 的 hover scale 移除。
- 共享 `CodeEditor.vue`（kit.ts 的 CodeMirror 主题）与新语法色 token 对齐，diff 高亮色双主题校验。
- 验收：`pnpm typecheck` + `pnpm test` + 既有 e2e（工单 008 的验证路径）通过；双工具在 light/dark 下人工过查一轮；对照 MASTER.md checklist 勾验。
