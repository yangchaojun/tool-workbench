import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'

import App from './app/App.vue'
import { router } from './app/router'

import './app/styles/main.css'
// 副作用导入：把所有工具注册进注册表（路由与首页都从注册表读取）
import './tools'

createApp(App).use(createPinia()).use(router).use(naive).mount('#app')
