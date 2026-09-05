/** 树形视图的展开/折叠广播指令（seq 保证同一指令可重复触发） */
export interface TreeCommand {
  kind: 'expand' | 'collapse'
  seq: number
}

/** 渲染护栏（docs 见 issues/tickets/011）：无虚拟滚动下的过载保护 */
export const CHILDREN_RENDER_CAP = 200
export const DEPTH_RENDER_CAP = 200
