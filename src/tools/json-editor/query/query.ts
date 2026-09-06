/**
 * 查询封装（JSONPath / JMESPath）。两个引擎都直接消费 JSON.parse 的值，
 * 不涉及自写解析器（见 docs/adr/0002 Revision）；依赖经动态 import 懒加载分包。
 */

export type QueryLang = 'jsonpath' | 'jmespath'

export type QueryOutcome =
  | { ok: true; results: unknown[] }
  | { ok: false; error: string }

export async function runQuery(
  lang: QueryLang,
  data: unknown,
  expression: string,
): Promise<QueryOutcome> {
  const trimmed = expression.trim()
  if (trimmed === '') return { ok: true, results: [] }
  try {
    if (lang === 'jsonpath') {
      const { JSONPath } = await import('jsonpath-plus')
      const results = JSONPath({ path: trimmed, json: data as object, wrap: true }) as unknown[]
      return { ok: true, results }
    }
    const { search } = await import('jmespath')
    const value: unknown = search(data, trimmed)
    return { ok: true, results: value === undefined ? [] : [value] }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
