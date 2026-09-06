import { describe, expect, it } from 'vitest'

import {
  DOC_HISTORY_BUDGET_BYTES,
  DOC_HISTORY_CONTENT_CAP_BYTES,
  DOC_HISTORY_MAX_ENTRIES,
  META_OVERHEAD_BYTES,
  createDocumentEntry,
  displayName,
  entryStoredSize,
  fitBudget,
  recordDocument,
  removeDocument,
  sanitizeDocumentHistory,
  contentFingerprint,
  type DocumentHistoryEntry,
} from './documentHistory'

/** 固定 id/时间的条目构造（测试用） */
function entry(
  overrides: Partial<DocumentHistoryEntry> & { content?: string | null },
): DocumentHistoryEntry {
  const content = overrides.content ?? 'a'.repeat(10)
  const { content: _c, ...rest } = overrides
  return {
    id: rest.id ?? 'e1',
    kind: rest.kind ?? 'paste',
    name: rest.name ?? null,
    url: rest.url ?? null,
    content,
    contentHash:
      rest.contentHash ?? (content !== null ? contentFingerprint(content) : `null-${rest.id ?? 'e1'}`),
    byteSize: rest.byteSize ?? content.length,
    timestamp: rest.timestamp ?? 1000,
  }
}

describe('createDocumentEntry', () => {
  it('内容不超过上限时存全文', () => {
    const e = createDocumentEntry({
      kind: 'file',
      name: 'data.json',
      content: '{"a":1}',
      timestamp: 1234,
      id: 'x',
    })
    expect(e.content).toBe('{"a":1}')
    expect(e.byteSize).toBe(7)
    expect(e.name).toBe('data.json')
  })

  it('内容超过 256KB 只存元信息（content 为 null，byteSize 保留）', () => {
    const big = 'x'.repeat(DOC_HISTORY_CONTENT_CAP_BYTES + 1)
    const e = createDocumentEntry({ kind: 'paste', content: big, timestamp: 1, id: 'x' })
    expect(e.content).toBe(null)
    expect(e.byteSize).toBe(DOC_HISTORY_CONTENT_CAP_BYTES + 1)
  })

  it('byteSize 按 UTF-8 字节计，而非字符数', () => {
    const e = createDocumentEntry({ kind: 'paste', content: '中中中中', timestamp: 1, id: 'x' })
    expect(e.byteSize).toBe(12)
  })
})

