<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorView } from '@codemirror/view'
import { Compartment, EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'

import {
  buildBaseExtensions,
  readonlyExtensions,
  setErrorMark,
  type CodeErrorMark,
} from './kit'

/**
 * CodeMirror 6 的窄契约封装（见 docs/adr/0001）。
 * 只暴露 value / readonly / language / errorMark 四个能力；
 * 语言相关的智能（校验、错误定位）全部留在工具侧。
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    readonly?: boolean
    language?: 'json'
    errorMark?: CodeErrorMark | null
    /** 内建撤销历史；工具侧用统一历史栈接管时置 false（见 ADR-0003） */
    history?: boolean
  }>(),
  { readonly: false, language: 'json', errorMark: null, history: true },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const host = ref<HTMLElement | null>(null)
let view: EditorView | null = null

const languageConf = new Compartment()
const readonlyConf = new Compartment()

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        ...buildBaseExtensions(props.history),
        languageConf.of(props.language === 'json' ? json() : []),
        readonlyConf.of(readonlyExtensions(props.readonly)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            emit('update:modelValue', update.state.doc.toString())
          }
        }),
      ],
    }),
  })
  // 挂载即应用初始错误标记（如恢复的输入本身有错），不能只依赖 watch
  applyErrorMark(props.errorMark)
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

// 外部值变化时同步进编辑器（自身输入造成的回写值相同，天然跳过）
watch(
  () => props.modelValue,
  (value) => {
    if (!view) return
    const current = view.state.doc.toString()
    if (value !== current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  },
)

watch(
  () => props.readonly,
  (value) => {
    view?.dispatch({
      effects: readonlyConf.reconfigure(readonlyExtensions(value)),
    })
  },
)

// 错误标记：行背景 + 从错误列到行尾的波浪线；同时在视口内滚动到该处
function applyErrorMark(mark: CodeErrorMark | null) {
  if (!view) return
  if (!mark) {
    view.dispatch({ effects: setErrorMark.of(null) })
    return
  }
  const lineNo = Math.min(Math.max(mark.line, 1), view.state.doc.lines)
  const line = view.state.doc.line(lineNo)
  const pos = Math.min(line.from + Math.max(mark.column - 1, 0), line.to)
  view.dispatch({
    effects: [
      setErrorMark.of({ pos, message: mark.message }),
      EditorView.scrollIntoView(pos, { y: 'center' }),
    ],
  })
}

watch(
  () => props.errorMark,
  (mark) => {
    applyErrorMark(mark)
  },
)

/** 容器从 display:none 恢复显示后调用，让 CodeMirror 重新测量 */
function remeasure() {
  view?.requestMeasure()
}

// 视图访问：契约的显式扩展（ADR-0001）——供工具侧实现查找替换等
// 编辑器级 UX（搜索状态属于工具 UI，不进共享组件）
defineExpose({ remeasure, getView: () => view })
</script>

<template>
  <div ref="host" class="h-full min-h-0" />
</template>
