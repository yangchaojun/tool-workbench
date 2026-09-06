<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NModal } from 'naive-ui'

import { useJsonEditorStore } from '../stores/jsonEditor'

/**
 * 修复预览 Modal：逐条展示修改点（位置 + 原文 + 修正后），
 * 用户确认后才写回文本并入撤销栈（见 CONTEXT.md「修复」：永不静默改写）。
 */

const store = useJsonEditorStore()

const candidate = computed(() => store.repairCandidate)

const groupedFixes = computed(() => {
  if (candidate.value === null) return []
  const counts = new Map<string, number>()
  for (const fix of candidate.value.fixes) {
    counts.set(fix.kind, (counts.get(fix.kind) ?? 0) + 1)
  }
  return [...counts.entries()].map(([kind, count]) => ({ kind, count }))
})

function apply() {
  if (candidate.value === null) return
  store.applyRepair(candidate.value.text)
}

function cancel() {
  store.repairCandidate = null
}
</script>

<template>
  <NModal
    :show="candidate !== null"
    preset="card"
    title="修复预览"
    class="w-[min(38rem,92vw)]"
    :mask-closable="true"
    @update:show="cancel"
  >
    <div class="flex flex-col gap-3 text-sm">
      <p class="text-muted-foreground">
        检测到
        <span class="font-medium text-foreground">{{ candidate?.fixes.length ?? 0 }}</span>
        处可自动修复的问题（<template v-for="(g, i) in groupedFixes" :key="g.kind">
          <span v-if="i > 0">、</span>{{ g.kind }} × {{ g.count }}</template>）。
        确认后应用以下修改。
      </p>

      <ul class="max-h-72 overflow-auto rounded bg-muted p-2 font-mono text-xs">
        <li v-for="(fix, i) in candidate?.fixes ?? []" :key="i" class="mb-2 last:mb-0">
          <div class="mb-0.5 text-muted-foreground">第 {{ fix.line }} 行 第 {{ fix.column }} 列 · {{ fix.kind }}</div>
          <div class="flex items-start gap-2">
            <span class="max-w-[45%] break-all rounded bg-destructive/10 px-1 py-0.5 text-destructive line-through">
              {{ fix.before === '' ? '（无）' : fix.before }}
            </span>
            <span class="text-muted-foreground">→</span>
            <span class="min-w-0 break-all rounded bg-accent/10 px-1 py-0.5 text-accent">
              {{ fix.after === '' ? '（删除）' : fix.after }}
            </span>
          </div>
        </li>
      </ul>

      <div class="flex justify-end gap-2">
        <NButton size="small" @click="cancel">取消</NButton>
        <NButton size="small" type="primary" @click="apply">应用修复</NButton>
      </div>
    </div>
  </NModal>
</template>
