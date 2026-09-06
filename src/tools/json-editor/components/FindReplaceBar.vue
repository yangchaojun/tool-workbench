<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NCheckbox, NIcon, NInput } from 'naive-ui'
import {
  ArrowDownOutline,
  ArrowUpOutline,
  CloseOutline,
  SwapVerticalOutline,
  CheckmarkDoneOutline,
} from '@vicons/ionicons5'
import { EditorView } from '@codemirror/view'
import {
  findNext as findNextCmd,
  findPrevious as findPrevCmd,
  replaceAll as replaceAllCmd,
  replaceNext,
  SearchQuery,
  setSearchQuery,
} from '@codemirror/search'

/**
 * 文本视图的查找替换栏（自绘 UI，经 CodeEditor 暴露的 EditorView
 * 以 @codemirror/search 的编程式 API 驱动——契约扩展，见 ADR-0001）。
 */

const props = defineProps<{
  /** 取 EditorView 的惰性求值（编辑器挂载后才可用，避免渲染时序问题） */
  getView: () => EditorView | null
}>()

const emit = defineEmits<{ close: [] }>()

const findText = ref('')
const replaceText = ref('')
const caseSensitive = ref(false)
const useRegex = ref(false)
const matchCount = ref(0)
const message = ref<string | null>(null)

const query = computed(
  () =>
    new SearchQuery({
      search: findText.value,
      replace: replaceText.value,
      caseSensitive: caseSensitive.value,
      regexp: useRegex.value,
    }),
)

// 输入变化即更新搜索高亮与计数
watch([findText, caseSensitive, useRegex], ([text]) => {
  message.value = null
  const view = props.getView()
  if (view === null) return
  view.dispatch({ effects: setSearchQuery.of(query.value) })
  matchCount.value = text === '' ? 0 : countMatches(view)
})

function countMatches(view: EditorView): number {
  let cursor
  try {
    cursor = query.value.getCursor(view.state)
  } catch {
    return 0
  }
  let n = 0
  while (!cursor.next().done && n < 10_000) n += 1
  return n
}

function nav(direction: 1 | -1) {
  const view = props.getView()
  if (view === null || findText.value === '') return
  view.dispatch({ effects: setSearchQuery.of(query.value) })
  const searchCommand = direction === 1 ? findNextCmd : findPrevCmd
  const found = searchCommand(view)
  message.value = found ? null : '未找到匹配'
}


function replaceOne() {
  const view = props.getView()
  if (view === null || findText.value === '') return
  view.dispatch({ effects: setSearchQuery.of(query.value) })
  const done = replaceNext(view)
  message.value = done ? null : '当前光标处无匹配'
  matchCount.value = countMatches(view)
}

function replaceEverything() {
  const view = props.getView()
  if (view === null || findText.value === '') return
  view.dispatch({ effects: setSearchQuery.of(query.value) })
  replaceAllCmd(view)
  message.value = '已全部替换'
  matchCount.value = 0
}

function close() {
  props.getView()?.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) })
  emit('close')
}
</script>

<template>
  <div
    class="absolute right-3 top-3 z-10 flex w-[min(30rem,calc(100%-1.5rem))] flex-col gap-2 rounded-panel border border-border bg-card p-3"
  >
    <div class="flex items-center gap-1.5">
      <NInput
        v-model:value="findText"
        size="tiny"
        class="min-w-0 flex-1 font-mono"
        placeholder="查找"
        autofocus
        @keydown.enter.prevent="nav(1)"
        @keydown.esc="close"
      />
      <span v-if="findText !== ''" class="shrink-0 text-xs text-muted-foreground">
        {{ matchCount }} 处
      </span>
      <button
        type="button"
        class="rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
        aria-label="上一个"
        @click="nav(-1)"
      >
        <NIcon :size="14"><ArrowUpOutline /></NIcon>
      </button>
      <button
        type="button"
        class="rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
        aria-label="下一个"
        @click="nav(1)"
      >
        <NIcon :size="14"><ArrowDownOutline /></NIcon>
      </button>
      <button
        type="button"
        class="rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
        aria-label="关闭"
        @click="close"
      >
        <NIcon :size="14"><CloseOutline /></NIcon>
      </button>
    </div>
    <div class="flex items-center gap-1.5">
      <NInput
        v-model:value="replaceText"
        size="tiny"
        class="min-w-0 flex-1 font-mono"
        placeholder="替换为（留空=删除）"
        @keydown.enter="replaceOne"
        @keydown.esc="close"
      />
      <NButton size="tiny" quaternary @click="replaceOne">
        <template #icon>
          <NIcon :size="13"><SwapVerticalOutline /></NIcon>
        </template>
        替换
      </NButton>
      <NButton size="tiny" quaternary @click="replaceEverything">
        <template #icon>
          <NIcon :size="13"><CheckmarkDoneOutline /></NIcon>
        </template>
        全部
      </NButton>
    </div>
    <div class="flex items-center gap-3">
      <NCheckbox v-model:checked="caseSensitive" size="small">区分大小写</NCheckbox>
      <NCheckbox v-model:checked="useRegex" size="small">正则</NCheckbox>
      <span v-if="message !== null" class="ml-auto text-xs text-muted-foreground">{{ message }}</span>
    </div>
  </div>
</template>
