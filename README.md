# 工具台 ToolWorkbench

一个本地优先的个人网页小工具集合平台。简洁清晰，数据全部存于浏览器，不依赖任何服务端。

当前集成工具：

- **番茄任务钟** —— 专注 / 短休 / 长休三段循环、任务绑定预估番茄数、今日统计、浏览器通知与提示音、全屏专注模式（沉浸层 + 桌面端原生全屏，点击环面或空格键切换计时，运行中防息屏）。
- **JSON 编辑器** —— 粘贴或上传 JSON：格式化 / 压缩、语法校验并精确定位错误、容错修复（预览确认）；树形视图直接增删改节点、拖拽排序与按键名排序；查找替换、JSONPath / JMESPath 查询提取、双份数据 Diff 对比、转义 / Unicode 编解码；全程可撤销重做。

## 快速开始

```bash
npm install
npm run dev       # 开发（默认 http://localhost:5173）
npm run build     # 类型检查（vue-tsc）+ 生产构建
npm run preview   # 预览构建产物
npm run test      # vitest 单测（纯逻辑层：修复器 / diff / 历史栈 / 查询封装等）
```

## 技术栈

Vue 3.5（Composition API + `<script setup>`）· TypeScript（strict）· Vite 8 · Naive UI · Tailwind CSS v4 · Pinia · Vue Router · Zod 4

## 架构总览

```
src/
├── main.ts                  # 应用入口：注册 Pinia / Router / Naive UI / 全部工具
├── app/                     # 平台外壳（与具体工具无关）
│   ├── App.vue              # NConfigProvider：明暗主题 + zhCN 本地化
│   ├── router/              # 路由：/ 首页 + /tools/:toolId（动态段）
│   ├── stores/theme.ts      # 暗色模式（持久化）
│   ├── layouts/             # 侧边栏工作台布局 + 导航
│   ├── views/               # 首页工具卡片墙 / ToolHost / 404
│   └── styles/main.css      # Tailwind v4 入口 + 设计 tokens（明暗双主题）
├── core/tools/              # ★ 工具注册契约（平台的心脏）
│   ├── types.ts             # ToolManifest（Zod schema）+ ToolDefinition + defineTool
│   └── registry.ts          # 注册表：registerTool / getTool / listTools
├── shared/
│   ├── storage/zodStorage.ts # Zod 守护的 localStorage 读写（坏数据回落默认值）
│   └── components/code-editor/ # CodeMirror 6 窄契约封装（首个共享组件，见 docs/adr/0001）
└── tools/                   # 工具实现
    ├── index.ts             # ★ 注册表清单 —— 新增工具的唯一改动点
    ├── pomodoro/            # 一个工具一个目录，自包含
    │   ├── tool.ts          # defineTool(...)：manifest + 图标 + 懒加载视图
    │   ├── schemas.ts       # 领域模型（Zod）：settings / task / session / runtime
    │   ├── stores/          # Pinia store：状态机 + 持久化 + 计时核心
    │   ├── utils/           # audio（WebAudio 提示音）/ notify（浏览器通知）
    │   ├── views/           # 工具主视图
    │   └── components/      # 工具私有组件
    └── json-editor/         # JSON 编辑器（容错定位/修复 parser/、diff/、query/，见 ADR-0002/0003）
```

关键设计：

- **路由只有一个动态段** `/tools/:toolId`，由 `ToolHost` 从注册表懒加载对应工具视图，天然按工具分包。
- **侧边栏与首页工具墙都读注册表**（`listTools()`），不存在第二份工具清单。
- **所有持久化走 `loadZodJson` / `saveZodJson`**：读取经 Zod 校验，缺字段回落默认值、坏数据整体回落，schema 演进不会崩。
- **计时基于时间戳（endsAt）**而非累计 tick：后台节流、休眠唤醒、跨刷新都能校正。

## 架构图

> 由 [archify](https://github.com/cathrynlavery/archify) 生成的交互式架构图，含暗/亮双主题与注解，直接用浏览器打开即可浏览：

- **📊 运行时架构图** —— [`diagrams/toolworkbench-runtime.html`](diagrams/toolworkbench-runtime.html)（含 Vite 工具链 → 平台外壳 → 注册表 → 工具实现的运行时全景）
- **📐 图源数据**（JSON）—— [`diagrams/toolworkbench-runtime.architecture.json`](diagrams/toolworkbench-runtime.architecture.json)
- **📸 视觉检查快照** —— [`diagrams/toolworkbench-runtime.visual-check.html`](diagrams/toolworkbench-runtime.visual-check.html)（暗/亮主题 × 1440×900 / 2048×1320）

生成方式：`diagrams` 目录下按 archify 流程输入架构描述重新生成即可，产物以 `toolworkbench-runtime.*` 命名。

## 如何新增一个工具

以一个假设的「JSON 格式化」为例，全程只有两步：

**第一步：建目录 `src/tools/json-formatter/`，写 `tool.ts`：**

```ts
import { defineTool } from '@/core/tools/types'
import { GitNetworkOutline } from '@vicons/ionicons5'

export const jsonFormatterTool = defineTool({
  manifest: {
    id: 'json-formatter',            // 小写字母/数字/连字符，全局唯一
    name: 'JSON 格式化',
    description: '粘贴 JSON，一键格式化、校验与压缩。',
    accent: '#0d9488',               // 工具点缀色（首页卡片等处使用）
  },
  icon: GitNetworkOutline,           // 侧边栏与卡片图标（@vicons）
  component: () => import('./views/JsonFormatterView.vue'),  // 懒加载，逐工具分包
})
```

**第二步：在 `src/tools/index.ts` 注册：**

```ts
registerTool(jsonFormatterTool)
```

完成。路由（`/tools/json-formatter`）、侧边栏入口、首页卡片、懒加载分包全部自动获得，平台外壳一行代码都不用改。

工具内部需要状态时：用 Pinia setup store + `shared/storage/zodStorage.ts` 做持久化（参考 `tools/pomodoro/stores/pomodoro.ts`）；设置类状态也由工具自管，schema 内联 `.default()` 保证缺字段回默认、坏数据整体回落。

## 设计系统

由 ui-ux-pro-max 生成并持久化在 `design-system/toolworkbench/MASTER.md`：

- 风格：Minimalism & Swiss（简洁、留白、高对比、几何）
- 色板：主色 teal `#0D9488`，强调色 orange `#EA580C`（番茄钟的工具色），中性面语义化 tokens
- 设计 tokens 落在 `src/app/styles/main.css` 的 `@theme` 块；暗色主题通过覆盖 CSS 变量实现，Tailwind 工具类运行时引用变量自动换肤，与 Naive UI `darkTheme` 同步切换

## 数据与隐私

- 全部数据（任务、专注记录、设置、主题）仅存于本机浏览器的 localStorage，键名前缀 `tw:`。
- 不发送任何网络请求（无账号、无同步、无统计）。

## 开发流程

本仓库使用 wayfinder 管理规划：地图在 `issues/map.md`，决策 tickets 在 `issues/tickets/`。
