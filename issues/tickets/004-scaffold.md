---
id: "004"
title: 工程脚手架与基础配置
labels: [wayfinder:task]
status: closed
assignee: zcode-agent
blocked-by: ["001"]
created: 2026-08-29
---

## Question

以 001 的版本结论初始化工程：Vite + Vue3 + TS(strict) + Naive UI + Tailwind v4 + Pinia + Router + Zod。

- 三段式 tsconfig（app/node）与 `vue-tsc -b` 类型检查构建脚本；路径别名 `@`。
- Tailwind v4 入口（@tailwindcss/vite + @import "tailwindcss" + dark 变体）。
- Naive UI 全量安装 + NConfigProvider（暗色主题 + zhCN 本地化）。
- 验收：`npm run dev` 可启动、`npm run build` 通过。

## Resolution

- **版本组合**：vue ^3.5.42 / vite ^8.2.2 / @vitejs/plugin-vue ^6.0.8 / typescript ~6.0.3 / vue-tsc ^3.3.11 / naive-ui ^2.45.3 / pinia ^4.0.3 / vue-router ^4.6.4 / zod ^4.5.2 / tailwindcss + @tailwindcss/vite ^4.3.3 / @vicons/ionicons5 ^0.13.0 / @types/node ^22（Node 22.23 实测）。
- **tsconfig 采用单文件方案**（非 create-vite 三段式）：`tsconfig.json` 覆盖 `src/`，strict + verbatimModuleSyntax + moduleResolution bundler；构建脚本 `vue-tsc --noEmit && vite build`。注意 TS 6 弃用 `baseUrl`：`paths` 直接写相对形式 `"./src/*"`。
- Tailwind v4 经 `@tailwindcss/vite` 插件接入；`main.css` 为唯一入口（`@import 'tailwindcss'` + `@custom-variant dark` + `@theme` tokens）。
- Naive UI 全量 `app.use(naive)`（v2 无需 CSS import）；`App.vue` 内 NConfigProvider 挂明暗主题、themeOverrides（主色四态）与 zhCN/dateZhCN。
- **验收通过**：`npm run dev` 启动（实测走查 5199 端口）；`vue-tsc --noEmit` 零错误；`vite build` 成功，番茄钟视图独立 chunk（≈20KB）验证逐工具分包生效。主包 387KB gzip 来自 naive-ui 全量引入，本地工具场景可接受。
