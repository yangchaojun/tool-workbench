import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

import { TAB_PERSIST_BUDGET_BYTES } from '../schemas'
import { useJsonEditorStore } from './jsonEditor'

const PERSIST_KEY = 'tw:json-editor:input'

class MemoryStorage {
  private values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

function storedWorkspace(): {
  version: number
  tabs: { id: string; name: string; input: string }[]
  activeTabId: string
} {
  return JSON.parse(localStorage.getItem(PERSIST_KEY) ?? '{}')
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('window', globalThis)
  setActivePinia(createPinia())
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('多标签工作区', () => {
  it('首次进入创建一个空标签', () => {
    const store = useJsonEditorStore()
    expect(store.tabs).toHaveLength(1)
    expect(store.activeTab?.name).toBe('Untitled 1')
    expect(store.input).toBe('')
  })

  it('自动生成不重复的标签名称', () => {
    const store = useJsonEditorStore()
    store.addTab('{}', 'data.json')
    store.addTab('[]', 'data.json')
    expect(store.tabs.map((tab) => tab.name)).toEqual(['Untitled 1', 'data.json', 'data 2.json'])
    store.addTab()
    expect(store.activeTab?.name).toBe('Untitled 2')
  })

  it('切换标签时保留各自文本、校验结果和历史', async () => {
    const store = useJsonEditorStore()
    store.setInput('{"a":1}')
    await nextTick()
    store.validate()
    const firstId = store.activeTabId
    const secondId = store.addTab('{"b":2}')
    await vi.advanceTimersByTimeAsync(300)

    expect(store.data).toEqual({ b: 2 })
    store.switchTab(firstId)
    expect(store.input).toBe('{"a":1}')
    expect(store.data).toEqual({ a: 1 })
    expect(store.canUndo).toBe(false)

    store.setInput('{"a":3}')
    await vi.advanceTimersByTimeAsync(300)
    store.switchTab(secondId)
    expect(store.input).toBe('{"b":2}')
    expect(store.data).toEqual({ b: 2 })
    expect(store.canUndo).toBe(false)

    store.switchTab(firstId)
    expect(store.canUndo).toBe(true)
    expect(store.undo()).toBe(true)
    expect(store.input).toBe('{"a":3}')
  })

  it('防抖校验只更新当前标签，不覆盖切换后的输入', async () => {
    const store = useJsonEditorStore()
    store.setInput('{bad')
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    expect(store.result?.ok).toBe(false)

    store.setInput('{"fixed":true}')
    const secondId = store.addTab('{"other":1}')
    await vi.advanceTimersByTimeAsync(300)

    expect(store.input).toBe('{"other":1}')
    expect(store.data).toEqual({ other: 1 })
    store.switchTab(secondId)
    expect(store.result?.ok).toBe(true)
  })

  it('树和图谱交互状态按标签保留', async () => {
    const store = useJsonEditorStore()
    store.setInput('{"nested":{"value":1}}')
    await nextTick()
    store.validate()
    const firstId = store.activeTabId
    store.setExpanded(['nested'], false)
    store.setTreeEditSession({
      path: ['nested'],
      name: 'nested',
      type: 'object',
      text: '',
      bool: false,
      error: null,
    })
    store.setGraphExpandedIds(new Set(['custom']), true)
    const firstGraph = store.graphExpandedIds

    const secondId = store.addTab('{"second":2}')
    await vi.advanceTimersByTimeAsync(300)
    expect(store.treeState.editSession).toBe(null)
    expect(store.graphExpandedIds.has('custom')).toBe(false)
    store.switchTab(firstId)

    expect(store.isExpanded(['nested'], 1)).toBe(false)
    expect(store.treeEditSession?.name).toBe('nested')
    expect(store.graphExpandedIds).toBe(firstGraph)
    expect(secondId).not.toBe(firstId)
  })

  it('关闭标签选择相邻标签，关闭最后一个标签时阻止删除', () => {
    const store = useJsonEditorStore()
    const firstId = store.activeTabId
    const secondId = store.addTab('{}')
    const thirdId = store.addTab('[]')

    store.closeTab(thirdId)
    expect(store.activeTabId).toBe(secondId)
    store.closeTab(secondId)
    expect(store.activeTabId).toBe(firstId)
    expect(store.closeTab(firstId)).toBe(false)
    expect(store.tabs).toHaveLength(1)
  })

  it('切走标签后，未提交文本仍保留撤销边界', async () => {
    const store = useJsonEditorStore()
    store.setInput('{"base":1}')
    await nextTick()
    store.validate()
    const firstId = store.activeTabId
    store.setInput('{"edited":2}')
    await nextTick()
    store.addTab('{"other":3}')
    await vi.advanceTimersByTimeAsync(300)
    store.switchTab(firstId)

    expect(store.canUndo).toBe(true)
    expect(store.undo()).toBe(true)
    expect(store.input).toBe('{"edited":2}')
  })

  it('图谱数据变化后重置旧展开状态', async () => {
    const store = useJsonEditorStore()
    store.setInput('{"first":1}')
    await nextTick()
    store.validate()
    store.setGraphExpandedIds(new Set(['custom']), true)
    store.setInput('{"second":2}')
    await vi.advanceTimersByTimeAsync(300)

    expect(store.graphExpandedIds.has('custom')).toBe(false)
    expect(store.graphUserTouched).toBe(false)
  })

  it('URL 加载状态和错误保留在发起标签', async () => {
    let resolveFetch!: (value: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })))
    const store = useJsonEditorStore()
    const firstId = store.activeTabId
    const request = store.loadUrl('https://example.test/data.json')
    const secondId = store.addTab('{}')

    expect(store.loadingUrl).toBe(false)
    resolveFetch(new Response('{"loaded":true}', { status: 200 }))
    expect(await request).toBe(false)
    store.switchTab(firstId)
    expect(store.loadingUrl).toBe(false)
    expect(store.input).toBe('')
    expect(secondId).not.toBe(firstId)
  })