describe('recordDocument：去重', () => {
  it('内容重复的条目移到顶部并刷新时间戳，不产生重复', () => {
    const base = [{ ...entry({ id: 'a', content: 'dup', timestamp: 1 }) }]
    const next = recordDocument(base, {
      kind: 'file',
      name: 'again.json',
      content: 'dup',
      timestamp: 99,
      id: 'b',
    })
    expect(next).toHaveLength(1)
    expect(next[0].id).toBe('b')
    expect(next[0].timestamp).toBe(99)
  })

  it('去重时 URL 条目记住来源 URL（重新拉取仍可用）', () => {
    const base = [entry({ id: 'a', kind: 'url', url: 'https://x.example/a.json', content: 'dup' })]
    const next = recordDocument(base, {
      kind: 'file',
      name: 'f.json',
      content: 'dup',
      timestamp: 2,
      id: 'b',
    })
    expect(next[0].url).toBe('https://x.example/a.json')
  })

  it('内容重复但旧条目仅元信息（指纹不同）时不视为重复', () => {
    const base = [entry({ id: 'a', content: null, byteSize: 999 })]
    const next = recordDocument(base, {
      kind: 'paste',
      content: 'new-stuff',
      timestamp: 2,
      id: 'b',
    })
    expect(next.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('超限未缓存的大文档按指纹去重：旧条目移除、新条目置顶并继承 URL', () => {
    const big = 'y'.repeat(DOC_HISTORY_CONTENT_CAP_BYTES + 1)
    const old = createDocumentEntry({
      kind: 'url',
      url: 'https://x.example/big.json',
      content: big,
      timestamp: 1,
      id: 'a',
    })
    expect(old.content).toBe(null) // 超限未缓存，只剩指纹可比对
    const next = recordDocument([old], {
      kind: 'url',
      url: 'https://x.example/big.json',
      content: big,
      timestamp: 99,
      id: 'b',
    })
    expect(next).toHaveLength(1)
    expect(next[0].id).toBe('b')
    expect(next[0].timestamp).toBe(99)
  })
})

describe('recordDocument：条目上限', () => {
  it('超出 20 条时淘汰最旧条目', () => {
    const base = Array.from({ length: DOC_HISTORY_MAX_ENTRIES }, (_, i) =>
      entry({ id: `e${i}`, content: `c${i}`, timestamp: i }),
    )
    const next = recordDocument(base, {
      kind: 'paste',
      content: 'newest',
      timestamp: 100,
      id: 'new',
    })
    expect(next).toHaveLength(DOC_HISTORY_MAX_ENTRIES)
    expect(next[0].id).toBe('new')
    // 淘汰的是数组尾部最旧的 e19
    expect(next.at(-1)?.id).toBe('e18')
  })
})

describe('fitBudget：总字节预算降级', () => {
  it('总字节超预算时按最旧优先把全文条目降级为仅元信息，新条目保留全文', () => {
    // 每条全文约 256KB：五条（约 1.25MB）即超出 1MB 预算；数组约定最新在前
    const big = (id: string, ts: number) =>
      entry({ id, content: 'x'.repeat(DOC_HISTORY_CONTENT_CAP_BYTES - 1000), timestamp: ts })
    const next = fitBudget(
      [big('new', 5), big('old1', 4), big('old2', 3), big('old3', 2), big('old4', 1)],
      DOC_HISTORY_BUDGET_BYTES,
    )
    const total = next.reduce((sum, e) => sum + entryStoredSize(e), 0)
    expect(total).toBeLessThanOrEqual(DOC_HISTORY_BUDGET_BYTES)
    expect(next.find((e) => e.id === 'new')?.content).not.toBe(null)
    // 降级只清内容，元信息（来源、大小、时间）保留；只降级最旧的 old4 即达标
    const degraded = next.find((e) => e.id === 'old4')
    expect(degraded?.content).toBe(null)
    expect(degraded?.byteSize).toBeGreaterThan(0)
    expect(next.find((e) => e.id === 'old3')?.content).not.toBe(null)
  })

  it('全部降级后仍超预算（防御分支）时丢弃最旧条目', () => {
    // 伪造超高元信息开销，模拟极端情形
    const e1 = { ...entry({ id: 'a', content: null }), timestamp: 1 }
    const e2 = { ...entry({ id: 'b', content: null }), timestamp: 2 }
    // 数组约定最新在前：e1(ts=1) 在前更新，淘汰最旧的 e2
    const next = fitBudget([e1, e2], META_OVERHEAD_BYTES)
    expect(next).toHaveLength(1)
    expect(next[0].id).toBe('a')
  })
})

describe('sanitizeDocumentHistory：载入侧收口', () => {
  it('合法但超限的历史被裁剪降级，而不是整体清空', () => {
    const entries = [
      ...Array.from({ length: DOC_HISTORY_MAX_ENTRIES + 5 }, (_, i) =>
        entry({ id: `e${i}`, content: `c${i}`, timestamp: i }),
      ),
    ]
    const next = sanitizeDocumentHistory(entries)
    expect(next).toHaveLength(DOC_HISTORY_MAX_ENTRIES)
    expect(next[0].id).toBe('e0') // 保留最前面的（最新）条目
  })

  it('全文超出内容上限的条目降级为仅元信息', () => {
    const big = 'z'.repeat(DOC_HISTORY_CONTENT_CAP_BYTES + 1)
    const next = sanitizeDocumentHistory([entry({ id: 'a', content: big })])
    expect(next).toHaveLength(1)
    expect(next[0].content).toBe(null)
    expect(next[0].byteSize).toBe(big.length)
  })
})

describe('removeDocument / displayName', () => {
  it('按 id 删除单条，未命中时原样返回', () => {
    const base = [entry({ id: 'a' }), entry({ id: 'b' })]
    expect(removeDocument(base, 'a').map((e) => e.id)).toEqual(['b'])
    expect(removeDocument(base, 'zzz')).toBe(base)
  })

  it('displayName：文件显示文件名、URL 显示地址、粘贴显示固定文案', () => {
    expect(displayName(entry({ kind: 'file', name: 'a.json' }))).toBe('a.json')
    expect(displayName(entry({ kind: 'url', url: 'https://x/a.json' }))).toBe('https://x/a.json')
    expect(displayName(entry({ kind: 'paste' }))).toBe('粘贴内容')
  })
})
