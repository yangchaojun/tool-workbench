---
id: "011"
title: JSON 查看器最小闭环
labels: [wayfinder:task]
status: closed
assignee: zcode-agent
blocked-by: []
created: 2026-09-05
---

## Question

添加新工具：JSON Viewer。做一个纯前端、可直接使用的 JSON 查看器最小闭环——用户粘贴或上传 JSON 后，能立即完成格式化/压缩、语法校验并精确定位错误、以语法高亮的文本和可折叠的树形视图浏览数据，并一键复制或下载结果。经 grilling（两轮，用户逐轮确认「均按推荐」）定案，术语入 `CONTEXT.md`，两条决策立 ADR：

- **高亮引擎**：引入 CodeMirror 6（仓库首个编辑器依赖），以窄契约封装为 `src/shared/components/code-editor/`（props 仅 value/readonly/language/errorMark），JSON 智能留在工具侧（ADR-0001）。
- **错误定位**：双解析器分工——值一律来自 `JSON.parse`（语义零风险），自写容错定位器只在引擎抛错后启动、专职产出跨引擎一致的 行:列 + 中文错误原因；定位器判为合法（或超深度护栏主动放弃）时降级显示引擎原始报错，永不误报（ADR-0002）。
- **软上限**：输入 1MB（超过暂停自动校验、改手动触发，不阻止使用）；上传 5MB；持久化 256KB（超出不写）。
- **布局**：宽屏（≥1024px）文本/树形并排，窄屏退化为 NTabs（文本/树形），`display-directive="show"` 保活 + 切回时 `remeasure()`。
- **自动校验**：输入防抖 300ms 自动校验并同步树；格式化/压缩/复制/下载为显式按钮。
- **树形视图**：默认展开前 2 层，悬停显示类型/长度徽标，全部展开/折叠广播；渲染护栏为每节点 200 子节点（超出显示「其余 X 项已省略」且不可展开）、200 层深度（超出折叠并提示）；重复键忠实呈现 `JSON.parse` 结果，不做审计标记。
- **复制/下载**：复制跟随最近一次格式化/压缩模式（按钮文案「复制格式化/复制压缩」）；下载固定格式化结果、文件名 `data.json`。
- **上传**：点击选择 + 编辑区整卡拖拽，不限文件类型。
- **持久化**：最后一次输入存 `tw:json-viewer:input`（zodStorage，256KB 上限），刷新即恢复并立即重新校验。

## Resolution

已落地 `src/tools/json-viewer/`（tool.ts / schemas.ts / parser/locate.ts / stores/jsonViewer.ts / views / components）+ `src/shared/components/code-editor/`（kit.ts + CodeEditor.vue）+ 注册表一行接入：

- **CodeEditor（ADR-0001）**：CodeMirror 6 细粒度包（state/view/language/commands/lang-json + @lezer/highlight 显式依赖）；主题与语法高亮全部走工作台 CSS 变量（`color-mix` 混合），换肤无需重载；错误标记 = StateField + Decoration（行背景 + 错误列到行尾波浪线 + title 提示）+ `scrollIntoView`；语言/只读态经 Compartment 运行时切换；对外仅 value/readonly/language/errorMark + `remeasure()`。
- **定位器（ADR-0002）**：~230 行递归下降（对象/数组/字符串转义/数字文法/字面量/尾随内容），Cursor 结构随扫描累计 行:列，深度护栏 10_000 层抛 GiveUp；已用 3000 组随机合法 JSON（含 `"``\``/控制字符/😀/1e±N 边角）验证零误报，20 组典型错误定位行列与消息全部正确（临时脚本抽查，未入库——仓库无测试框架惯例）。
- **store**：`result` 用 shallowRef 存判别联合（ok/data | location/rawMessage），formatted/minified 为 computed 缓存；防抖定时器统一负责「超限则跳过自动校验 + 持久化」；输入 102 B→162 B 状态条、字节计算用共享 TextEncoder。
- **树形**：TreeNode 递归组件，数据引用变化以 key 重建整树（展开态回默认前 2 层）；全部展开/折叠经 command prop（{kind, seq}）广播；数组索引以 `"0"` 键形式呈现。
- **验证**：vue-tsc + build 零错误（JSON 查看器懒加载分包 ~335KB/gzip ~110KB，主体是 CodeMirror）；浏览器实测——错误 JSON 定位到 第 3 行 第 19 列（正是缺逗号处）、修正后 ✓ 合法 JSON + 树同步、压缩/格式化写回编辑器、复制按钮文案随模式且「已复制 ✓」闪烁 1.5s、刷新后输入恢复并自动重校验、亮/暗双主题高亮随 CSS 变量自适应、420px 窄屏正确退化为 Tab 且树形切换正常。

### 环境限制与备忘

- **CodeMirror StateField 陷阱（浏览器实测抓到的真 bug，已修）**：`StateField.update` 里遍历 `tr.effects` 不能只判 `effect.value === null`——同一事务里还有 `EditorView.scrollIntoView` 等 effect（value 非空），会被误当标记 effect 处理（`doc.lineAt(undefined)` 抛错、整个事务失败），导致错误标记永远不渲染。必须用 `effect.is(setErrorMark)` 过滤。
- **Vite HMR 双实例陷阱（排查假象）**：长会话 dev server 经多次 HMR 后，同一模块会以不同 `?t=` 时间戳被加载成多份实例（store/组件各两份），表现为「写入 store 无任何响应、emit 链断裂」的僵尸态——重启 dev server 即消失，生产构建无此机制。据此排查时务必先重启 server 再下结论。
- IAB 自动化的 `fill()` 在 contenteditable 上表现为追加而非替换，自动化测试需走「点击 + Ctrl/Cmd+A + 逐字输入」路径；真实用户粘贴/键入不受影响。
- `navigator.clipboard.writeText` 在 IAB 中可用；复制反馈按钮文案需等 Vue 渲染后再读（自动化立即读会抢跑）。
- 上传（input[type=file] 与拖拽）无法在 IAB 中自动化，代码路径简单（`file.text()` + 大小护栏），留待人工验证。

### 审查修复（code-review 两轴 + 浏览器实测回归）

- 持久化上限从字符改为 UTF-8 字节计（256KB），与 CONTEXT.md「软上限」口径一致（原实现下 CJK 输入可超出）。
- 超软上限时「立即校验」按钮提升为状态栏右侧常驻入口——原实现只渲染在无结果分支，若上次结果为 ✓ 后编辑超限，用户会卡在过期结果上。
- CodeEditor 挂载即应用初始 errorMark（恢复的输入自带错误时首帧渲染装饰），不能只依赖 watch。
- Data Clump/Duplicated Code 清理：`CodeErrorMark` 类型入 kit.ts；`jsonValueType`/标签表收敛到 treeTypes.ts 供 TreeNode 与 TreeView 共用；matchMedia 去重。
- ADR-0001 措辞对齐实现（`modelValue`/v-model 四能力），并注明高亮风格为纯视觉呈现、第二语言出现时须参数化。
- 回归确认（重启 dev server 后全新页面）：错误定位（第 3 行 第 22 列 + 行背景 + 波浪线截图）、编辑防抖重校验、状态翻转与树同步、格式化/压缩/复制文案/下载/清空、软上限暂停 + 立即校验 + 超限不持久化（localStorage 为空）、typecheck/build 零错误。
