import { z } from 'zod'

/**
 * Zod 守护的 localStorage 读取 —— 所有持久化数据必须经过这里。
 * 读取路径：JSON.parse → schema.safeParse → 失败回落 fallback。
 * schema 内联的 .default() 负责「缺字段回默认值」（含新增字段的旧数据），
 * 因此无需额外合并逻辑；坏数据整体回落，schema 演进不会崩。
 */
export function loadZodJson<S extends z.ZodType>(
  key: string,
  schema: S,
  fallback: z.output<S>,
): z.output<S> {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed = schema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : fallback
  } catch {
    return fallback
  }
}

export function saveZodJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 配额满 / 隐私模式：静默失败，工具功能不因持久化受阻
  }
}

export function removeZodJson(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* 同上 */
  }
}
