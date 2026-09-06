<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NIcon, NInput } from 'naive-ui'
import { CloudUploadOutline } from '@vicons/ionicons5'

import { diffJson, diffStats } from '../diff/diff'
import { locateJsonError } from '../parser/locate'
import { formatBytes, UPLOAD_CAP_BYTES } from '../stores/jsonEditor'
import DiffTree from '../components/DiffTree.vue'

/**
 * 对比模式：双栏只读输入（粘贴 + 上传），各自校验；
 * 双方合法时自动给出结构化 diff（见 CONTEXT.md「对比」）。
 */

const leftText = ref('')
const rightText = ref('')
const leftFileInput = ref<HTMLInputElement | null>(null)
const rightFileInput = ref<HTMLInputElement | null>(null)
const leftUploadError = ref<string | null>(null)
const rightUploadError = ref<string | null>(null)

interface SideState {
  ok: boolean
  data: unknown
  size: number
  error: string | null
  empty: boolean
}

function parseSide(text: string): SideState {
  const size = new TextEncoder().encode(text).length
  if (text.trim() === '') return { ok: false, data: undefined, size, error: null, empty: true }
  try {
    return { ok: true, data: JSON.parse(text), size, error: null, empty: false }
  } catch (error) {
    const location = locateJsonError(text)
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      data: undefined,
      size,
      error:
        location !== null
          ? `第 ${location.line} 行 第 ${location.column} 列：${location.message}`
          : message,
      empty: false,
    }
  }
}

const left = computed(() => parseSide(leftText.value))
const right = computed(() => parseSide(rightText.value))

const diffResult = computed(() => {
  if (!left.value.ok || !right.value.ok) return null
  return diffJson(left.value.data, right.value.data)
})

const stats = computed(() => (diffResult.value === null ? null : diffStats(diffResult.value)))

const identical = computed(
  () =>
    diffResult.value !== null &&
    diffResult.value.status === 'equal' &&
    diffResult.value.children.every((c) => c.status === 'equal'),
)

function setFileRef(side: 'left' | 'right', el: unknown) {
  if (side === 'left') leftFileInput.value = el as HTMLInputElement
  else rightFileInput.value = el as HTMLInputElement
}

async function pickFile(side: 'left' | 'right') {
  const input = side === 'left' ? leftFileInput.value : rightFileInput.value
  input?.click()
}

async function onFile(event: Event, side: 'left' | 'right') {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (file === undefined) return
  const errorRef = side === 'left' ? leftUploadError : rightUploadError
  errorRef.value = null
  if (file.size > UPLOAD_CAP_BYTES) {
    errorRef.value = `文件过大（${formatBytes(file.size)}），上传上限 ${formatBytes(UPLOAD_CAP_BYTES)}`
    return
  }
  try {
    const text = await file.text()
    if (side === 'left') leftText.value = text
    else rightText.value = text
  } catch {
    errorRef.value = `无法读取文件 ${file.name}`
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 双栏输入 -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div
        v-for="(side, key) in { left: { label: 'A（原数据）', state: left, text: leftText }, right: { label: 'B（新数据）', state: right, text: rightText } }"
        :key="key"
        class="rounded-panel border border-border bg-card p-3"
      >
        <div class="mb-2 flex items-center gap-2">
          <span class="text-sm font-medium">{{ side.label }}</span>
          <span
            v-if="!side.state.empty"
            class="text-xs"
            :class="side.state.ok ? 'text-accent' : 'text-destructive'"
          >
            {{ side.state.ok ? `✓ 合法 JSON · ${formatBytes(side.state.size)}` : `✗ ${side.state.error}` }}
          </span>
          <span v-else-if="(key === 'left' ? leftUploadError : rightUploadError) !== null" class="text-xs text-destructive">
            {{ key === 'left' ? leftUploadError : rightUploadError }}
          </span>
          <span v-else class="text-xs text-muted-foreground">粘贴或载入 JSON</span>
          <div class="flex-1" />
          <NButton size="tiny" quaternary @click="pickFile(key as 'left' | 'right')">
            <template #icon>
              <NIcon :size="14"><CloudUploadOutline /></NIcon>
            </template>
            载入
          </NButton>
        </div>
        <NInput
          :value="side.text"
          type="textarea"
          class="font-mono"
          :autosize="{ minRows: 8, maxRows: 14 }"
          placeholder='{"example": true}'
          @update:value="(v: string) => (key === 'left' ? (leftText = v) : (rightText = v))"
        />
        <input
          :ref="(el) => setFileRef(key as 'left' | 'right', el)"
          type="file"
          class="hidden"
          @change="onFile($event, key as 'left' | 'right')"
        />
      </div>
    </div>

    <!-- 结果 -->
    <div class="rounded-panel border border-border bg-card p-4">
      <div v-if="diffResult === null" class="py-6 text-center text-sm text-muted-foreground">
        双侧均为合法 JSON 后自动对比
      </div>
      <template v-else>
        <div class="mb-3 flex items-center gap-3 text-sm">
          <template v-if="identical">
            <span class="font-medium text-accent">✓ 两份数据完全相同</span>
          </template>
          <template v-else>
            <span class="font-medium">差异：</span>
            <span class="text-accent">+ {{ stats?.added ?? 0 }} 新增</span>
            <span class="text-destructive">− {{ stats?.removed ?? 0 }} 删除</span>
            <span class="text-json-number">~ {{ stats?.changed ?? 0 }} 修改</span>
          </template>
        </div>
        <div v-if="!identical" class="max-h-[60vh] overflow-auto">
          <DiffTree :node="diffResult" :depth="0" />
        </div>
      </template>
    </div>
  </div>
</template>
