import { createRouter, createWebHistory } from 'vue-router'

import WorkbenchLayout from '@/app/layouts/WorkbenchLayout.vue'
import HomeView from '@/app/views/HomeView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: WorkbenchLayout,
      children: [
        { path: '', name: 'home', component: HomeView },
        {
          // 动态段 + ToolHost：新增工具无需改路由表
          path: 'tools/:toolId',
          name: 'tool',
          component: () => import('@/app/views/ToolHost.vue'),
          props: true,
        },
      ],
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/app/views/NotFoundView.vue') },
  ],
})
