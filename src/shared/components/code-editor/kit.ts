import {
  Decoration,
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  type DecorationSet,
} from '@codemirror/view'
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/**
 * CodeEditor 的静态装配：主题、高亮风格与错误标记字段。
 * 语言与只读态是可变配置，由组件经 Compartment 在运行时切换。
 */

/** 错误标记的坐标契约（行/列均 1 起始，与定位器对齐） */
export interface CodeErrorMark {
  line: number
  column: number
  message: string
}

/** 设置/清除错误标记：pos 为文档内偏移；null 表示清除 */
export const setErrorMark = StateEffect.define<{ pos: number; message: string } | null>()

const errorMarkField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, tr) {
    let next = marks.map(tr.changes)
    // 只认自己的 effect——同一事务里还可能有 scrollIntoView 等其他 effect
    for (const effect of tr.effects) {
      if (!effect.is(setErrorMark)) continue
      if (effect.value === null) {
        next = Decoration.none
      } else {
        const { pos, message } = effect.value
        const line = tr.state.doc.lineAt(pos)
        next = Decoration.set(
          [
            Decoration.line({ class: 'cm-errorLine' }).range(line.from),
            Decoration.mark({
              class: 'cm-errorToken',
              attributes: { title: message },
            }).range(Math.min(pos, line.to), line.to),
          ],
          true,
        )
      }
    }
    return next
  },
  provide: (field) => EditorView.decorations.from(field),
})

/** 跟随工作台 CSS 变量的主题——换肤时编辑器无需重载 */
const workbenchTheme = EditorView.theme({
  '&': {
    color: 'var(--color-foreground)',
    backgroundColor: 'transparent',
    fontSize: 'var(--text-json)',
    height: '100%',
  },
  '.cm-scroller': {
    overflow: 'auto',
    lineHeight: 'var(--text-json--line-height)',
    fontFamily:
      "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  },
  '.cm-content': { caretColor: 'var(--color-foreground)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--color-muted-foreground)',
    border: 'none',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--color-json-editor-highlight)',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  // 工具侧自绘查找替换时 @codemirror/search 的匹配高亮（MASTER.md「Search match」）
  '.cm-searchMatch': {
    backgroundColor: 'var(--color-json-match-bg)',
    color: 'var(--color-json-match-text)',
  },
  '.cm-searchMatch-selected': {
    backgroundColor: 'var(--color-json-match-bg)',
    color: 'var(--color-json-match-text)',
    outline: '1px solid var(--color-accent)',
  },
  '.cm-errorLine': {
    backgroundColor: 'color-mix(in srgb, var(--color-destructive) 10%, transparent)',
  },
  '.cm-errorToken': { textDecoration: 'underline wavy var(--color-destructive)' },
})

/* JSON 语法四色（MASTER.md「JSON / Code Syntax Colors」，双主题经 CSS 变量切换） */
const jsonHighlight = HighlightStyle.define([
  { tag: t.propertyName, color: 'var(--color-foreground)', fontWeight: '500' },
  { tag: t.string, color: 'var(--color-json-string)' },
  { tag: t.number, color: 'var(--color-json-number)' },
  { tag: t.bool, color: 'var(--color-json-boolean)' },
  { tag: t.null, color: 'var(--color-json-null)' },
  { tag: t.invalid, color: 'var(--color-destructive)' },
])

export function buildBaseExtensions(withHistory = true): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    drawSelection(),
    dropCursor(),
    // 历史栈可关闭：工具侧用统一快照栈接管撤销/重做时避免双栈（见 ADR-0003）
    ...(withHistory ? [history()] : []),
    errorMarkField,
    workbenchTheme,
    syntaxHighlighting(jsonHighlight),
    keymap.of(withHistory ? [...defaultKeymap, ...historyKeymap] : [...defaultKeymap]),
  ]
}

/** 只读态的两组件：输入拦截 + 不可聚焦编辑 */
export function readonlyExtensions(readonly: boolean): Extension[] {
  return [EditorState.readOnly.of(readonly), EditorView.editable.of(!readonly)]
}
