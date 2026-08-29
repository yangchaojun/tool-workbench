<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NDrawer, NDrawerContent, NInputNumber, NSwitch, useMessage } from 'naive-ui'

import { usePomodoroStore } from '../stores/pomodoro'
import { requestNotifyPermission } from '../utils/notify'

const show = defineModel<boolean>('show', { default: false })

const store = usePomodoroStore()
const message = useMessage()

type NumberField =
  | 'focusMinutes'
  | 'shortBreakMinutes'
  | 'longBreakMinutes'
  | 'longBreakEvery'
  | 'dailyGoal'

function bindNumber(field: NumberField) {
  return (value: number | null) => {
    if (value !== null) store.settings[field] = value
  }
}

const notifyPending = ref(false)

async function onNotifyChange(value: boolean) {
  if (!value) {
    store.settings.notifyEnabled = false
    return
  }
  notifyPending.value = true
  const granted = await requestNotifyPermission()
  notifyPending.value = false
  if (granted) {
    store.settings.notifyEnabled = true
    return
  }
  message.warning('未能获得浏览器通知权限，可检查浏览器站点设置')
}

function restoreDefaults() {
  store.resetSettings()
  message.success('已恢复默认设置')
}
</script>

<template>
  <NDrawer v-model:show="show" placement="right" :width="360" :auto-focus="false">
    <NDrawerContent title="番茄钟设置" closable>
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between gap-4 py-2">
          <span class="text-sm">专注时长（分钟）</span>
          <NInputNumber
            size="small"
            class="w-28"
            :min="1"
            :max="120"
            :value="store.settings.focusMinutes"
            @update:value="bindNumber('focusMinutes')"
          />
        </div>
        <div class="flex items-center justify-between gap-4 py-2">
          <span class="text-sm">短休时长（分钟）</span>
          <NInputNumber
            size="small"
            class="w-28"
            :min="1"
            :max="30"
            :value="store.settings.shortBreakMinutes"
            @update:value="bindNumber('shortBreakMinutes')"
          />
        </div>
        <div class="flex items-center justify-between gap-4 py-2">
          <span class="text-sm">长休时长（分钟）</span>
          <NInputNumber
            size="small"
            class="w-28"
            :min="5"
            :max="60"
            :value="store.settings.longBreakMinutes"
            @update:value="bindNumber('longBreakMinutes')"
          />
        </div>
        <div class="flex items-center justify-between gap-4 py-2">
          <span class="text-sm">长休间隔（每几个番茄）</span>
          <NInputNumber
            size="small"
            class="w-28"
            :min="2"
            :max="10"
            :value="store.settings.longBreakEvery"
            @update:value="bindNumber('longBreakEvery')"
          />
        </div>
        <div class="flex items-center justify-between gap-4 py-2">
          <span class="text-sm">每日目标（个番茄）</span>
          <NInputNumber
            size="small"
            class="w-28"
            :min="1"
            :max="24"
            :value="store.settings.dailyGoal"
            @update:value="bindNumber('dailyGoal')"
          />
        </div>

        <div class="my-2 h-px bg-line/60" role="separator" />

        <div class="flex items-center justify-between gap-4 py-2">
          <span class="text-sm">自动开始下一段</span>
          <NSwitch v-model:value="store.settings.autoStartNext" size="small" />
        </div>
        <div class="flex items-center justify-between gap-4 py-2">
          <span class="text-sm">提示音</span>
          <NSwitch v-model:value="store.settings.soundEnabled" size="small" />
        </div>
        <div class="flex items-center justify-between gap-4 py-2">
          <span class="text-sm">浏览器通知</span>
          <NSwitch
            size="small"
            :value="store.settings.notifyEnabled"
            :loading="notifyPending"
            @update:value="onNotifyChange"
          />
        </div>
        <p class="py-1 text-xs leading-relaxed text-ink-muted/80">
          开启后，一段结束时会发送系统通知（需要授权）。
        </p>

        <div class="mt-6 flex items-center justify-between">
          <NButton size="small" quaternary @click="restoreDefaults">恢复默认</NButton>
          <span class="text-xs text-ink-muted/70">设置保存在本机浏览器</span>
        </div>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>
