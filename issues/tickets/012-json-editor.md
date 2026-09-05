---
id: "012"
title: JSON 编辑器：查看器升级为编辑器
labels: [wayfinder:task]
status: in-progress
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

（待实现完成后回填）
