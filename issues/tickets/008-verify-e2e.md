---
id: "008"
title: 端到端验证与交付
labels: [wayfinder:task]
status: closed
assignee: zcode-agent
blocked-by: ["006", "007"]
created: 2026-08-29
---

## Question

- `vue-tsc -b && vite build` 通过；dev server 启动后浏览器走查：加载、计时推进、任务增删、设置持久化（刷新后保留）、暗色切换、未知路由 404。
- 截图确认视觉与 003 tokens 一致。
- README 记录「如何新增一个工具」（契约用法），作为可拓展性的验收文书。

## Resolution

**构建**：`vue-tsc --noEmit` 零错误（TS 6.0.3 + strict）；`vite build` 成功。修复走查中发现的 3 个 TS/代码问题（TS6 弃用 baseUrl、paths 相对写法、泛型 z.output spread 收窄）。

**浏览器实测走查**（Vite dev + IAB，明暗双主题截图比对）：

- 首页卡片墙 / 侧边栏活跃态 / 番茄钟页完整渲染 ✓（异步分包加载正常）
- 计时推进：启动 25:00 → 2.6s 后 24:58，`document.title` 同步 `24:58 · 专注 · 工具台` ✓
- 暂停（标题含「已暂停」）、跳过（进入短休 05:00）✓
- 刷新持久化：任务与设置跨 reload 保留 ✓；主题持久化（`tw:theme`）✓
- 暗色模式切换与视觉比对：双主题均与 MASTER.md tokens 一致 ✓
- 未知工具 id 页内兜底 + 未知路由 404 页 ✓
- 移动端 375px：顶栏 + 单列布局 ✓
- 设置抽屉字段/开关/默认值 ✓

**环境限制记录**（非应用缺陷）：IAB 合成 `press("Enter")` 大概率不派发 keydown（window 捕获层 0 事件），无法在自动化内验证回车路径；真实键盘路径经代码审查确认（input-props 直接绑定 + isComposing 守卫 + 空提交幂等）。任务输入「按钮路径」实测两次均入库+清空 ✓。

**交付物**：README.md（含「如何新增一个工具」契约指南）；走查中发现的问题已闭环修复（006 记录）。
