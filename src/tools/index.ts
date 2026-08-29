import { registerTool } from '@/core/tools/registry'

import { pomodoroTool } from './pomodoro/tool'

// ── 工具注册表：新增工具的唯一改动点 ─────────────────────────────
// 1. 在 src/tools/<id>/ 下按契约实现 tool.ts（见 core/tools/types.ts）
// 2. 在这里 import 并 registerTool —— 路由、导航、首页卡片自动获得

registerTool(pomodoroTool)
