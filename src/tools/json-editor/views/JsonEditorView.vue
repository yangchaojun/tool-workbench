<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  NButton,
  NDropdown,
  NIcon,
  NPopover,
  NRadioButton,
  NRadioGroup,
  NTabPane,
  NTabs,
} from 'naive-ui'
import {
  CloudUploadOutline,
  CopyOutline,
  DownloadOutline,
  TrashOutline,
  ArrowUndoOutline,
  ArrowRedoOutline,
  BuildOutline,
  TimeOutline,
} from '@vicons/ionicons5'

import { formatBytes, useJsonEditorStore } from '../stores/jsonEditor'
import { escapeJsonText, unicodeDecode, unicodeEncode, unescapeJsonText } from '../transform/codec'
import { repairJson } from '../parser/repair'
import EditorPane from '../components/EditorPane.vue'
import TreePane from '../components/TreePane.vue'
import RepairModal from '../components/RepairModal.vue'
import HistoryPanel from '../components/HistoryPanel.vue'
import LoadConfirmModal from '../components/LoadConfirmModal.vue'
import DiffView from './DiffView.vue'

const store = useJsonEditorStore()

const fileInput = ref<HTMLInputElement | null>(null)
const editorPaneRef = ref<InstanceType<typeof EditorPane> | null>(null)

// 宽屏并排（≥1024px），窄屏退化为 文本/树形 两个 Tab
const mql = window.matchMedia('(min-width: 1024px)')
const wide = ref(mql.matches)
const onMqlChange = (event: MediaQueryListEvent) => {
  wide.value = event.matches
}
onMounted(() => mql.addEventListener('change', onMqlChange))
onBeforeUnmount(() => mql.removeEventListener('change', onMqlChange))

const activeTab = ref<'text' | 'tree'>('text')
watch(activeTab, (tab) => {
  if (tab === 'text') nextTick(() => editorPaneRef.value?.remeasure())
})
watch(
  () => store.mode,
  (mode) => {
    if (mode === 'edit') nextTick(() => editorPaneRef.value?.remeasure())
  },
)

const paneHeightClass = 'h-[560px] min-h-[420px] xl:h-[calc(100vh-360px)]'

// ── 状态栏 ─────────────────────────────────────────────────────

const status = computed(() => {
  if (store.loadError !== null) {
    return { kind: 'error', text: store.loadError } as const
  }
  const r = store.result
  if (r === null) {
    return store.input === ''
      ? ({ kind: 'muted', text: '粘贴、上传或直接编辑 JSON，稍候即自动校验' } as const)
      : ({ kind: 'muted', text: `输入 ${formatBytes(store.byteSize)}` } as const)
  }
  if (r.ok) return { kind: 'ok', text: '✓ 合法 JSON' } as const
  return {
    kind: 'error',
    text:
      r.location !== null
        ? `✗ 第 ${r.location.line} 行 第 ${r.location.column} 列：${r.location.message}`
        : `✗ ${r.rawMessage}`,
  } as const
})

const copyLabel = computed(() => {
  if (store.copied) return '已复制 ✓'
  return store.outputMode === 'format' ? '复制格式化' : '复制压缩'
})

// ── 处理下拉 ───────────────────────────────────────────────────

const processOptions = [
  { label: '转义（文本 → 字符串字面量）', key: 'escape' },
  { label: '反转义（字符串字面量 → 文本）', key: 'unescape' },
  { type: 'divider', key: 'd1' },
  { label: 'Unicode 编码（全部字符）', key: 'unicode-all' },
  { label: 'Unicode 编码（仅非 ASCII）', key: 'unicode-nonascii' },
  { label: 'Unicode 解码（\\uXXXX → 字符）', key: 'unicode-decode' },
  { type: 'divider', key: 'd2' },
  { label: '尝试修复常见语法错误…', key: 'repair' },
]

const processError = ref<string | null>(null)

function onProcess(key: string | number) {
  processError.value = null
  const text = store.input
  try {
    switch (key) {
      case 'escape':
        store.applyTextTransform(escapeJsonText(text))
        break
      case 'unescape':
        store.applyTextTransform(unescapeJsonText(text))
        break
      case 'unicode-all':
        store.applyTextTransform(unicodeEncode(text, 'all'))
        break
      case 'unicode-nonascii':
        store.applyTextTransform(unicodeEncode(text, 'non-ascii'))
        break
      case 'unicode-decode':
        store.applyTextTransform(unicodeDecode(text))
        break
      case 'repair': {
        const outcome = repairJson(text)
        if (outcome.ok) {
          store.repairCandidate = { text: outcome.text, fixes: outcome.fixes }
        } else {
          processError.value = outcome.reason
        }
        break
      }
    }
  } catch (error) {
    processError.value = error instanceof Error ? error.message : String(error)
  }
}

// ── 快捷键：统一历史栈接管 ⌘Z / ⌘⇧Z ──────────────────────────

function onKeydown(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey)) return
  const key = event.key.toLowerCase()
  if (key === 'z') {
    event.preventDefault()
    if (event.shiftKey) store.redo()
    else store.undo()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// ── 动作 ───────────────────────────────────────────────────────

async function onFilePicked(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) await store.loadFile(file)
  target.value = ''
}

