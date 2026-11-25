import { describe, expect, it } from 'vitest'

import {
  TAB_PERSIST_BUDGET_BYTES,
  nextTabName,
  nextUntitledTabName,
  persistedTabsWithinBudget,
} from './schemas'

describe('标签名称', () => {
  it('未命名标签按序号递增并跳过已用名称', () => {
    expect(nextUntitledTabName([])).toBe('Untitled 1')
    expect(nextUntitledTabName(['Untitled 1', 'Untitled 3'])).toBe('Untitled 2')
  })

  it('文件重名时在扩展名前追加序号', () => {
    expect(nextTabName('config.json', ['config.json'])).toBe('config 2.json')
    expect(nextTabName('config.json', ['config.json', 'config 2.json'])).toBe('config 3.json')
    expect(nextTabName('README', ['README'])).toBe('README 2')
  })
})

describe('标签持久化预算', () => {
  it('按 UTF-8 字节计算总预算', () => {
    const tabs = [
      { id: 'a', name: 'A', input: '中'.repeat(70_000) },
      { id: 'b', name: 'B', input: 'x'.repeat(60_000) },
    ]
    expect(persistedTabsWithinBudget(tabs, 'b')).toEqual([tabs[0]])
  })

  it('预算内保留全部标签', () => {
    const tabs = [
      { id: 'a', name: 'A', input: '{}' },
      { id: 'b', name: 'B', input: '[]' },
    ]
    expect(persistedTabsWithinBudget(tabs, 'b')).toEqual(tabs)
    expect(new TextEncoder().encode(JSON.stringify({ version: 2, tabs, activeTabId: 'b' })).length).toBeLessThanOrEqual(TAB_PERSIST_BUDGET_BYTES)
  })

  it('首个标签超预算时仍保留空工作区标签', () => {
    const first = { id: 'a', name: 'Untitled 1', input: 'x'.repeat(TAB_PERSIST_BUDGET_BYTES + 1) }
    expect(persistedTabsWithinBudget([first], first.id)).toEqual([{ ...first, input: '' }])
  })
})
