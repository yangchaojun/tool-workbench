---
id: "002"
title: 工具注册契约（ToolDefinition）设计
labels: [wayfinder:task]
status: closed
assignee: zcode-agent
blocked-by: []
created: 2026-08-29
---

## Question

新工具如何以最小改动接入平台？需要定：

- `ToolManifest` 的字段与 Zod schema（id 规范、name、description、icon、accent 色、category 等）。
- 目录约定（`src/tools/<id>/`）与注册表；目标是「新增一个工具 = 新增一个目录 + 注册表加一行」。
- 路由接入方式：动态段 `/tools/:toolId` + ToolHost 懒加载，保持逐工具代码分包。
- 工具级设置与持久化契约：`settingsSchema`（ZodObject 带默认值）+ Zod 校验的 localStorage 封装（shared 层），坏数据回退默认值。

## Resolution

已落地 `src/core/tools/types.ts` + `registry.ts` + `src/shared/storage/zodStorage.ts`：

- **ToolManifest（Zod schema）**：`id`（小写字母/数字/连字符，兼作路由段与 localStorage 命名空间）、`name`、`description`、`accent`（#RRGGBB，默认平台主色）。manifest 保持纯数据可序列化。
- **ToolDefinition** = manifest + `icon`（Vue 组件，非可序列化故不入 manifest）+ `component`（懒加载器，`() => import(...)` 保证逐工具分包）+ 可选 `settingsSchema`（ZodObject 全字段带默认值，键约定 `tw:settings:<id>`）。`defineTool()` 为唯一接入点。
- **注册表**：`registerTool` 时 safeParse manifest（不合法/重复 id 立即抛错）；`getTool` / `listTools`（保持注册顺序）。
- **路由**：单一动态段 `/tools/:toolId`，`ToolHost` 按参数查注册表 + `defineAsyncComponent` 懒加载；未知 id 渲染页内兜底文案。新增工具零路由改动。
- **持久化契约**：`loadZodJson(key, schema, fallback)` —— JSON.parse → 整体校验 → 对象 schema 时缺字段并回默认值再校验 → 任一步失败回落 fallback；写入 try/catch 静默降级（配额/隐私模式）。

验收：新增工具成本 = 1 个目录 + `tools/index.ts` 一行（见 README「如何新增一个工具」）。
