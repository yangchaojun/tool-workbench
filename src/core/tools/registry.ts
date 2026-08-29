import { toolManifestSchema } from './types'
import type { ToolDefinition } from './types'

const registry = new Map<string, ToolDefinition>()

/** 注册工具；manifest 不合法或 id 重复时立即抛错（开发期暴露问题） */
export function registerTool(tool: ToolDefinition): void {
  const parsed = toolManifestSchema.safeParse(tool.manifest)
  if (!parsed.success) {
    throw new Error(
      `[tool-registry] 工具 manifest 不合法：${parsed.error.issues
        .map((i) => `${String(i.path)} ${i.message}`)
        .join('; ')}`,
    )
  }
  const { id } = parsed.data
  if (registry.has(id)) {
    throw new Error(`[tool-registry] 工具 id 重复注册：${id}`)
  }
  registry.set(id, tool)
}

export function getTool(id: string | undefined): ToolDefinition | undefined {
  return id ? registry.get(id) : undefined
}

/** 按注册顺序返回全部工具（首页卡片墙、侧边栏都从这里读） */
export function listTools(): ToolDefinition[] {
  return [...registry.values()]
}
