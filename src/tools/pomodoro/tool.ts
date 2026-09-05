import { TimerOutline } from '@vicons/ionicons5'

import { defineTool } from '@/core/tools/types'

export const pomodoroTool = defineTool({
  manifest: {
    id: 'pomodoro',
    name: '番茄任务钟',
    description: '专注、短休、长休三段循环，任务绑定番茄数，今日进度一目了然。',
    accent: '#ea580c',
  },
  icon: TimerOutline,
  component: () => import('./views/PomodoroView.vue'),
})
