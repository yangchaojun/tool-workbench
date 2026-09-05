import { CodeSlashOutline } from '@vicons/ionicons5'

import { defineTool } from '@/core/tools/types'

export const jsonViewerTool = defineTool({
  manifest: {
    id: 'json-viewer',
    name: 'JSON 查看器',
    description: '粘贴或上传 JSON：格式化/压缩、精确定位语法错误、高亮文本与可折叠树形浏览，一键复制下载。',
    accent: '#4f46e5',
  },
  icon: CodeSlashOutline,
  component: () => import('./views/JsonViewerView.vue'),
})