function pickFile() {
  fileInput.value?.click()
}
</script>

<template>
  <section>
    <header class="mb-6">
      <h1 class="text-2xl font-medium tracking-tight">JSON 编辑器</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        粘贴或上传 JSON：格式化 / 压缩、精确定位与容错修复、树形增删改与排序、查找替换、查询与 Diff 对比、文档历史与远程加载。
        数据默认不出浏览器；仅「历史」面板中的远程加载（URL 拉取）会在你点击时发起一次网络请求。
      </p>
    </header>

    <!-- 顶层模式：编辑 / 对比 -->
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <NRadioGroup v-model:value="store.mode" size="small">
        <NRadioButton value="edit">编辑</NRadioButton>
        <NRadioButton value="diff">对比</NRadioButton>
      </NRadioGroup>
      <div class="min-w-4 flex-1" />
      <!-- 主工具栏 -->
      <template v-if="store.mode === 'edit'">
        <NButton size="small" secondary @click="pickFile">
          <template #icon>
            <NIcon :size="16"><CloudUploadOutline /></NIcon>
          </template>
          上传
        </NButton>
        <NPopover trigger="click" placement="bottom-end" :width="380">
          <template #trigger>
            <NButton size="small" secondary>
              <template #icon>
                <NIcon :size="16"><TimeOutline /></NIcon>
              </template>
              历史
            </NButton>
          </template>
          <HistoryPanel />
        </NPopover>
        <NButton size="small" type="primary" secondary :disabled="!store.hasData" @click="store.format()">
          格式化
        </NButton>
        <NButton size="small" type="primary" secondary :disabled="!store.hasData" @click="store.minify()">
          压缩
        </NButton>
        <NButton size="small" quaternary :disabled="!store.canUndo" @click="store.undo()">
          <template #icon>
            <NIcon :size="16"><ArrowUndoOutline /></NIcon>
          </template>
          撤销
        </NButton>
        <NButton size="small" quaternary :disabled="!store.canRedo" @click="store.redo()">
          <template #icon>
            <NIcon :size="16"><ArrowRedoOutline /></NIcon>
          </template>
          重做
        </NButton>
        <NButton size="small" quaternary :disabled="!store.hasData" @click="store.copyResult()">
          <template #icon>
            <NIcon :size="16"><CopyOutline /></NIcon>
          </template>
          {{ copyLabel }}
        </NButton>
        <NButton size="small" quaternary :disabled="!store.hasData" @click="store.download()">
          <template #icon>
            <NIcon :size="16"><DownloadOutline /></NIcon>
          </template>
          下载
        </NButton>
        <NButton size="small" quaternary :disabled="store.input === ''" @click="store.clear()">
          <template #icon>
            <NIcon :size="16"><TrashOutline /></NIcon>
          </template>
          清空
        </NButton>
        <NDropdown trigger="click" :options="processOptions" @select="onProcess">
          <NButton size="small" secondary>
            <template #icon>
              <NIcon :size="16"><BuildOutline /></NIcon>
            </template>
            处理
          </NButton>
        </NDropdown>
        <input ref="fileInput" type="file" class="hidden" @change="onFilePicked" />
      </template>
    </div>

    <!-- 状态栏 -->
    <div class="mb-3 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span
        :class="{
          'font-medium text-destructive': status.kind === 'error',
          'font-medium text-accent': status.kind === 'ok',
          'text-muted-foreground': status.kind === 'muted',
        }"
      >
        {{ status.text }}
      </span>
      <span v-if="status.kind === 'ok'" class="text-muted-foreground">
        {{ formatBytes(store.byteSize) }}
      </span>
      <span v-if="processError !== null" class="font-medium text-destructive">
        {{ processError }}
      </span>
      <span v-if="store.mode === 'edit' && store.dataStale" class="text-muted-foreground">
        · 树形视图与最新文本不同步，重新校验通过后自动恢复
      </span>
      <!-- 超软上限：无论当前结果是 ok / error / 无结果，都保持手动校验入口 -->
      <template v-if="store.overSoftCap && store.input !== ''">
        <span class="text-muted-foreground">· 已超过 1MB，自动校验暂停</span>
        <NButton size="tiny" type="primary" secondary @click="store.validate()">
          立即校验
        </NButton>
      </template>
    </div>

    <!-- 主区 -->
    <DiffView v-if="store.mode === 'diff'" />
    <template v-else>
      <div v-if="wide" :class="paneHeightClass" class="grid grid-cols-2 gap-4">
        <EditorPane ref="editorPaneRef" />
        <TreePane />
      </div>
      <NTabs v-else v-model:value="activeTab" type="segment" size="small" class="mb-2">
        <NTabPane name="text" tab="文本" display-directive="show">
          <div :class="paneHeightClass">
            <EditorPane ref="editorPaneRef" />
          </div>
        </NTabPane>
        <NTabPane name="tree" tab="树形" display-directive="show">
          <div :class="paneHeightClass">
            <TreePane />
          </div>
        </NTabPane>
      </NTabs>
    </template>

    <RepairModal />
    <LoadConfirmModal />
  </section>
</template>
