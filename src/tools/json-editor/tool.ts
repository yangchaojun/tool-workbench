import { CodeSlashOutline } from '@vicons/ionicons5'

import { defineTool } from '@/core/tools/types'

export const jsonEditorTool = defineTool({
  manifest: {
    id: 'json-editor',
    name: 'JSON 编辑器',
    description:
      '粘贴或上传 JSON（也可从 URL 载入）：格式化/压缩、精确定位与容错修复、树形增删改与排序、查找替换、JSONPath/JMESPath 查询、双份数据 Diff 对比、转义与 Unicode 编解码、跨会话文档历史，全程可撤销重做。',
    accent: '#4f46e5',
  },
  icon: CodeSlashOutline,
  component: () => import('./views/JsonEditorView.vue'),
})
