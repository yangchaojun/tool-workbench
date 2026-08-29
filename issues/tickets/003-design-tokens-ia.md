---
id: "003"
title: 设计语言与信息架构（ui-ux-pro-max）
labels: [wayfinder:task]
status: closed
assignee: zcode-agent
blocked-by: []
created: 2026-08-29
---

## Question

平台外壳与工具页的视觉/交互设计，经 /ui-ux-pro-max 产出：

- 布局与信息架构：侧边栏工作台 + 首页工具卡片墙（还是其它形态）、移动端响应式策略。
- 设计 tokens：色板（中性色 + 平台 accent + 工具级 accent）、字号层级、间距、圆角、阴影；明暗双主题。
- 交互基调：简洁但清晰——留白、层级、状态反馈。

## Resolution

经 ui-ux-pro-max `--design-system`（variance 2 / motion 3 / density 5）生成并持久化至 `design-system/toolworkbench/MASTER.md`：

- **风格**：Minimalism & Swiss —— 干净、留白、高对比、几何、功能性。明暗双主题均支持。
- **色板**：主色 teal `#0D9488`（品牌/主操作），强调色 orange `#EA580C`（CTA/点缀，天然适配番茄钟工具色），卡片白 + 浅青底面，destructive `#DC2626`；暗色派生为深青灰面（surface #0C161E / card #122028）+ 更亮的主/强调色（#2DD4BF / #FB923C）保证对比度。
- **落地方式**：tokens 集中在 `src/app/styles/main.css` 的 Tailwind v4 `@theme`；语义色（surface/card/ink/line/primary/accent）在 `.dark` 下覆盖 CSS 变量 —— 工具类运行时引用变量，换肤零工具类改动；与 Naive UI `darkTheme` + `themeOverrides` 同步切换。`index.html` 内联首帧主题脚本防闪白。
- **字体**：采用系统字体栈（Inter 优先 + PingFang SC / Microsoft YaHei），**不引外部字体 CDN**（离线可用、境内访问友好）；计时数字用 `tabular-nums`。
- **信息架构**：桌面端 240px 固定侧边栏（品牌 / 首页 / 工具清单 / 主题切换）+ max-w-5xl 内容区；移动端（<768px）顶栏 + NDrawer 抽屉导航；首页为问候语 + 工具卡片墙（1/2/3 列响应式网格）。
- **交互基调**：200-250ms 微过渡、卡片 hover 轻浮起、遵循 `prefers-reduced-motion`、图标全 SVG（@vicons，禁 emoji 图标）、可见焦点与 4.5:1 对比（checklist 见 MASTER.md）。
