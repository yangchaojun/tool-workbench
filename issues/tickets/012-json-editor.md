---
id: "012"
title: JSON 编辑器：查看器升级为编辑器
labels: [wayfinder:task]
status: closed
assignee: zcode-agent
blocked-by: []
created: 2026-09-05
---

## Question

把 JSON 查看器升级为 JSON 编辑器（经 grilling 两轮、用户逐轮「均按推荐」定案；术语入 `CONTEXT.md`，决策立 ADR-0003、修订 ADR-0002）：

- **身份**：同一工具就地升级，id `json-viewer` → `json-editor`（路由段与 `tw:json-editor:*` 命名空间），旧持久化 key 一次性迁移。
- **架构**：解析后的数据为唯一数据源（ADR-0003），树形编辑不可变更新、文本是序列化投影；应用层统一快照历史栈（上限 100、不持久化、文本键入合并），关闭 CodeMirror 内建 history。
- **树形编辑**：节点增删改（就地编辑：键名 + 类型 + 值）、拖拽排序与跨容器移动（防移入自身子树、键名冲突自动后缀）、按 key 排序（仅本层/递归，数组不参与）；展开态按路径记忆，定位场景展开祖先链并滚动。
- **查找替换**：文本视图自绘查找替换栏（@codemirror/search 编程式 API，经 CodeEditor 契约扩展获取视图句柄）；树形视图按 key/字符串值查找定位（上一个/下一个 + 高亮），树内不替换。
- **查询**：JSONPath（jsonpath-plus）+ JMESPath（jmespath）双语言切换，动态 import 懒加载分包；结果逐条定位树形节点、复制、提取到编辑器（入栈）。
- **对比**：顶层「编辑 / 对比」模式；双栏只读输入（粘贴 + 载入，5MB 上限）；手写递归结构 diff（数组按索引严格对齐、顺序敏感），树形高亮 + 增/删/改统计；不做合并编辑与 patch 导出。
- **修复**：一键尝试修复（尾逗号、单引号/中文引号、无引号键、注释、NaN/±Infinity、末尾多余内容、缺失逗号/冒号）；NModal 逐条预览、确认才写回；修复候选必须过 `JSON.parse` 验证（ADR-0002 Revision），失败如实提示，永不静默改写。
- **转义/Unicode**：转义 = 整段文本 → JSON 字符串字面量；反转义 = 字面量 → 内层文本；Unicode = `\uXXXX` ↔ 字符（全部/仅非 ASCII 两档）；不含 Base64/percent-encoding。
- **护栏与持久化**：软上限三值不变（1MB/5MB/256KB）；持久化仍只存输入文本。
- **测试**：引入 vitest（75 例），只测纯逻辑层（mutations/history/repair/diff/codec/query/locate 补测）；UI 走浏览器实测。

## Resolution

已落地 `src/tools/json-editor/`（tool.ts / schemas.ts / stores/jsonEditor.ts / editor/{mutations,history}.ts / parser/{locate,repair}.ts / diff/diff.ts / query/query.ts / transform/codec.ts / views / components）+ CodeEditor 契约两处扩展（`history` 开关、`search` 搜索状态扩展——空面板抑制内建 UI，工具侧自绘查找替换栏）+ 注册表一行换名。术语入 `CONTEXT.md`，ADR-0002 追加 Revision，新立 ADR-0003。

- **纯逻辑层 75 例 vitest 全绿**：mutations（不可变 set/remove/move/rename/sort，结构共享）、history（合并窗口/容量/undo-redo 交替）、repair（11 类错误逐类 + 组合 + 如实失败）、diff（语义/统计/顺序敏感）、codec、query 封装、locate 补测（零误报契约）。
- **浏览器实测**（IAB，dev server 重启后全新页面）：旧 key 迁移（上次查看器遗留输入带出并正确报错定位 第 3 行 第 22 列）→ 输入合法 JSON 防抖校验 ✓ → 树同步 → 添加子项**自动进入编辑态** → 改键名/类型/值确认 → 文本同步格式化 JSON → 撤销两步逐级回退、重做恢复 → JSONPath `$.a.b[*]` 得 3 结果且逐条定位 → 修复 Modal 逐条列出 9 处修改（注释/键名/引号/尾逗号/NaN）→ 应用后 ✓ → 撤销回坏文本 → 对比模式双栏校验 + 差异树（+1/−2/~1 与数据完全一致）→ 查找替换「你好→再见」计数与替换正确。
- **浏览器实测抓到的真 bug（均已修）**：
  1. **DiffView 的 v-model 穿透对象字面量**：`v-for="(side, key) in {left: {...}, right: {...}}"` 里 `v-model:value="side.text"` 写的是临时对象属性，永远写不回 ref——真实用户输入会在下一次重渲染时被抹掉、diff 永不计算。改为 `:value` + 显式 `@update:value` 双分支赋值。IAB 各路径合成输入（fill/cua.type/dom_cua/locator.type/execCommand）全部「落 DOM 不落 Vue 状态」，恰好把该 bug 暴露成可复现现象。
  2. **naive-ui NSelect 宽度失控**：运行时注入的 `.n-select{width:100%}` 晚于 Tailwind 样式表，`w-28` 被覆盖 → 查询行 select 撑到 438px、flex-1 输入框被挤成 0 宽（Playwright 判 hidden 的真因）。宽度类一律改内联 style。
  3. **overflow-hidden 面板被意外程序滚动**：树形卡片 `scrollLeft=51` 导致整栏内容裁切（scrollIntoView 会波及 hidden 滚动容器）。`scrollToNode` 改为手动滚树内部 `[data-tree-scroll]` 容器，卡片 `overflow-hidden` → `overflow-clip`（不可编程滚动）。
  4. **查找替换静默空转**：@codemirror/search 的 commands/setSearchQuery 依赖 `search()` 扩展的 query StateField，未安装时计数恒 0、替换不执行。CodeEditor 新增 `search` prop 安装扩展并用空 createPanel 抑制内建 UI。
- **code-review（两轴）修复**：历史栈锚点 `lastSettled` 在 format/minify/超软上限写回/校验失败路径缺失 markSettled（撤销会跳步）；`pendingEdit` watch 缺 immediate（新增子项后自动编辑态可能不出现）；DiffView 上传错误窜入编辑模式状态栏且缺 try/catch；节点元素注册表旧 key 残留；writeOutput 改名 rewriteInput；删除两处 Speculative Generality 空暴露；unescapeJsonText 改类型化错误哨兵。
- 分包：JsonEditorView ~565KB/gzip ~175KB（CodeMirror + naive-ui 为主），jmespath 21KB / jsonpath-plus 25KB 独立懒加载 chunk。
- 上传（input[type=file] 与拖拽）无法在 IAB 自动化，代码路径与 json-viewer 一致，留待人工验证；树拖拽（HTML5 DnD）同样无法在 IAB 合成（dragstart 为原生事件），逻辑已由 mutations 单测覆盖（moveNode 语义），留待人工验证。
