---
title: 工具台 ToolWorkbench：平台骨架 + 番茄任务钟
labels: [wayfinder:map]
created: 2026-08-29
---

## Destination

tool-workbench 可运行：一个以「工具注册契约」为核心的小工具平台骨架（Vite + Vue3 + TS + Naive UI + Tailwind + Pinia + Router + Zod）交付，第一个工具「番茄任务钟（标准版）」可用；此后集成新工具只需按契约新增一个目录、并在注册表加一行。

**状态：已抵达（2026-08-29）。全部 tickets 闭环，路线清空。**

## Notes

- 域：前端单页应用；数据全部本地（localStorage，Zod 校验边界）；界面简体中文。
- 技能约定：UI 设计一律先咨询 /ui-ux-pro-max；外部知识问题用 /research 子代理解决。
- **流程 override（经用户确认）**：本 effort 建图后同一会话连续施工，ticket 逐个闭环，不做 plan-only 停顿。
- tracker 约定（local-markdown，仓库未配置其它 tracker 时的默认）：地图 = `issues/map.md`；ticket = `issues/tickets/<id>-<slug>.md`，frontmatter 持有 `status`/`assignee`/`blocked-by`；阻塞边写在 frontmatter（markdown 无原生依赖关系，此为约定回退）。认领 = 把 `assignee` 写成执行者。
- 绘图前 grilling 已定决策：
  - 番茄钟范围 = 标准版（专注/短休/长休三段循环、时长可配置、任务列表绑定预估番茄数、今日统计、浏览器通知）。
  - 后续工具方向 = JSON/文本工具、笔记/Markdown（用于契约设计，本次不实现）。
  - 界面语言 = 简体中文，不引入 i18n 层。
  - 技术栈 = Vue3 + Naive UI + Tailwind CSS + Vite + Pinia + Vue Router + TS + Zod。
  - 风格 = 简洁但清晰，UI 走 /ui-ux-pro-max。

## Decisions so far

- [选型与集成研究](issues/tickets/001-stack-integration-research.md) — TS 锁 6.x（7.0 tsgo 无 JS API，vue-tsc 未适配）；Router 取 4.6.4（5.x peer 模型反常）；Tailwind v4 preflight 与 Naive UI 无冲突（naive 样式未分层优先级更高，反倒是工具类覆盖 naive 需 `!` 后缀）；Zod 4 基础用法兼容。
- [工具注册契约（ToolDefinition）设计](issues/tickets/002-tool-registry-contract.md) — manifest 纯数据（Zod 校验）+ icon 组件 + 懒加载视图 + settingsSchema；单一动态段 `/tools/:toolId` + ToolHost；`loadZodJson` 守护持久化（缺字段回落默认值、坏数据整体回落）；新增工具 = 1 目录 + 1 行。
- [设计语言与信息架构](issues/tickets/003-design-tokens-ia.md) — Minimalism & Swiss；teal `#0D9488` 主色 + orange `#EA580C` 强调；tokens 落 Tailwind v4 `@theme`，暗色覆盖 CSS 变量与 darkTheme 同步；系统字体栈不引外部 CDN；侧边栏工作台 + 首页卡片墙；设计系统持久化于 `design-system/toolworkbench/MASTER.md`。
- [工程脚手架与基础配置](issues/tickets/004-scaffold.md) — vite 8.2.2 / vue 3.5.42 / ts ~6.0.3 / naive-ui 2.45.3 / pinia 4 / router 4.6.4 / zod 4.5.2 / tailwind 4.3.3；单 tsconfig + `vue-tsc --noEmit && vite build`；逐工具分包验证生效。
- [番茄钟领域模型、状态机与持久化](issues/tickets/005-pomodoro-domain.md) — 时间戳计时（endsAt）抗节流/休眠；跨刷新恢复（running→paused 校正、到点静默记账推进）；`tw:pomodoro:*` 四键；WebAudio（手势内建 AudioContext）+ Notification（开关处请求权限）。
- [番茄钟界面实现](issues/tickets/006-pomodoro-ui.md) — 环形倒计时/段控/任务列表/今日统计/设置抽屉全量落地；两个经验沉淀：NInput 的 fallthrough 事件被 `inheritAttrs:false` 吞掉，键盘事件须经 `:input-props` 直绑内层 input 且带 isComposing 守卫；图标按钮必须补 aria-label。
- [平台外壳与首页工具墙](issues/tickets/007-shell-ui.md) — 导航完全由注册表驱动；暗色持久化 `tw:theme` + 首帧防闪白脚本；未知工具/未知路由双兜底；移动端顶栏 + 抽屉。
- [端到端验证与交付](issues/tickets/008-verify-e2e.md) — 类型检查与构建零错误；浏览器实测（计时推进/暂停/跳过/持久化/暗色/404/375px 响应式）通过并双主题截图比对；环境限制（IAB 合成按键不可靠）已记录。
- [番茄钟全屏专注模式](issues/tickets/009-fullscreen-focus-mode.md) — 沉浸层 + Fullscreen API 增强（自动降级）；Teleport 覆盖层不用 naive 组件，根挂 `.dark` 强制深色沉浸；点击环面/空格切换、Wake Lock 防息屏；入口经用户反馈从计时卡角落移至页头动作组（与设置成组）。

## Not yet specified

（目的地已抵达，暂无在途迷雾。下列事项属于后续 effort 的种子，不在本图范围。）

- JSON/文本、笔记类工具立项时的具体形态与所需共享设施（编辑器组件、导入导出约定）。
- 持久化升级路径（数据导出/导入、跨设备同步）。
- 浏览器通知/声音权限请求的平台级 UX 约定上收。
- 若未来引入第二、三个工具后出现共性组件，考虑沉淀 `shared/components/`。

## Out of scope

- 本次不实现番茄钟以外的具体工具（只保证契约容纳得下）。
- 账号体系与云同步。
- PWA / 离线安装 / 移动原生。
- CI 与部署流水线。
