import { z } from 'zod'

/**
 * JSON 查看器的持久化数据（约定：所有字段必须带默认值，供 zodStorage 缺字段回落）。
 * 超出上限的输入不持久化——由 store 侧在写入前拦截，这里只做读取防御。
 */
export const jsonViewerPersistSchema = z.object({
  input: z.string().max(262_144).default(''),
})
export type JsonViewerPersist = z.output<typeof jsonViewerPersistSchema>
