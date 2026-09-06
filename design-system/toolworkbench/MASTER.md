# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** ToolWorkbench
**Generated:** 2026-09-06（取代 2026-08-29 版本，决策依据见 `docs/adr/0006`）
**Category:** Developer Utility
**Design Dials:** Variance 1/10 (Strict / Neutral) | Motion 2/10 (Micro only) | Density 6/10 (Tool-grade)
**Reference:** jsonview.org —— 中性灰工作台 + 单一 teal 强调 + 全局等宽字体 + 无阴影扁平面板

---

## Global Rules

### Color Palette

中性灰阶承担全部层级表达，teal 是唯一的彩色信号。禁止再引入第二种彩色倾向（原 orange 强调色已废弃）。

| Role | Light | Dark | CSS Variable |
|------|-------|------|--------------|
| Background | `#FFFFFF` | `#0A0A0A` | `--color-background` |
| Foreground | `#0A0A0A` | `#FAFAFA` | `--color-foreground` |
| Card / Panel | `#FFFFFF` + 1px border | `#0A0A0A` + 1px border | `--color-card` |
| Card Foreground | `#0A0A0A` | `#FAFAFA` | `--color-card-foreground` |
| Primary（主操作，近黑） | `#171717` / text `#FAFAFA` | `#FAFAFA` / text `#171717` | `--color-primary` / `--color-on-primary` |
| Secondary（次级面） | `#F5F5F5` | `#262626` | `--color-secondary` |
| Accent（teal 强调） | `#007079` | `#008C96` | `--color-accent` |
| Accent 50% | `#007079BF` | `#008C9680` | `--color-accent-50` |
| Muted | `#EBEBEB` | `#262626` | `--color-muted` |
| Muted Foreground | `#737373` | `#A1A1A1` | `--color-muted-foreground` |
| Border | `#E5E5E5`（hover `#AEAEAE`） | `#292929`（hover `#5D5D5D`） | `--color-border` / `--color-border-hover` |
| Input | bg `#F2F2F2` / border `#D4D4D4` | bg `#262626` / border `#383838` | `--color-input-bg` / `--color-input-border` |
| Destructive | `#E40014` | `#FB2C36`（底 `#82181A`） | `--color-destructive` |
| Ring | `#A1A1A1` | `#525252` | `--color-ring` |

**Color Notes:** 层级只靠灰阶 + 1px 边框 + 底色微差表达；teal 仅用于激活态（Tab 激活底色用 50% 透明 teal）、链接与选中高亮，不做大面积铺色。light 下 accent 加深为 `#007079`：`#008C96` 对白底小字对比 4.04:1 不达 WCAG AA 4.5:1，加深后 5.84:1，teal 可用于任意字号；dark 保持共识色 `#008C96`。

### JSON / Code Syntax Colors

| Token | Light | Dark |
|-------|-------|------|
| String | `#147900` | `#68B457` |
| Number | `#BD6700` | `#D0750A` |
| Boolean | `#8059BB` | `#AD87ED` |
| Null | `#CC243D` | `#F04C5A` |
| Search match | bg `#F8DC90` / text `#161616` | bg `#5A4500` / text `#EEEEEE` |
| Editor highlight | `#0000001F` | `#FFFFFF1F` |

### Typography

- **全局等宽字体（UI + 数据一体）**：`ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, 'Liberation Mono', 'PingFang SC', 'Microsoft YaHei', monospace`
- **不加载任何 webfont**，零字体依赖（同旧决策：离线可用、境内友好；mono 无 CJK 字形，中文自然回退系统字体，可接受）
- **Weight 只用 400 / 500**（激活态用 500，不用 600+）
- **字号**：根 16px；UI 控件文字 14px；JSON 内容区 15px / 行高 26px（`--json-font-size` / `--json-line-height`）
- **Mood:** neutral, flat, precise, terminal-like, developer, quiet

### Spacing Variables

*Density: 6/10 — 工具面板较紧凑*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | 图标与文字微距 |
| `--space-sm` | `8px` | 控件内边距、行间距 |
| `--space-md` | `12-16px` | 面板内边距 |
| `--space-lg` | `24px` | 区块间距 |

### Border & Radius（取代 Shadow Depths）

