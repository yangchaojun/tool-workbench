import { describe, expect, it } from 'vitest'

import {
  buildGraph,
  defaultExpandedIds,
  graphNodeId,
  scalarPreview,
  MAX_CARD_ROWS,
  MAX_GRAPH_NODES,
  tableColumnWidth,
  TABLE_CELL_PADDING_X,
  TABLE_COL_MAX,
  TABLE_COL_MIN,
} from './buildGraph'

const ROOT = graphNodeId([])

/** 收集数据中全部容器路径的节点 id（测试辅助） */
function collectContainerPaths(value: unknown, path: string[], acc: Set<string>): Set<string> {
  if (value === null || typeof value !== 'object') return acc
  acc.add(graphNodeId(path))
  if (Array.isArray(value)) value.forEach((v, i) => collectContainerPaths(v, [...path, String(i)], acc))
  else for (const [k, v] of Object.entries(value)) collectContainerPaths(v, [...path, k], acc)
  return acc
}

describe('scalarPreview', () => {
  it('string 带引号，超长截断', () => {
    expect(scalarPreview('hi')).toBe('"hi"')
    const long = 'x'.repeat(200)
    expect(scalarPreview(long)).toHaveLength(80)
    expect(scalarPreview(long).endsWith('…')).toBe(true)
  })
  it('number / boolean / null 直出', () => {
    expect(scalarPreview(42)).toBe('42')
    expect(scalarPreview(true)).toBe('true')
    expect(scalarPreview(null)).toBe('null')
  })
})

describe('defaultExpandedIds', () => {
  it('层级少于 5：收集全部容器 id（含根与空容器）', () => {
    const doc = { a: { b: { c: { d: 1 } } }, e: [], f: [{ g: 2 }] }
    const ids = defaultExpandedIds(doc)
    expect(ids.has(graphNodeId([]))).toBe(true)
    expect(ids.has(graphNodeId(['a']))).toBe(true)
    expect(ids.has(graphNodeId(['a', 'b']))).toBe(true)
    expect(ids.has(graphNodeId(['a', 'b', 'c']))).toBe(true)
    expect(ids.has(graphNodeId(['e']))).toBe(true)
    expect(ids.has(graphNodeId(['f']))).toBe(true)
    expect(ids.has(graphNodeId(['f', '0']))).toBe(true)
  })

  it('恰好 4 层容器：全展开', () => {
    const doc = { a: { b: { c: { d: 1 } } } }
    const ids = defaultExpandedIds(doc)
    expect(ids.has(graphNodeId(['a', 'b', 'c']))).toBe(true)
  })

  it('达到 5 层容器：整体回退为仅展开根', () => {
    const doc = { a: { b: { c: { d: { e: 1 } } } } }
    const ids = defaultExpandedIds(doc)
    expect(ids.has(graphNodeId([]))).toBe(true)
    expect(ids.has(graphNodeId(['a']))).toBe(false)
  })

  it('标量根：仅根 id（无实际节点）', () => {
    expect([...defaultExpandedIds(42)]).toEqual([graphNodeId([])])
  })

  it('容器数超出节点预算：截取至预算上限', () => {
    const doc = Object.fromEntries(
      Array.from({ length: MAX_GRAPH_NODES + 100 }, (_, i) => [`${i}`, { v: i }]),
    )
    expect(defaultExpandedIds(doc).size).toBe(MAX_GRAPH_NODES)
  })
})

describe('tableColumnWidth', () => {
  const widths = (header: string, ...values: string[]) =>
    tableColumnWidth(header, values.map((value) => ({ kind: 'string' as const, value })))

  it('短表头和值使用最小宽度', () => {
    expect(widths('id', '1', '22')).toBe(TABLE_COL_MIN)
  })

  it('按最长的完整值增加宽度，并在估算中加入左右 padding', () => {
    const value = 'x'.repeat(15)
    expect(widths('id', value)).toBe(Math.ceil(15 * 7.2 + TABLE_CELL_PADDING_X))
    expect(widths('a-long-column-header', '1')).toBeGreaterThan(TABLE_COL_MIN)
  })

  it('长值限制为图表节点的最大列宽', () => {
    expect(widths('description', 'x'.repeat(313))).toBe(TABLE_COL_MAX)
  })

  it('大量单元格不会超过函数参数上限', () => {
    const values = Array.from({ length: 70_000 }, () => ({ kind: 'string' as const, value: 'x' }))
    expect(tableColumnWidth('description', values)).toBe(TABLE_COL_MIN)
  })
})

