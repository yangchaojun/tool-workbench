---
id: "014"
title: 壳层与首页换肤（布局/导航/首页/404）
labels: [wayfinder:task]
status: done
assignee: zcode-agent
blocked-by: ["013"]
created: 2026-09-06
---

## Question

在 013 的 token 基础上，把应用壳层组件的写死样式对齐新设计系统：

- `WorkbenchLayout.vue` / `WorkbenchNav.vue`：侧边栏分隔改 1px `--color-border`；导航项激活态改 teal 50% 透明底（或近黑文字 500 weight），hover 只做底色/文字色 150ms 过渡；去除浮起阴影与 hover transform。
- `HomeView.vue`：工具卡片墙改「白底/深底 + 1px 边框 + 10px 圆角」卡片，hover 仅边框加深，去 `--shadow-card` 与 translateY；卡片图标/标题层级用 mono + 灰阶表达。
- `NotFoundView.vue` 同步对齐。
- 检查 NDrawer、NConfigProvider 弹层类组件在壳层中的呈现（圆角、边框、无阴影）。
- 验收：375/768/1024/1440px 四档截图过查；对照 MASTER.md「Pre-Delivery Checklist」逐项勾验。