**禁用所有阴影。** 层级 = 灰阶 + 1px 边框。

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `8px` | 按钮、输入框、Tab、下拉 |
| `--radius-panel` | `10px` | 卡片、模态 |
| `--radius-full` | `9999px` | 仅圆形图标按钮 |

边框层级：容器 `--color-border`；可交互元素 hover 时加深到 `--color-border-hover`；焦点用 `--color-ring` 外圈。

---

## Component Specs

### Buttons

```css
/* Primary：近黑实底 */
.btn-primary {
  background: var(--color-primary);
  color: var(--color-background);
  padding: 6px 14px;
  border-radius: 8px;
  font-weight: 500;
  transition: background 150ms ease, color 150ms ease;
}

/* Secondary / Ghost：透明或灰面，无描边阴影 */
.btn-ghost {
  background: transparent;
  color: var(--color-muted-foreground);
  border-radius: 8px;
}
.btn-ghost:hover {
  background: var(--color-muted);
  color: var(--color-foreground);
}
```

禁止：`transform: translateY(...)` 悬浮、`box-shadow` 悬浮、hover 改变元素尺寸。hover 只允许底色/文字/边框颜色过渡。

### Cards / Panels

```css
.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 16px;
}
.card:hover { border-color: var(--color-border-hover); } /* 仅可点击卡片 */
```

### Inputs

```css
.input {
  background: var(--color-input-bg);
  border: 1px solid var(--color-input-border);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 14px;
  transition: border-color 150ms ease;
}
.input:focus {
  border-color: var(--color-ring);
  outline: none;
}
```

### Tabs（视图切换）

激活项：teal 50% 透明底 + 前景全亮；非激活：透明底 + `--color-muted-foreground`。不用下划线动画以外的花哨效果。

### Modals

```css
.modal-overlay { background: rgba(0, 0, 0, 0.5); }
.modal {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 24px;
}
```

---

## Style Guidelines

**Style:** Neutral Workbench（开发者工具中性灰工作台）

**Keywords:** monochrome, flat, monospace, bordered, dense, functional, keyboard-first, quiet

**Best For:** Developer tools, JSON/data utilities, code viewers, internal dashboards

**Key Effects:** 150ms 颜色过渡、1px 边框 hover 加深、可见 focus ring、无变形无阴影

### Page Pattern

**Pattern Name:** Tool Workbench（工具工作台）

- **壳层**：侧边导航 + 内容区；首页为工具卡片墙（1/2/3 列响应式网格）
- **工具页**：顶部工具栏（视图 Tab / 搜索 / 操作按钮，图标化 + 短文案）+ 可分割主工作区
- **移动端**：顶栏 + 抽屉导航（维持现状）

---

## Motion

**Micro-interactions only** —— 不做 scroll reveal、不做入场动画。

- 状态过渡统一 `150ms ease`，只作用于 color / border-color / background
- `prefers-reduced-motion: reduce` 时全部过渡降为 0
- 计时数字用 `tabular-nums` 防抖动（番茄钟场景保留）

---

## Anti-Patterns (Do NOT Use)

- ❌ **任何 box-shadow 表达层级** —— 用边框和灰阶
- ❌ **hover transform**（translateY / scale 浮起）
- ❌ **第二种彩色**（orange 已废弃；彩色只有 teal + 语义色 destructive/callout）
- ❌ **粗字重堆叠**（>500 的 weight、全大写+letter-spacing 营销腔）
- ❌ **大圆角**（>10px；rounded-full 仅限圆形图标按钮）
- ❌ **Emojis as icons** —— Use SVG icons (@vicons/ionicons5)
- ❌ **Missing cursor:pointer** / ❌ **Low contrast text**（4.5:1）/ ❌ **Invisible focus states**

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] 零阴影：grep 无 `box-shadow`（focus ring 除外）
- [ ] 零 hover transform
- [ ] 彩色只有 teal / destructive / 语法高亮四色
- [ ] 全局 mono 字体栈生效，无 webfont 请求
- [ ] 圆角 ≤ 10px
- [ ] cursor-pointer on all clickable elements
- [ ] Light/Dark 双主题下文字对比 ≥ 4.5:1
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars / No horizontal scroll on mobile
