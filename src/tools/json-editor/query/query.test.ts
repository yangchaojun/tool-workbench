import { describe, expect, it } from 'vitest'

import { runQuery } from './query'

const data = {
  store: {
    book: [
      { title: 'A', price: 10 },
      { title: 'B', price: 30 },
    ],
  },
}

describe('runQuery', () => {
  it('JSONPath：取全部匹配（多结果）', async () => {
    const outcome = await runQuery('jsonpath', data, '$.store.book[*].title')
    expect(outcome).toEqual({ ok: true, results: ['A', 'B'] })
  })

  it('JSONPath：过滤表达式', async () => {
    const outcome = await runQuery('jsonpath', data, '$.store.book[?(@.price > 20)]')
    expect(outcome.ok && outcome.results).toEqual([{ title: 'B', price: 30 }])
  })

  it('JMESPath：投影（单结果）', async () => {
    const outcome = await runQuery('jmespath', data, 'store.book[*].title')
    expect(outcome).toEqual({ ok: true, results: [['A', 'B']] })
  })

  it('JMESPath：过滤', async () => {
    const outcome = await runQuery('jmespath', data, 'store.book[?price > `20`].title')
    expect(outcome.ok && outcome.results).toEqual([['B']])
  })

  it('空表达式返回空结果', async () => {
    expect(await runQuery('jsonpath', data, '  ')).toEqual({ ok: true, results: [] })
  })

  it('JMESPath 语法错误返回 error 而不抛出', async () => {
    const badJmes = await runQuery('jmespath', data, 'store[')
    expect(badJmes.ok).toBe(false)
  })

  it('JSONPath 对无法识别的表达式宽容（空结果不抛出）', async () => {
    const outcome = await runQuery('jsonpath', data, '???')
    expect(outcome).toEqual({ ok: true, results: [] })
  })
})
