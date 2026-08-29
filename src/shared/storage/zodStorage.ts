import { z } from 'zod'

/**
 * Zod 守护的 localStorage 读写 —— 所有持久化数据必须经过这里。
 * 读取路径：JSON.parse → 整体校验 → （对象 schema 时）缺字段并回默认值再校验
 * → 任一步失败回落 fallback。保证 schema 演进（新增字段）与坏数据都不会崩。
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
    const data: unknown = JSON.parse(raw)

    const direct = schema.safeParse(data)
    if (direct.success) return direct.data

    const defaults = schema.safeParse({})
    if (
      defaults.success &&
      data !== null &&
      typeof data === 'object' &&
      !Array.isArray(data)
    ) {
      const merged = schema.safeParse({
        ...(defaults.data as Record<string, unknown>),
        ...(data as Record<string, unknown>),
      })
      if (merged.success) return merged.data
    }
    return fallback
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
