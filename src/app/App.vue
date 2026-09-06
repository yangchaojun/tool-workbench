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

// 全局等宽字体栈（与 main.css --font-mono 保持一致，不加载 webfont）
const FONT_STACK =
  "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, 'Liberation Mono', 'PingFang SC', 'Microsoft YaHei', monospace"

// 主操作近黑实底（dark 下反转为近白），按钮文字色随主题翻转保证对比度
const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    fontFamily: FONT_STACK,
    borderRadius: '8px',
    ...(theme.dark
      ? {
          primaryColor: '#fafafa',
          primaryColorHover: '#ffffff',
          primaryColorPressed: '#d4d4d4',
          primaryColorSuppl: '#fafafa',
        }
      : {
          primaryColor: '#171717',
          primaryColorHover: '#000000',
          primaryColorPressed: '#404040',
          primaryColorSuppl: '#171717',
        }),
  },
  Button: theme.dark
    ? {
        textColorPrimary: '#171717',
        textColorHoverPrimary: '#171717',
        textColorPressedPrimary: '#171717',
        textColorFocusPrimary: '#171717',
      }
    : {
        textColorPrimary: '#fafafa',
        textColorHoverPrimary: '#fafafa',
        textColorPressedPrimary: '#fafafa',
        textColorFocusPrimary: '#fafafa',
      },
  Card: { borderRadius: '10px' },
  // 层级用 1px 边框表达，弹层一律无阴影
  Popover: { boxShadow: 'none' },
  Modal: { boxShadow: 'none' },
  Drawer: { boxShadow: 'none' },
  // 输入框接 input token；焦点用边框色表达，去掉默认的 2px 外发光
  Input: {
    color: 'var(--color-input-bg)',
    border: '1px solid var(--color-input-border)',
    borderHover: '1px solid var(--color-border-hover)',
    borderFocus: '1px solid var(--color-primary)',
    boxShadowFocus: 'none',
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
