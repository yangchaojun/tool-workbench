import { z } from 'zod'
import type { Component } from 'vue'

/**
 * 工具接入契约 —— 新增一个工具的全部成本：
 *   1. 在 `src/tools/<id>/` 下按目录约定实现（tool.ts + views/ + stores/ …）
 *   2. 在 `src/tools/index.ts` 里 `registerTool(...)` 一行
 * 路由、首页卡片、图标、设置持久化全部由注册表自动获得。
 */

export const toolManifestSchema = z.object({
  /** 全局唯一 id，同时用作路由段与 localStorage 命名空间 */
  id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id 只能包含小写字母、数字与连字符'),
  name: z.string().min(1),
  description: z.string().min(1),
  /** 工具级强调色（卡片/页内点缀），6 位 hex */
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'accent 必须是 #RRGGBB')
    .default('#0d9488'),
})

export type ToolManifest = z.output<typeof toolManifestSchema>

/** 工具主视图加载器：必须返回动态 import 以获得逐工具代码分包 */
export type ToolComponentLoader = () => Promise<Component>

export interface ToolDefinition {
  /** 纯数据元信息，注册时经 toolManifestSchema 校验 */
  manifest: ToolManifest
  /** 侧边栏与工具卡上的图标（组件，非可序列化数据，故不入 manifest） */
  icon: Component
  /** 工具主视图 */
  component: ToolComponentLoader
  /**
   * 工具级设置 schema：所有字段必须带默认值。
   * 平台约定 localStorage 键 `tw:settings:<id>`，读取经 Zod 校验，
   * 缺字段回落默认值，坏数据整体回落，保证升级安全。
   */
  settingsSchema?: z.ZodObject<any>
}

/** 工具定义入口：仅为获得类型提示与统一的接入点 */
export function defineTool(def: ToolDefinition): ToolDefinition {
  return def
}