describe('表格列存在性', () => {
  it('原型属性不会成为表格列，缺省列保持禁用状态', () => {
    const rows = JSON.parse('[{"toString":"present"},{}]') as Record<string, unknown>[]
    const graph = buildGraph({ rows }, new Set([graphNodeId(['rows'])]))
    const node = graph.nodes[1]!
    expect(node.tableColumns).toEqual(['toString'])
    expect(node.tableCells[1]?.[0]).toEqual({ kind: 'null', value: '' })
  })

  it('普通对象列不会读取原型函数', () => {
    const graph = buildGraph({ rows: [{ id: 1 }, { id: 2 }] }, new Set([graphNodeId(['rows'])]))
    const node = graph.nodes[1]!
    expect(node.tableColumns).toEqual(['id'])
    expect(node.tableCells.flat().map((cell) => cell.value)).toEqual(['1', '2'])
  })
})

describe('buildGraph', () => {
  it('未展开时只有根卡片，无边', () => {
    const graph = buildGraph({ a: 1, b: [1, 2] }, new Set())
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes[0]).toMatchObject({ id: ROOT, type: 'object', totalEntries: 2 })
    expect(graph.edges).toHaveLength(0)
    expect(graph.truncated).toBe(false)
  })

  it('展开容器行：生成子卡片与连线，entry.childId 指向子卡片', () => {
    const graph = buildGraph({ a: { b: 1 }, c: 2 }, new Set([graphNodeId(['a'])]))
    expect(graph.nodes.map((n) => n.id)).toEqual([ROOT, graphNodeId(['a'])])
    const root = graph.nodes[0]
    expect(root.entries[0]).toMatchObject({ key: 'a', kind: 'container', childCount: 1, childId: graphNodeId(['a']) })
    expect(root.entries[1]).toMatchObject({ key: 'c', kind: 'number', value: '2', childId: null })
    expect(graph.edges).toEqual([
      {
        id: `${ROOT}~${graphNodeId(['a'])}`,
        source: ROOT,
        target: graphNodeId(['a']),
        sourceHandle: 'row:a',
      },
    ])
  })

  it('数组子项 key 为索引，计数徽标数据正确', () => {
    const graph = buildGraph({ list: ['x', 'y'] }, new Set([graphNodeId(['list'])]))
    const listNode = graph.nodes[1]
    expect(listNode.type).toBe('array')
    expect(listNode.entries.map((e) => e.key)).toEqual(['0', '1'])
    expect(graph.nodes[0].entries[0]).toMatchObject({ containerType: 'array', childCount: 2 })
  })

  it('空容器不生成子卡片（childId 保持 null）', () => {
    const graph = buildGraph({ a: {}, b: [] }, new Set([graphNodeId(['a']), graphNodeId(['b'])]))
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes[0].entries.map((e) => e.childCount)).toEqual([0, 0])
  })
  it('标量根：root-scalar 单卡片', () => {
    const graph = buildGraph(42, new Set())
    expect(graph.nodes[0]).toMatchObject({ type: 'root-scalar', scalarPreview: '42' })
    expect(graph.edges).toHaveLength(0)
  })

  it('嵌套展开：只渲染可达子树', () => {
    const doc = { a: { b: { c: 1 } } }
    const both = new Set([graphNodeId(['a']), graphNodeId(['a', 'b'])])
    const graph = buildGraph(doc, both)
    expect(graph.nodes.map((n) => n.id)).toEqual([ROOT, graphNodeId(['a']), graphNodeId(['a', 'b'])])
    expect(graph.nodes[2].entries[0]).toMatchObject({ key: 'c', value: '1' })
  })

  it('卡片行数超限：截断 + 尾行计数', () => {
    const big = Object.fromEntries(Array.from({ length: MAX_CARD_ROWS + 5 }, (_, i) => [`k${i}`, i]))
    const graph = buildGraph(big, new Set())
    expect(graph.nodes[0].entries).toHaveLength(MAX_CARD_ROWS)
    expect(graph.nodes[0].truncatedRows).toBe(true)
    expect(graph.nodes[0].totalEntries).toBe(MAX_CARD_ROWS + 5)
  })

  it('对象数组（元素全为统一标量对象）→ 表格节点：列取并集、无子卡片', () => {
    const doc = { rows: [{ h1: 11, h2: 12 }, { h1: 21, h3: 23 }] }
    const graph = buildGraph(doc, collectContainerPaths(doc, [], new Set()))
    const rows = graph.nodes.find((n) => n.id === graphNodeId(['rows']))
    expect(rows).toMatchObject({
      tableColumns: ['h1', 'h2', 'h3'],
      tableColumnWidths: [TABLE_COL_MIN, TABLE_COL_MIN, TABLE_COL_MIN],
      totalEntries: 2,
    })
    // 单元格对齐列：缺省列补空串
    expect(rows?.tableCells[0]).toEqual([
      { kind: 'number', value: '11' },
      { kind: 'number', value: '12' },
      { kind: 'null', value: '' },
    ])
    expect(rows?.tableCells[1][2]).toEqual({ kind: 'number', value: '23' })
    // 元素不再生成子卡片
    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges).toHaveLength(1)
  })

  it('表格单元格保留完整字符串，列宽由完整值计算', () => {
    const value = 'LONG-' + '0123456789'.repeat(30) + '-END'
    const graph = buildGraph({ rows: [{ description: value }] }, new Set([graphNodeId(['rows'])]))
    const node = graph.nodes[1]!
    expect(node.tableCells[0]?.[0]).toEqual({ kind: 'string', value: JSON.stringify(value) })
    expect(node.tableColumnWidths).toEqual([TABLE_COL_MAX])
  })

  it('列宽使用截断行之前的全部表格值', () => {
    const value = 'x'.repeat(30)
    const doc = {
      rows: [
        { description: 'short' },
        ...Array.from({ length: MAX_CARD_ROWS }, (_, i) => ({ description: i === 0 ? value : 'short' })),
      ],
    }
    const graph = buildGraph(doc, new Set([graphNodeId(['rows'])]))
    const rows = graph.nodes[1]!
    expect(rows.tableCells).toHaveLength(MAX_CARD_ROWS)
    expect(rows.tableColumnWidths).toEqual([Math.ceil((value.length + 2) * 7.2 + TABLE_CELL_PADDING_X)])
  })

  it('元素含标量或容器值时回退常规卡片模式', () => {
    const mixed = { list: [{ a: 1 }, 'text'], nested: [{ a: { deep: 1 } }] }
    const graph = buildGraph(mixed, collectContainerPaths(mixed, [], new Set()))
    for (const node of graph.nodes) {
      expect(node.tableColumns).toBeNull()
    }
  })

  it('表格行数超限：截断 + 尾行计数', () => {
    const doc = {
      rows: Array.from({ length: MAX_CARD_ROWS + 3 }, (_, i) => ({ v: i })),
    }
    const graph = buildGraph(doc, new Set([graphNodeId(['rows'])]))
    const rows = graph.nodes.find((n) => n.id === graphNodeId(['rows']))
    expect(rows?.tableCells).toHaveLength(MAX_CARD_ROWS)
    expect(rows?.truncatedRows).toBe(true)
    expect(rows?.totalEntries).toBe(MAX_CARD_ROWS + 3)
  })

  it('节点预算耗尽：truncated 置真且子树不再展开', () => {
    // 90 条 × 每条 12 层容器链，全量展开需要 1 + 90×12 = 1081 个节点，必超预算
    const doc: Record<string, unknown> = {}
    for (let i = 0; i < 90; i++) {
      let chain: unknown = { leaf: i }
      for (let d = 0; d < 11; d++) chain = { next: chain }
      doc[String(i)] = chain
    }
    const allIds = new Set<string>()
    collectContainerPaths(doc, [], allIds)
    const graph = buildGraph(doc, allIds)
    expect(graph.truncated).toBe(true)
    expect(graph.nodes.length).toBeLessThanOrEqual(MAX_GRAPH_NODES)
    // 仍在展开集合但预算耗尽的路径不再生成卡片，其行保持收起态
    const collapsed = graph.nodes.flatMap((n) => n.entries).filter((e) => e.childId === null)
    expect(collapsed.length).toBeGreaterThan(0)
  })
})
