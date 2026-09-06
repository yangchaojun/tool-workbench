<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NModal } from 'naive-ui'

import { formatBytes, useJsonEditorStore } from '../stores/jsonEditor'
import { textBytes } from '../document/documentHistory'

/**
 * 统一载入确认弹窗：当前输入非空且与目标内容不同时，
 * 上传 / URL 拉取 / 文档历史恢复都会经此确认后才覆盖（CONTEXT.md「输入」）。
 */

const store = useJsonEditorStore()

const pending = computed(() => store.pendingLoad)
const pendingSize = computed(() =>
  pending.value === null ? '' : formatBytes(textBytes(pending.value.text)),
)
</script>

<template>
  <NModal
    :show="pending !== null"
    preset="card"
    title="载入并覆盖当前内容？"
    class="w-[min(28rem,92vw)]"
    :mask-closable="true"
    @update:show="store.cancelPendingLoad()"
  >
    <div class="flex flex-col gap-3 text-sm">
      <p class="text-ink-muted">当前编辑器内容将被替换（可撤销，⌘Z 恢复）。</p>
      <div class="rounded bg-primary-soft/30 p-2">
        <div class="text-xs text-ink-muted">载入来源</div>
        <div class="break-all font-mono text-xs">{{ pending?.label }}</div>
        <div class="mt-1 text-xs text-ink-muted">内容大小：{{ pendingSize }}</div>
      </div>
      <div class="flex justify-end gap-2">
        <NButton size="small" @click="store.cancelPendingLoad()">取消</NButton>
        <NButton size="small" type="primary" @click="store.confirmPendingLoad()">
          覆盖载入
        </NButton>
      </div>
    </div>
  </NModal>
</template>
