<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NCheckbox, NEmpty, NIcon, NInput } from 'naive-ui'
import { Add, TrashOutline } from '@vicons/ionicons5'

import { usePomodoroStore } from '../stores/pomodoro'

const store = usePomodoroStore()
const draft = ref('')

function submit() {
  store.addTask(draft.value)
  draft.value = ''
}

/** 显式回车提交（NInput 不透传 fallthrough 事件，须经 input-props 绑到内层 input）；输入法组词中的回车不提交 */
function onInputKeydown(e: KeyboardEvent) {
  if (e.isComposing) return
  if (e.key === 'Enter') submit()
}

const inputProps = { onKeydown: onInputKeydown }
</script>

<template>
  <section class="rounded-card border border-line/60 bg-card p-5 shadow-card">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-[15px] font-medium">任务</h2>
      <span class="text-xs text-ink-muted">
        {{ store.tasks.filter((t) => !t.done).length }} 个待完成
      </span>
    </div>

    <form class="flex gap-2" @submit.prevent="submit">
      <NInput
        v-model:value="draft"
        size="small"
        placeholder="添加一个任务，回车确认"
        maxlength="60"
        :input-props="inputProps"
      />
      <NButton
        attr-type="submit"
        size="small"
        type="primary"
        secondary
        aria-label="添加任务"
        :disabled="!draft.trim()"
      >
        <template #icon>
          <NIcon :size="16"><Add /></NIcon>
        </template>
      </NButton>
    </form>

    <NEmpty
      v-if="store.tasks.length === 0"
      size="small"
      description="还没有任务，添加一个开始专注吧"
      class="py-8"
    />

    <ul v-else class="mt-3 flex flex-col gap-0.5">
      <li
        v-for="task in store.tasks"
        :key="task.id"
        class="group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors duration-200"
        :class="
          task.id === store.runtime.activeTaskId
            ? 'bg-accent-soft/60 ring-1 ring-accent/40'
            : 'hover:bg-primary-soft/40'
        "
      >
        <NCheckbox
          size="small"
          :checked="task.done"
          @update:checked="store.toggleTaskDone(task.id)"
        />
        <button
          type="button"
          class="min-w-0 flex-1 cursor-pointer text-left"
          :title="task.done ? '' : '设为当前专注任务'"
          @click="store.setActiveTask(task.id)"
        >
          <span
            class="block truncate text-sm"
            :class="task.done ? 'text-ink-muted line-through' : ''"
          >
            {{ task.title }}
          </span>
        </button>
        <div class="flex shrink-0 items-center text-xs text-ink-muted">
          <button
            type="button"
            aria-label="减少预估番茄数"
            class="cursor-pointer rounded px-1 leading-none transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="task.estimatedPomodoros <= 1"
            @click="store.changeEstimate(task.id, -1)"
          >
            −
          </button>
          <span
            class="w-9 text-center tabular-nums"
            :class="task.completedPomodoros >= task.estimatedPomodoros && !task.done ? 'text-accent' : ''"
          >
            {{ task.completedPomodoros }}/{{ task.estimatedPomodoros }}
          </span>
          <button
            type="button"
            aria-label="增加预估番茄数"
            class="cursor-pointer rounded px-1 leading-none transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="task.estimatedPomodoros >= 20"
            @click="store.changeEstimate(task.id, 1)"
          >
            ＋
          </button>
        </div>
        <NButton
          quaternary
          circle
          size="tiny"
          class="opacity-0 transition-opacity group-hover:opacity-100"
          :aria-label="`删除任务 ${task.title}`"
          @click="store.removeTask(task.id)"
        >
          <template #icon>
            <NIcon :size="14"><TrashOutline /></NIcon>
          </template>
        </NButton>
      </li>
    </ul>

    <p v-if="store.tasks.some((t) => !t.done)" class="mt-3 text-xs text-ink-muted/80">
      点击任务设为当前专注对象，完成的番茄会自动计入。
    </p>
  </section>
</template>
