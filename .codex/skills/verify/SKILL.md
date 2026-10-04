---
name: verify
description: 驱动 ToolWorkbench（本地 Web 应用）做端到端验证：启动 preview server，用 agent-browser 走真实用户路径（番茄钟计时/任务、JSON 编辑器粘贴/格式化/树形编辑），截图与 localStorage 留证。当需要证明某个 UI 改动真的能用、复现用户报告的问题、或跑 features/ 里的走查清单时使用。
---

# ToolWorkbench 验证手册

ToolWorkbench 是纯前端本地 Web 应用（Vue 3 + Vite），数据全部存浏览器 localStorage，无服务端。本手册让 agent 用真实浏览器走用户路径并留下证据。验证步骤清单见 [features/README.md](./features/README.md)。

## Launch

验证用的是 `vite preview`（构建产物，见下「坑」第 1 条），不是 `npm run dev`：

```bash
npm run build    # 先构建；preview 不热更新，改代码后必须重新构建
npm run preview -- --port 4173 --strictPort
```

server 必须以 PTY 会话启动并保持前台（Codex 里用 `tty: true` 的 exec 会话，或用户自己的终端 tmux 窗口）。**不要用 `nohup`/后台方式启动**：这台机器上后台化的 vite 进程约 20 秒后被回收（登录 hook 疑似回收孤儿进程，见「坑」第 1 条）。

就绪判定：`curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/` 返回 200（预期 3 秒内）。server 监听 IPv6 `[::1]`，`localhost` 可解析所以 curl 用 localhost 即可；如果 `127.0.0.1` 连接被拒而 `[::1]` 正常，这是本机行为不是故障。

端口被占说明已有实例在跑：先按 Doctor 检查它是否本会话启动的（进程 tty 是否是本会话），不确定就换端口 `--port 4174`，不要复用来历不明的实例。

## Doctor

任何异常（页面打不开、行为不对）先做这三条只读检查：

```bash
lsof -nP -iTCP:4173 -sTCP:LISTEN        # 端口有 LISTEN，进程名含 node/vite
curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/   # 200
ls dist/index.html                      # 存在；比 src 最新修改旧就先重新 build
```

全部通过再继续；`dist` 过期是最常见的「改动没生效」原因。

## Drive

用 `agent-browser`（全局 npm 包，已在 PATH）驱动 Google Chrome。两条铁律：

- **必须隔离**：所有命令带 `--session <名字>` 且首条命令带 `--executable-path` 指向系统 Chrome（Playwright 自带浏览器未安装，省略会报 Executable doesn't exist）。
- **selector 优先用稳定句柄**：侧边栏链接用 `nav a[href="/tools/pomodoro"]`、`nav a[href="/tools/json-editor"]`（裸 `a[href=...]` 在首页会同时匹配侧边栏和卡片墙），ARIA label（`[aria-label="打开设置"]`、`[aria-label="计时模式"]`），或 snapshot 里的 `@ref`。`has-text` 会撞到多处同名文本（如「开始专注」也出现在空任务提示里），别裸用。

首次连接（先 `agent-browser close` 确保无残留 daemon）：

```bash
agent-browser --session tw-verify --executable-path "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" open "http://localhost:4173/"
agent-browser --session tw-verify snapshot -i -c   # 拿 @ref 后续操作
```

之后所有命令 `agent-browser --session tw-verify <cmd>`。快捷链：

```bash
# 暗色切换（按钮文案随状态翻转：深色模式/浅色模式）
agent-browser --session tw-verify click 'button:has-text("深色模式")'
agent-browser --session tw-verify eval "localStorage.getItem('tw:theme')"

# 番茄钟：开始 → 倒计时推进 → 标题同步
agent-browser --session tw-verify click 'nav a[href="/tools/pomodoro"]'
agent-browser --session tw-verify snapshot -i -c -s "main"   # 拿按钮 ref（开始专注 ≈ @e6，随 DOM 变化，以当次 snapshot 为准）
agent-browser --session tw-verify click @e6
agent-browser --session tw-verify eval "document.title"     # "24:5x · 专注 · 工具台"

# JSON 编辑器：粘贴合法 JSON → 状态栏 → 格式化
agent-browser --session tw-verify click 'nav a[href="/tools/json-editor"]'
agent-browser --session tw-verify snapshot -i -c            # 编辑器本体 textbox 无可访问名，用 @ref
agent-browser --session tw-verify click @e19 && agent-browser --session tw-verify keyboard type '{"n":1}'
agent-browser --session tw-verify eval "document.body.innerText.includes('✓ 合法 JSON')"
```

