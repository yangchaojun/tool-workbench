<script setup lang="ts">
import { computed, watch } from 'vue'
import { darkTheme, dateZhCN, zhCN } from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'

import { useThemeStore } from '@/app/stores/theme'

const theme = useThemeStore()

watch(
  () => theme.dark,
  (dark) => {
    document.documentElement.classList.toggle('dark', dark)
  },
  { immediate: true },
)

const FONT_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif"

const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    fontFamily: FONT_STACK,
    borderRadius: '10px',
    ...(theme.dark
      ? {
          primaryColor: '#2dd4bf',
          primaryColorHover: '#5eead4',
          primaryColorPressed: '#14b8a6',
          primaryColorSuppl: '#2dd4bf',
        }
      : {
          primaryColor: '#0d9488',
          primaryColorHover: '#0f766e',
          primaryColorPressed: '#115e59',
          primaryColorSuppl: '#0f766e',
        }),
  },
}))
</script>

<template>
  <NConfigProvider
    class="h-full"
    :theme="theme.dark ? darkTheme : null"
    :theme-overrides="themeOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <NMessageProvider>
      <RouterView />
    </NMessageProvider>
  </NConfigProvider>
</template>
