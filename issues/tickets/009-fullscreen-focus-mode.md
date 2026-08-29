---
id: "009"
title: 番茄钟全屏专注模式
labels: [wayfinder:task]
status: closed
assignee: zcode-agent
blocked-by: []
created: 2026-08-29
---

## Question

给番茄任务钟增加「全屏运行」。经 grilling（用户未逐项作答，按推荐项执行并记录）：全屏 = 沉浸层为底 + 桌面端 Fullscreen API 增强（iOS 等无该 API 环境自动降级）；内容 = 极简专注版（巨钟 + 阶段标识 + 当前任务 + 主控，不放列表/统计/设置）；随时手动进出（Esc + 右上角退出）；附加行为 = 点击环面切换、空格键切换（交互元素焦点时不拦截）、Wake Lock 防息屏（能力检测）、强制深色沉浸。

## Resolution

已落地 `components/FullscreenOverlay.vue` + `shared/composables/useWakeLock.ts`，TimerRing 增加 `large` 尺寸：

- **架构**：Teleport 覆盖层而非新路由（同一状态机的另一种呈现）；沉浸层内不用 naive 组件（其未分层样式压过工具类、主题跟随全局会与强制深色冲突），纯 Tailwind + 设计 token；根节点挂 `.dark` class 使整套 token 自动切暗色值，亮色主题下进入也是深色沉浸。
- **行为**：进入时 requestFullscreen（documentElement，失败静默降级）+ 锁 body 滚动 + 运行中申请 Wake Lock（页面隐藏自动释放、重新可见补拿）；退出 = 右上角按钮 / Esc（原生全屏下浏览器先退，fullscreenchange 事件同步关闭沉浸层）；组件卸载时兜底退出原生全屏，避免孤立全屏。
- **入口位置（经用户反馈修正）**：初版放在计时卡片右上角悬浮，用户指出不合适；经 ui-ux-pro-max 两轮检索无直接命中条目，按通用准则（视图级操作就近成组）移至页头，与设置按钮组成图标操作组 `番茄任务钟 …… [⛶][⚙]`，计时卡回归纯内容。
- **验证**：vue-tsc + build 通过；浏览器实测进入（原生全屏激活、滚动锁定、亮色主题下强制深色）、点击环面启动计时（24:59 专注中，主按钮变形）、退出（原生全屏退出、滚动恢复、计时后台继续）、页头动作组结构验证（同排同组）；后台标签页过渡冻结属环境节流，非应用缺陷。
