import { describe, expect, it } from 'vitest'

import { HistoryStack, type EditorSnapshot } from './history'

function snap(text: string, data: unknown = undefined): EditorSnapshot {
  return { text, data }
}

describe('HistoryStack', () => {
  it('push 后可撤销到上一个快照', () => {
    const h = new HistoryStack()
    expect(h.undo(snap('B'))).toBeNull()
    h.push(snap('A'), 'text')
    expect(h.undo(snap('B'))).toEqual(snap('A'))
    expect(h.redo(snap('A'))).toEqual(snap('B'))
  })

  it('撤销后新改动清空重做分支', () => {
    const h = new HistoryStack()
    h.push(snap('A'), 'text')
    const undone = h.undo(snap('B'))
    expect(undone).toEqual(snap('A'))
    h.push(snap('A2'), 'tree')
    expect(h.redo(snap('A2'))).toBeNull()
    expect(h.undo(snap('C'))).toEqual(snap('A2'))
  })

  it('连续文本键入在合并窗口内只算一个条目', () => {
    const h = new HistoryStack()
    h.push(snap('A'), 'text', 1000)
    h.push(snap('B'), 'text', 1200)
    h.push(snap('C'), 'text', 1700) // 距上次 500ms < 800ms，合并
    expect(h.undo(snap('D'))).toEqual(snap('A'))
    expect(h.undo(snap('A'))).toBeNull()
  })

  it('超过合并窗口的文本编辑算新条目', () => {
    const h = new HistoryStack()
    h.push(snap('A'), 'text', 1000)
    h.push(snap('B'), 'text', 3000)
    expect(h.undo(snap('C'))).toEqual(snap('B'))
    expect(h.undo(snap('B'))).toEqual(snap('A'))
  })

  it('树操作不与文本合并', () => {
    const h = new HistoryStack()
    h.push(snap('A'), 'text', 1000)
    h.push(snap('B'), 'tree', 1100)
    expect(h.undo(snap('C'))).toEqual(snap('B'))
  })

  it('容量上限丢弃最旧条目', () => {
    const h = new HistoryStack(3)
    for (let i = 0; i < 5; i += 1) {
      h.push(snap(`s${i}`), 'action', i * 10_000)
    }
    expect(h.undo(snap('now'))).toEqual(snap('s4'))
    expect(h.undo(snap('s4'))).toEqual(snap('s3'))
    expect(h.undo(snap('s3'))).toEqual(snap('s2'))
    expect(h.undo(snap('s2'))).toBeNull()
  })

  it('clear 清空两侧', () => {
    const h = new HistoryStack()
    h.push(snap('A'), 'text')
    h.undo(snap('B'))
    h.clear()
    expect(h.undo(snap('B'))).toBeNull()
    expect(h.redo(snap('B'))).toBeNull()
  })

  it('版本号随结构变化递增（供响应式派生）', () => {
    const h = new HistoryStack()
    const v0 = h.version
    h.push(snap('A'), 'text')
    expect(h.version).toBeGreaterThan(v0)
  })
})
