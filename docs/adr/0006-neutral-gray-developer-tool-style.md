# 设计系统转向：中性灰开发者工具风格（参照 jsonview.org）

原设计系统（Minimalism & Swiss，teal `#0D9488` + 浅青表面 `#F0FDFA` + orange 强调 `#EA580C` + 柔和阴影 + 1rem 圆角，见工单 003）被整体替换为中性灰工作台风格：shadcn 式中性灰阶 + 单一 teal 强调 `#008C96` + 全局等宽字体 + 无阴影 1px 边框面板 + 8px 圆角。规范见 `design-system/toolworkbench/MASTER.md`（2026-09-06 版）。

触发点是产品定位的重新确认：ToolWorkbench 的两个工具（JSON 编辑器、番茄钟）本质是开发者效率工具，目标用户对"工具感"的审美锚点是终端 / 代码编辑器一类的界面。旧版浅青底 + 彩色 CTA + 卡片浮起阴影偏向消费级 SaaS 的观感，与工具本身"打开即用、专注数据"的气质不一致。jsonview.org 被选为参照，因为它与本项目同品类（在线 JSON 工具），且其风格完全由一套收敛的 CSS 变量表达，可逐项落地。

## 被否的替代方案

- **局部借鉴**（保留 teal `#0D9488` 与现有骨架，仅吸收等宽字体/扁平化）：混搭会同时稀释两种风格的特征，且 token 层面的半改无法获得观感收益。
- **只改 JSON 编辑器**：token 集中在 `main.css` 一处、本就全局生效，维持两套视觉语言意味着 `themeOverrides` 与组件样式双份维护，成本高于统一换肤。

## Consequences

- 主色语义变化：Primary 从 teal 变为近黑（light `#171717` / dark `#FAFAFA`），teal 降级为唯一彩色强调（激活态 50% 透明底、链接、选中高亮）；orange 强调色废弃，`--color-accent` 语义重指向 teal。
- 阴影全部移除，层级改由灰阶 + 1px 边框表达；组件圆角从 10px 收紧到 8px（面板 10px）；hover 只允许颜色过渡，禁 transform。
- UI 字体整体切换为系统等宽栈（`ui-monospace, 'SF Mono', Menlo, Consolas, …`），不引入 webfont 依赖；中文回退系统字体是已知且接受的妥协。
- 默认主题保持 light（用户定位决策，不随参照站点），dark 主题按新色板调优。
- 落地分三步走（工单 013-015）：token 层替换 → 壳层/首页 → 两个工具页组件级修正。
