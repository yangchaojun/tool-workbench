# Pomodoro timer

番茄任务钟提供 25:00 专注倒计时、三段模式循环、任务列表与设置持久化，全部数据在本机浏览器。

## Sub-features

- `pomodoro-countdown` starts the focus timer and the countdown advances, with `document.title` mirroring the remaining time.
- `pomodoro-pause-reset` pauses and resumes the run; reset and skip are only enabled while a session is active.
- `pomodoro-phases` switches between 专注 / 短休 / 长休 tabs while idle.
- `pomodoro-tasks` adds a task, persists it, and keeps the estimate fields.
- `pomodoro-settings` opens the settings drawer, persists changes, and restores defaults.
- `pomodoro-theme` toggles dark mode app-wide and persists it.

## How to get to it (user POV)

- Click 番茄任务钟 in the sidebar (`nav a[href="/tools/pomodoro"]`).
- Click the 番茄任务钟 card on the home page.
- Navigate directly to `/tools/pomodoro`.

## Driving it with agent-browser

Preconditions:

- Preview server is healthy at `http://localhost:4173` (SKILL.md Doctor).
- Browser session `tw-verify` is open on the home page.

- **Open the tool.** Run `agent-browser --session tw-verify click 'nav a[href="/tools/pomodoro"]'`. `get title` returns `番茄任务钟 · 工具台`.
- **Countdown.** Run `agent-browser --session tw-verify snapshot -i -c -s "main"` and click the `开始专注` button `@ref`, wait 3 seconds, then `agent-browser --session tw-verify eval "document.title"`. Title matches `2\d:\d\d · 专注 · 工具台` (allow ±2s drift against the flip clock).
- **Pause.** Re-snapshot and click the same button (it now reads `暂停`). It flips to `继续`; `document.title` freezes.
- **Reset.** Snapshot and click the `重置` `@ref`. The clock returns to `25:00`, title no longer contains a countdown, and 跳过/重置 become disabled.
- **Phases.** Run `agent-browser --session tw-verify click 'button[role="tab"]:has-text("短休")'`. The main button reads `开始短休` and the clock shows `05:00`.
- **Add a task.** Snapshot the main region, `agent-browser --session tw-verify fill @ref "写周报"` on the 添加一个任务，回车确认 textbox, then click the 添加任务 `@ref`. The task appears in the list and `agent-browser --session tw-verify eval "localStorage.getItem('tw:pomodoro:tasks')"` contains `"title":"写周报"`.
- **Task persistence.** Run `agent-browser --session tw-verify reload`, then re-read the same key. The task is still there.
- **Settings.** Run `agent-browser --session tw-verify click '[aria-label="打开设置"]'`. The 番茄钟设置 drawer opens with 专注时长（分钟） fields. Snapshot the drawer (`agent-browser --session tw-verify snapshot -i -c -s ".n-drawer"`; its textboxes have generic 请输入 labels, so act by `@ref`), fill 专注时长 with e.g. `35`, then close via `agent-browser --session tw-verify click '.n-drawer .n-base-close'`. `localStorage.getItem('tw:pomodoro:settings')` contains `"focusMinutes":35`, and the value survives reload.
- **Theme.** Run `agent-browser --session tw-verify click 'button:has-text("深色模式")'`. `document.documentElement.classList.contains('dark')` is `true`, `localStorage.getItem('tw:theme')` is `{"dark":true}`, and after reload the button reads `浅色模式`.
- **Proof.** Screenshot before and after each mutation into `/tmp/tw-verify-run/` (e.g. `pomodoro-running.png`, `pomodoro-task.png`), with the eval output captured alongside.

## Gotchas

- The main button label depends on state: `开始专注`/`开始短休`/`开始长休` → `暂停` → `继续`. Assert on the current label, not a fixed one.
- Phase tabs are disabled while the timer is running or paused; reset first when you need to switch phases.
- Reset/skip are disabled in idle state; `is enabled` assertions depend on a started session.
- The countdown is timestamp-based; never assert an exact second, allow ±2s or assert via `document.title` pattern.
- Focus-mode fullscreen is a browser-native overlay; avoid entering it during verification unless that is the feature under test.
- The settings drawer overlay blocks clicks on the sidebar/theme button. Close the drawer (`.n-drawer .n-base-close`) before driving anything else.
- Drawer field refs come from a drawer-scoped snapshot, not the main-page snapshot.
- Adding a task via the Enter key cannot be exercised reliably through synthetic browser input (key event dispatch limitation, recorded in issues/tickets/008); use the 添加任务 button path.
