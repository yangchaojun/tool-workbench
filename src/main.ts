import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  NButton,
  NCheckbox,
  NConfigProvider,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NIcon,
  NInput,
  NInputNumber,
  NMessageProvider,
  NRadioButton,
  NRadioGroup,
  NSwitch,
} from 'naive-ui'

import App from './app/App.vue'
import { router } from './app/router'

import './app/styles/main.css'
// 副作用导入：把所有工具注册进注册表（路由与首页都从注册表读取）
import './tools'

// 仅注册用到的 naive-ui 组件（替代全量 app.use(naive)，让打包器摇掉其余组件）
const naiveComponents = {
  NButton,
  NCheckbox,
  NConfigProvider,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NIcon,
  NInput,
  NInputNumber,
  NMessageProvider,
  NRadioButton,
  NRadioGroup,
  NSwitch,
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
for (const [name, component] of Object.entries(naiveComponents)) {
  app.component(name, component)
}
app.mount('#app')