localStorage keys（用 `agent-browser --session tw-verify storage local get <key>` 或 `eval` 读，验证持久化时 reload 后重读）：`tw:theme`、`tw:pomodoro:settings`、`tw:pomodoro:tasks`、`tw:pomodoro:sessions`、`tw:pomodoro:runtime`、`tw:json-editor:input`。

## Evidence

每次验证在 `/tmp/tw-verify-run/`（每次运行可加子目录）留证，产物必须活过 Cleanup：

1. **动作截图**：关键操作前后各一张 `agent-browser --session tw-verify screenshot /tmp/tw-verify-run/<步骤>.png`，窗口里要能看出当前页面与状态。
2. **状态断言**：用 `eval` 输出可复制的事实（`document.title`、`localStorage.getItem(...)`、`document.body.innerText.includes('...')`），不要只凭截图下结论。
3. **副作用第二视角**：改数据的操作（加任务、编辑 JSON、切主题）除了看 UI，还要读对应 localStorage key；重启路径用 reload 后重读来证明跨刷新持久化。
4. 只走真实用户路径：真实点击/输入，不调 store 内部方法、不用 console 直接改状态。唯一的网络功能是 JSON 编辑器「历史」面板的 URL 拉取，验证其他功能时不应有任何网络请求。

证明标准：一条功能要同时有「操作发生的证据」和「结果状态的证据」（两者可以合并成同一张截图 + eval 输出）。eval 断言失败但截图看着正常时，以断言为准去排查。

## Cleanup

只清理本会话启动的东西，证据目录不动：

```bash
agent-browser --session tw-verify close      # 杀掉本会话浏览器（session list 里的条目是空壳，消失与否不用管）
# server：直接 Ctrl-C 结束启动它的 PTY exec 会话（write_stdin 发 Ctrl-C）。
# 永远不要按进程名 pkill/killall vite。
```

清理后核对：`lsof -nP -iTCP:4173 -sTCP:LISTEN` 无输出、`ls /tmp/tw-verify-run/` 截图仍在。每次失败的验证迭代结束后也要跑同样清理，再重试。

## Helpers

无可执行 helper 脚本；上面 Drive/Cleanup 里的命令块就是全部工具链，原样复制执行即可。

## 坑

1. **后台启动的 server 20 秒后死**（macOS 登录 hook 回收孤儿进程）：`nohup ... &` 启动的 `vite preview` 能监听、能返回 200，然后约 20 秒后整组进程消失。必须前台 PTY 启动。诊断特征：`lsof` 显示 LISTEN 但 curl 拒绝连接、`pgrep -fl vite` 为空、日志只有正常的 `➜ Local:` 行。
2. **`--executable-path` 只在首条命令生效**：daemon 已在跑时该 flag 被忽略。换 executable 或换 session 前先 `agent-browser close`。
3. **`agent-browser session list` 残留已关闭的 session 名**：用 `AGENT_BROWSER_SESSION=<名> agent-browser close` 返回 `✓ Browser closed` 为准，别被列表误导成「还有实例在跑」。
4. **预置 localStorage 不用于本仓库**：主题/任务/文档都有真实 UI 入口，直接走 UI；不要 eval 写 localStorage 造状态（造坏数据反而测不出 Zod 回落路径）。
5. **JSON 编辑器响应式断点**：视口 ≥1024px 是编辑/树形并排，<1024px 收成 Tab。跨断点验证前用 `agent-browser --session tw-verify set viewport <w> <h>` 调视口，否则找不到对应控件。
6. **倒计时校正**：计时基于时间戳（endsAt），断言倒计时数字时允许 ±2 秒误差；`document.title` 同步是比读 DOM 数字更稳的断言点。