  it('URL 加载不清除其他入口的待确认内容', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))))
    const store = useJsonEditorStore()
    store.setInput('{"current":1}')
    await nextTick()
    store.offerLoad('{"upload":2}', { kind: 'file', name: 'upload.json', url: null }, '文件 upload.json')
    await store.loadUrl('https://example.test/data.json')

    expect(store.pendingLoad?.text).toBe('{"upload":2}')
  })

  it('文件读取失败只影响发起标签', async () => {
    const store = useJsonEditorStore()
    const firstId = store.activeTabId
    let rejectRead!: (reason: Error) => void
    const file = {
      size: 10,
      name: 'broken.json',
      text: () => new Promise<string>((_, reject) => {
        rejectRead = reject
      }),
    } as File
    const request = store.loadFile(file)
    store.addTab('{}')
    rejectRead(new Error('read failed'))
    await request

    expect(store.loadError).toBe(null)
    expect(store.tabs.find((tab) => tab.id === firstId)?.loadError).toBe('无法读取文件 broken.json')
  })

  it('重命名拒绝空名称并持久化', () => {
    const store = useJsonEditorStore()
    const id = store.activeTabId
    expect(store.renameTab(id, '  ')).toBe(false)
    expect(store.renameTab(id, '  config.json  ')).toBe(true)
    expect(store.activeTab?.name).toBe('config.json')
    expect(storedWorkspace().tabs[0].name).toBe('config.json')
  })
})

describe('多标签持久化', () => {
  it('迁移旧版单输入格式', async () => {
    localStorage.setItem(PERSIST_KEY, JSON.stringify({ input: '{"legacy":true}' }))
    const store = useJsonEditorStore()
    await nextTick()
    expect(store.tabs).toHaveLength(1)
    expect(store.input).toBe('{"legacy":true}')
    expect(store.data).toEqual({ legacy: true })
    expect(storedWorkspace().version).toBe(2)
  })

  it('刷新后恢复标签顺序、名称和当前标签', async () => {
    const store = useJsonEditorStore()
    store.setInput('{"first":1}')
    await nextTick()
    const secondId = store.addTab('{"second":2}', 'second.json')
    setActivePinia(createPinia())

    const restored = useJsonEditorStore()
    await nextTick()
    expect(restored.tabs.map((tab) => tab.name)).toEqual(['Untitled 1', 'second.json'])
    expect(restored.activeTabId).toBe(secondId)
    expect(restored.input).toBe('{"second":2}')
    expect(restored.data).toEqual({ second: 2 })
  })

  it('标签内容合计超过预算时，仅持久化预算内的前缀', () => {
    const store = useJsonEditorStore()
    store.setInput(JSON.stringify({ value: 'x'.repeat(150 * 1024) }))
    store.addTab(JSON.stringify({ value: 'y'.repeat(150 * 1024) }))

    const saved = storedWorkspace()
    expect(saved.tabs).toHaveLength(1)
    expect(new TextEncoder().encode(saved.tabs[0].input).length).toBeLessThanOrEqual(
      TAB_PERSIST_BUDGET_BYTES,
    )
    expect(store.tabs).toHaveLength(2)
  })

  it('损坏的持久化数据回落到一个空标签', () => {
    localStorage.setItem(PERSIST_KEY, '{broken')
    const store = useJsonEditorStore()
    expect(store.tabs).toHaveLength(1)
    expect(store.input).toBe('')
  })
})
