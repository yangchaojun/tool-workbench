import { describe, expect, it } from 'vitest'

import {
  getAtPath,
  moveNode,
  nextObjectKey,
  removeAtPath,
  setAtPath,
  sortObjectKeys,
} from './mutations'

describe('setAtPath', () => {
  it('空路径整体替换根', () => {
    expect(setAtPath({ a: 1 }, [], 5)).toBe(5)
  })

  it('沿路径替换且不改原数据（结构共享）', () => {
    const original = { a: { b: 1 }, c: 2 }
    const next = setAtPath(original, ['a', 'b'], 9)
    expect(next).toEqual({ a: { b: 9 }, c: 2 })
    expect(original).toEqual({ a: { b: 1 }, c: 2 })
    // 结构共享：未触及的分支保持引用
    expect((next as { c: number }).c).toBe(original.c)
  })

  it('替换数组元素并保持其余元素', () => {
    const original = { list: [1, 2, 3] }
    const next = setAtPath(original, ['list', '1'], 'x')
    expect(next).toEqual({ list: [1, 'x', 3] })
    expect((original as { list: unknown[] }).list[1]).toBe(2)
  })
})

describe('removeAtPath', () => {
  it('空路径删除根', () => {
    expect(removeAtPath({ a: 1 }, [])).toBeUndefined()
  })

  it('删除对象键', () => {
    const original = { a: 1, b: 2 }
    expect(removeAtPath(original, ['a'])).toEqual({ b: 2 })
    expect(original).toEqual({ a: 1, b: 2 })
  })

  it('删除数组元素并前移后续元素', () => {
    const original = [10, 20, 30]
    expect(removeAtPath(original, ['1'])).toEqual([10, 30])
    expect(original).toEqual([10, 20, 30])
  })

  it('父链断裂时原样返回', () => {
    expect(removeAtPath({ a: 1 }, ['a', 'b'])).toEqual({ a: 1 })
  })
})

describe('moveNode', () => {
  it('同数组内后移（插入位=目标元素之前）', () => {
    const data = [1, 2, 3, 4]
    const result = moveNode(data, { from: ['0'], toParent: [], index: 2 })
    expect(result).toEqual({ data: [2, 1, 3, 4], path: ['1'] })
    expect(data).toEqual([1, 2, 3, 4])
  })

  it('同数组内前移（索引校正）', () => {
    const data = [1, 2, 3, 4]
    const result = moveNode(data, { from: ['3'], toParent: [], index: 0 })
    expect(result?.data).toEqual([4, 1, 2, 3])
  })

  it('同对象内重排键序', () => {
    const data = { a: 1, b: 2, c: 3 }
    const result = moveNode(data, { from: ['c'], toParent: [], index: 0 })
    expect(Object.keys(result?.data as object)).toEqual(['c', 'a', 'b'])
  })

  it('跨容器移动且键名冲突时自动加后缀', () => {
    const data = { a: { x: { name: 'n' } }, b: { x: 1 } }
    const result = moveNode(data, { from: ['a', 'x'], toParent: ['b'], index: 0 })
    expect(result?.path).toEqual(['b', 'x-2'])
    expect(result?.data).toEqual({ a: {}, b: { 'x-2': { name: 'n' }, x: 1 } })
  })

  it('移进自己的子树被拒绝', () => {
    const data = { a: { b: {} } }
    expect(moveNode(data, { from: ['a'], toParent: ['a', 'b'], index: 0 })).toBeNull()
  })

  it('移动根节点被拒绝', () => {
    expect(moveNode({ a: 1 }, { from: [], toParent: [], index: 0 })).toBeNull()
  })

  it('移动后原数据不被污染', () => {
    const data = { a: [1, 2], b: [] }
    moveNode(data, { from: ['a', '0'], toParent: ['b'], index: 0 })
    expect(data).toEqual({ a: [1, 2], b: [] })
  })
})

describe('sortObjectKeys', () => {
  it('仅本层排序，不动子层', () => {
    const data = { b: { d: 1, c: 2 }, a: 3 }
    const next = sortObjectKeys(data, [], false)
    expect(Object.keys(next as object)).toEqual(['a', 'b'])
    expect(Object.keys((next as { b: object }).b)).toEqual(['d', 'c'])
  })

  it('递归排序时数组元素里的对象也参与，数组本身不重排', () => {
    const data = { b: 1, a: [{ z: 1, y: 2 }, 9, 8] }
    const next = sortObjectKeys(data, [], true)
    expect(Object.keys(next as object)).toEqual(['a', 'b'])
    const arr = (next as { a: unknown[] }).a
    expect(Object.keys(arr[0] as object)).toEqual(['y', 'z'])
    expect(arr.slice(1)).toEqual([9, 8])
  })

  it('自然序：item2 排在 item10 前', () => {
    const data = { item10: 1, item2: 2, item1: 3 }
    const next = sortObjectKeys(data, [], false)
    expect(Object.keys(next as object)).toEqual(['item1', 'item2', 'item10'])
  })

  it('非对象目标原样返回', () => {
    expect(sortObjectKeys([3, 1, 2], [], false)).toEqual([3, 1, 2])
  })
})

describe('辅助函数', () => {
  it('getAtPath 读取深层值', () => {
    expect(getAtPath({ a: [{ b: 7 }] }, ['a', '0', 'b'])).toBe(7)
    expect(getAtPath({ a: 1 }, ['a', 'b'])).toBeUndefined()
  })

  it('nextObjectKey 生成不冲突键名', () => {
    expect(nextObjectKey({})).toBe('newKey')
    expect(nextObjectKey({ newKey: 1 })).toBe('newKey-2')
    expect(nextObjectKey({ newKey: 1, 'newKey-2': 2 })).toBe('newKey-3')
  })
})
