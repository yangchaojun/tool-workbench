<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NButton, NIcon, NTabPane, NTabs } from 'naive-ui'
import {
  CloudUploadOutline,
  CopyOutline,
  DownloadOutline,
  TrashOutline,
} from '@vicons/ionicons5'

import { formatBytes, useJsonViewerStore } from '../stores/jsonViewer'
import EditorPane from '../components/EditorPane.vue'
import TreePane from '../components/TreePane.vue'

const store = useJsonViewerStore()

const fileInput = ref<HTMLInputElement | null>(null)
const editorPaneRef = ref<InstanceType<typeof EditorPane> | null>(null)

// 宽屏并排（≥1024px），窄屏退化为 文本/树形 两个 Tab
const wide = ref(window.matchMedia('(min-width: 1024px)').matches)
const mql = window.matchMedia('(min-width: 1024px)')
const onMqlChange = (event: MediaQueryListEvent) => {
  wide.value = event.matches
}
onMounted(() => mql.addEventListener('change', onMqlChange))
onBeforeUnmount(() => mql.removeEventListener('change', onMqlChange))

const activeTab = ref<'text' | 'tree'>('text')
watch(activeTab, (tab) => {
  if (tab === 'text') nextTick(() => editorPaneRef.value?.remeasure())
})

const paneHeightClass =
  'h-[560px] min-h-[420px] xl:h-[calc(100vh-360px)]'

// ── 状态栏 ─────────────────────────────────────────────────────

const status = computed(() => {
  if (store.uploadError !== null) {
    return { kind: 'error', text: store.uploadError } as const
  }
  const r = store.result
  if (r === null) return { kind: 'idle' } as const
  if (r.ok) return { kind: 'ok' } as const
  return {
    kind: 'error',
    text:
      r.location !== null
        ? `第 ${r.location.line} 行 第 ${r.location.column} 列：${r.location.message}`
        : r.rawMessage,
  } as const
})

const copyLabel = computed(() => {
  if (store.copied) return '已复制 ✓'
  return store.outputMode === 'format' ? '复制格式化' : '复制压缩'
})

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
      <h1 class="text-2xl font-semibold tracking-tight">JSON 查看器</h1>
      <p class="mt-1 text-sm text-ink-muted">
        粘贴或上传 JSON：格式化 / 压缩、精确定位语法错误、高亮文本与可折叠树形浏览，一键复制下载。数据不出浏览器。
      </p>
    </header>

    <!-- 工具栏 -->
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <NButton size="small" secondary @click="pickFile">
        <template #icon>
          <NIcon :size="16"><CloudUploadOutline /></NIcon>
        </template>
        上传
      </NButton>
      <NButton
        size="small"
        type="primary"
        secondary
        :disabled="!store.hasData"
        @click="store.format()"
      >
        格式化
      </NButton>
      <NButton
        size="small"
        type="primary"
        secondary
        :disabled="!store.hasData"
        @click="store.minify()"
      >
        压缩
      </NButton>
      <div class="min-w-4 flex-1" />
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
      <NButton
        size="small"
        quaternary
        :disabled="store.input === ''"
        @click="store.clear()"
      >
        <template #icon>
          <NIcon :size="16"><TrashOutline /></NIcon>
        </template>
        清空
      </NButton>
      <input ref="fileInput" type="file" class="hidden" @change="onFilePicked" />
    </div>

    <!-- 状态栏 -->
    <div class="mb-3 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <template v-if="status.kind === 'error'">
        <span class="font-medium text-red-600 dark:text-red-400">✗ {{ status.text }}</span>
      </template>
      <template v-else-if="status.kind === 'ok'">
        <span class="font-medium text-emerald-600 dark:text-emerald-400">✓ 合法 JSON</span>
        <span class="text-ink-muted">{{ formatBytes(store.byteSize) }}</span>
        <span v-if="store.overSoftCap" class="text-ink-muted">
          · 已超过 1MB 软上限，自动校验暂停
        </span>
      </template>
      <template v-else>
        <template v-if="store.overSoftCap">
          <span class="text-ink-muted">
            输入 {{ formatBytes(store.byteSize) }}，超过 1MB 软上限：自动校验已暂停
          </span>
          <NButton size="tiny" type="primary" secondary @click="store.validate()">
            立即校验
          </NButton>
        </template>
        <span v-else class="text-ink-muted">
          在左侧粘贴、上传或直接编辑 JSON，稍候即自动校验
        </span>
      </template>
    </div>

    <!-- 主区：宽屏并排，窄屏 Tab -->
    <div v-if="wide" :class="paneHeightClass" class="grid grid-cols-2 gap-4">
      <EditorPane ref="editorPaneRef" />
      <TreePane />
    </div>
    <NTabs
      v-else
      v-model:value="activeTab"
      type="segment"
      size="small"
      class="mb-2"
    >
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
  </section>
</template>
