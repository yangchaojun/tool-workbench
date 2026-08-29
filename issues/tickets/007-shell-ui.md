---
id: "007"
title: 平台外壳与首页工具墙
labels: [wayfinder:task]
status: closed
assignee: zcode-agent
blocked-by: ["002", "003", "004"]
created: 2026-08-29
---

## Question

平台外壳实现：

- 侧边栏导航（工具列表来自注册表，而非硬编码）+ 首页工具卡片墙（图标、名称、描述、accent 点缀）。
- 暗色模式切换（平台级 store，持久化，同步 Naive UI darkTheme 与 Tailwind `.dark`）。
- 未知工具 id 的 404 兜底页；移动端响应式（侧栏折叠）。

## Resolution

已落地 `layouts/{WorkbenchLayout,WorkbenchNav}.vue` + `views/{HomeView,ToolHost,NotFoundView}.vue`：

- **导航完全由注册表驱动**：侧边栏（及移动抽屉）用 `listTools()` 渲染，工具无需在任何 UI 处登记第二份清单；品牌区 + 首页 + 「工具」分组 + 底部主题切换与「本地运行 · 数据仅存于浏览器」注脚。
- **首页**：日期 + 时段问候 + 工具卡片墙（accent 染色图标砖 + 名称 + 描述，hover 轻浮起），grid 1/2/3 列响应式；注脚指向 README 契约文档。
- **暗色模式**：theme store（Zod 守护持久化 `tw:theme`）→ `documentElement.classList.toggle('dark')` 同步 Tailwind 变量皮肤与 NConfigProvider darkTheme；index.html 内联脚本首帧防闪白。
- **双兜底**：未知工具 id → ToolHost 页内提示（保持外壳）；未知路由 → 独立 404 页（带外壳与回首页按钮）。
- **移动端**：<768px 顶栏（汉堡按钮 + 品牌）+ NDrawer 导航，路由跳转自动收起。
