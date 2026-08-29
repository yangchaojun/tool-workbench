---
id: "001"
title: 选型与集成研究：依赖版本矩阵与 Tailwind v4 × Naive UI 要点
labels: [wayfinder:research]
status: closed
assignee: zcode-agent
blocked-by: []
created: 2026-08-29
---

## Question

截至 2026-08，以下依赖的最新稳定版本与关键协同配置是什么？

- 版本矩阵：vue / vite / @vitejs/plugin-vue / typescript / vue-tsc / naive-ui / pinia / vue-router / tailwindcss / @tailwindcss/vite / zod / @vicons/ionicons5 / @types/node；重点核实大版本跳跃处的配对（Vite 8 × @vitejs/plugin-vue、TypeScript 7 × vue-tsc、Vue Router 5 / Pinia 4 的 API 兼容性）。
- Tailwind v4（CSS-first、@tailwindcss/vite）与 Naive UI 共存的已知冲突与正确配置（preflight 对 NButton/NInput 的影响）。
- Tailwind v4 基于 `.dark` class 的暗色变体（@custom-variant）的当前推荐写法。
- Naive UI 暗色主题（NConfigProvider + darkTheme + themeOverrides）与 zhCN/dateZhCN 本地化接入；确认 naive-ui 全量安装无需单独引 CSS。
- Zod 4 相对 v3 对基础用法（object/default/safeParse/infer/enum/record/partial）有无破坏性差异。

## Resolution

（research 子代理实测 npm registry + 官方文档，2026-08-29）

- **版本矩阵**：vue 3.5.42 / vite 8.2.2 / @vitejs/plugin-vue 6.0.8 / naive-ui 2.45.3 / pinia 4.0.3 / tailwindcss + @tailwindcss/vite 4.3.3 / zod 4.5.2 / @vicons/ionicons5 0.13.0 / vue-tsc 3.3.11。**TypeScript 不用 latest（7.0.2 是 tsgo 原生编译器，无 JS API，vue-tsc 3.x 未适配）**，采用 6.x 线（~6.0.3，官方模板同款）。**Vue Router 采用 4.6.4**：5.3.0 的 peer 依赖模型反常（声明 vite/pinia/@pinia/colada peer，npm 会自动拖入不需要的包），4.x API 稳定。@types/node 22 对齐运行时 Node 22。
- **Tailwind v4 × Naive UI：preflight 不是问题，方向与 v3 相反**。v4 把 preflight 放进 `@layer base`，naive-ui 样式由 css-render 运行时注入、不分层 —— 未分层样式优先级高于所有分层样式，故 preflight 不会覆盖 NButton/NInput。真正要注意的反而是：Tailwind 工具类覆盖不了 naive 默认样式（需 `!` important 后缀或 themeOverrides）。
- **暗色变体**：`@custom-variant dark (&:where(.dark, .dark *));` 为 v4 官方推荐写法（已确认）。
- **Naive UI**：v2 全量 `app.use(naive)` 无需任何 CSS import；`darkTheme / zhCN / dateZhCN / GlobalThemeOverrides` 均从 'naive-ui' 导出（已在 2.45.3 d.ts 实证）。
- **Zod 4 基础用法兼容**；注意点：`z.record` 必须两参数、`.default()` 短路（输入 undefined 直接返回默认值）、错误定制统一为 `error` 参数。

参考：naive-ui #6828 · tailwindcss.com/docs/dark-mode · zod.dev/v4/changelog
