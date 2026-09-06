---
id: "013"
title: 设计 token 替换为中性灰体系（ADR-0006）
labels: [wayfinder:task]
status: done
assignee: zcode-agent
blocked-by: []
created: 2026-09-06
---

## Question

按 `docs/adr/0006` 与新版 `design-system/toolworkbench/MASTER.md`，把 token 层整体替换为 jsonview 风格的中性灰体系：

- `src/app/styles/main.css` 的 `@theme`：色板按 MASTER.md「Color Palette」双主题表替换（背景/前景/主操作近黑、teal `#008C96` 为唯一强调、orange 废弃、边框/输入/焦点 token 齐备）；新增 JSON 语法高亮四色 token（string/number/boolean/null + search match，双主题）；圆角 token 8px（面板 10px）；删除全部 shadow token。
- 字体：全局切系统等宽栈 `ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, 'Liberation Mono', 'PingFang SC', 'Microsoft YaHei', monospace`（同步改 `App.vue` 的 Naive UI `themeOverrides.common.fontFamily`）；UI 文字 14px、JSON 区 15px/26px。
- `App.vue` 的 Naive UI `themeOverrides`：primary 改近黑、borderRadius 8px、去一切 boxShadow，确保 NButton/NTabs/NDrawer/NModal 等已用组件在双主题下呈扁平观感。
- `index.html` 首帧主题脚本与 localStorage `tw:theme` 机制不动；默认主题维持 light。
- 验收：grep 全局无 `box-shadow`（focus ring 除外）、无 hover transform；`pnpm typecheck` + `pnpm test` 通过；light/dark 双主题下首页、两个工具页无残留旧 teal 浅青配色。
