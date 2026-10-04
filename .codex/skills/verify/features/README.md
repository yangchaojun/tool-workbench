# ToolWorkbench 验证地图

本目录是 ToolWorkbench 用户可见行为的验证来源。启动前先读本索引，再按对应 feature 文件操作。SKILL.md 定义了启动/驱动/留证/清理的通用做法，这里不重复。

## Baseline preconditions

- `npm run build` 后以 PTY 方式启动 `npm run preview -- --port 4173 --strictPort`（见 SKILL.md「Launch」；后台启动的 server 20 秒后会死）。
- `http://localhost:4173` 返回 200；`dist/index.html` 比源码新。
- agent-browser 用独立 session + 系统 Chrome（SKILL.md「Drive」）。
- 干净起点：验证 run 开始时不需要预置数据，工具内自带入口可从零造状态（加任务、粘 JSON）。若上一次 run 留了数据，可直接利用（省重复操作），但断言要基于当次实际读到的值。
- 只驱动本会话启动的 server。

## Driving conventions

- 优先可访问名、ARIA label、`href` 路由和 snapshot `@ref`；禁止裸 `has-text`（首页卡片墙与侧边栏有同名链接）。
- 每条命令带 `--session tw-verify`。
- 编辑器本体、抽屉、弹层内的控件先 `snapshot -i -c` 拿 `@ref`，因为不少控件无可访问名。
- 改动代码后必须重新 build，preview 不会热更新。

## Proof and skip reporting

- 同一条功能要同时留下「动作证据」和「结果状态证据」（SKILL.md「Evidence」）。
- 持久化断言以 reload 后重读 localStorage 为准。
- 某个入口走不通时，记录尝试过的命令和被卡住的前置条件；不要用另一条路径的结果冒充该入口已验证。

## Features

- [Pomodoro timer](./pomodoro.md)：计时推进/暂停/重置、模式切换、任务增删与持久化、设置抽屉、暗色主题。
- [JSON editor](./json-editor.md)：粘贴自动校验、格式化/压缩、树形编辑、查找/查询、撤销重做、持久化。
