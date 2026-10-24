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

// 全局无衬线字体栈（与 main.css --font-sans 保持一致，不加载 webfont；
// 等宽只用于代码/数据区，由组件上的 font-mono 类自行指定）
const FONT_STACK =
  "Geist, Inter, system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"

// 语义色两主题同值（DESIGN.md：link/success #0070f3、error #ee0000、warning #f5a623，
// 按压态取色板内的 link-deep / error-deep / warning-deep）
const semanticColors = {
  infoColor: '#0070f3',
  infoColorHover: '#0761d1',
  infoColorPressed: '#0761d1',
  infoColorSuppl: '#0070f3',
  successColor: '#0070f3',
  successColorHover: '#0761d1',
  successColorPressed: '#0761d1',
  successColorSuppl: '#0070f3',
  errorColor: '#ee0000',
  errorColorHover: '#c50000',
  errorColorPressed: '#c50000',
  errorColorSuppl: '#ee0000',
  warningColor: '#f5a623',
  warningColorHover: '#ab570a',
  warningColorPressed: '#ab570a',
  warningColorSuppl: '#f5a623',
}

// 主操作近黑实底（dark 下反转为近白），按钮文字色随主题翻转保证对比度；
// 表面/文本/边框对齐 DESIGN.md 浅色色板与 Vercel dark 极性翻转值
const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    fontFamily: FONT_STACK,
    borderRadius: '6px', // --geist-radius：应用内控件基准圆角
    ...semanticColors,
    ...(theme.dark
      ? {
          bodyColor: '#000000',
          cardColor: '#0a0a0a',
          modalColor: '#0a0a0a',
          popoverColor: '#0a0a0a',
          borderColor: '#262626',
          dividerColor: '#262626',
          textColorBase: '#ededed',
          textColor1: '#ededed',
          textColor2: '#ededed',
          textColor3: '#a1a1a1',
          placeholderColor: '#888888',
          primaryColor: '#fafafa',
          primaryColorHover: '#ffffff',
          primaryColorPressed: '#ebebeb',
          primaryColorSuppl: '#fafafa',
        }
      : {
          bodyColor: '#fafafa',
          cardColor: '#ffffff',
          modalColor: '#ffffff',
          popoverColor: '#ffffff',
          borderColor: '#ebebeb',
          dividerColor: '#ebebeb',
          textColorBase: '#171717',
          textColor1: '#171717',
          textColor2: '#4d4d4d',
          textColor3: '#888888',
          placeholderColor: '#888888',
          primaryColor: '#171717',
          primaryColorHover: '#000000',
          primaryColorPressed: '#4d4d4d',
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
        textColorPrimary: '#ffffff',
        textColorHoverPrimary: '#ffffff',
        textColorPressedPrimary: '#ffffff',
        textColorFocusPrimary: '#ffffff',
      },
  Card: { borderRadius: '12px' },
  // 弹层走 DESIGN.md Level 5 模态堆叠阴影
  Popover: { boxShadow: 'var(--shadow-modal)' },
  Modal: { boxShadow: 'var(--shadow-modal)' },
  Drawer: { boxShadow: 'var(--shadow-modal)' },
  // 输入框接 input token（form-input：canvas 底 + hairline 边）；
  // 焦点边框用 link 蓝，去掉默认的 2px 外发光
  Input: {
    color: 'var(--color-input-bg)',
    border: '1px solid var(--color-input-border)',
    borderHover: '1px solid var(--color-border-hover)',
    borderFocus: '1px solid var(--color-accent)',
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
