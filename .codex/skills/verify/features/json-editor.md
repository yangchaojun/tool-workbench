# JSON editor

JSON 编辑器让用户粘贴或上传 JSON 后自动校验，做格式化/压缩、树形增删改、查找替换、查询提取、Diff 对比，全程可撤销重做，数据默认不出浏览器。

## Sub-features

- `json-paste-validate` pastes JSON and the status line reports valid or locates the syntax error.
- `json-format` applies 格式化 / 压缩 to the input.
- `json-tree` edits data through the tree pane (add child, edit value, delete).
- `json-undo` reverts a transform or edit and 重做 re-applies it.
- `json-persist` keeps the input across reload via `tw:json-editor:input`.
- `json-find-query` drives the find/replace bar and the JSONPath query box.
- `json-diff` compares two documents in 对比 mode.

## How to get to it (user POV)

- Click JSON 编辑器 in the sidebar (`nav a[href="/tools/json-editor"]`).
- Click the JSON 编辑器 card on the home page.
- Navigate directly to `/tools/json-editor`.

## Driving it with agent-browser

Preconditions:

- Preview server is healthy at `http://localhost:4173` (SKILL.md Doctor).
- Browser session `tw-verify` is open with viewport width ≥1024px (wide layout shows 编辑 + 树形 panes side by side).
- The editor body textbox has no accessible name; snapshot first and act by `@ref`.

- **Open the tool.** Run `agent-browser --session tw-verify click 'nav a[href="/tools/json-editor"]'`. `get title` returns `JSON 编辑器 · 工具台`.
- **Paste valid JSON.** Snapshot, click the editor `@ref`, then `agent-browser --session tw-verify keyboard type '{"name":"tw","n":1}'`. The status line shows `✓ 合法 JSON` (`eval "document.body.innerText.includes('✓ 合法 JSON')"` is `true`).
- **Paste broken JSON.** With a fresh editor, type `{"a":`. The status line reports `✗` with a line/column position instead of 合法 JSON.
- **Format.** Click the toolbar 格式化 button (toolbar one, not the 编辑 segment tab). The editor text becomes multi-line pretty-printed and the status line stays `✓ 合法 JSON`.
- **Compress.** Click 压缩. The editor text collapses to one line.
- **Tree edit.** In the tree pane use 添加子项 / 编辑 / 删除 buttons reached via snapshot refs; after each action the text pane reflects the change and the status line stays valid.
- **Undo.** Run `agent-browser --session tw-verify find text "撤销" click`. The previous text/state returns (status line no longer shows the old verdict); run `agent-browser --session tw-verify find text "重做" click` to re-apply. Toggle twice to prove the history stack works both ways.
- **Persistence.** Run `agent-browser --session tw-verify reload`, then `agent-browser --session tw-verify eval "localStorage.getItem('tw:json-editor:input')"`. The key holds the last input and the status line returns to its previous verdict.
- **Find / query.** Click 查找替换（⌘F）and fill 查找 key / 字符串值; fill the `$.store.book[*].title`-labeled query box and click 查询. Results appear in the tree/query pane.
- **Diff.** Click the 对比 segment, paste/enter two documents as prompted, and confirm the diff tree renders additions/removals.
- **Proof.** Screenshot each state into `/tmp/tw-verify-run/` (e.g. `json-valid.png`, `json-broken.png`), with the innerText/localStorage eval output captured alongside.

## Gotchas

- `button:has-text("格式化")` matches both the toolbar button and the 编辑/对比 segment tab. Use the toolbar ref from a snapshot, or scope the selector.
- The editor textbox has no accessible name; without a snapshot `@ref` you cannot focus it to type.
- Use `keyboard type` after focusing the editor; `fill` on a CodeMirror-backed control is not the reliable path.
- Validation is debounced: after typing, wait for the status line to change before asserting.
- Inputs over 1MB pause automatic validation (the status line explains it). Keep test payloads small or you will assert against a paused validator.
- The URL-fetch feature (历史 panel) is the only network path in the app. Do not use it in generic runs; if you must test it, use a local HTTP server and say so in the evidence.
- Tree pane controls only exist after a successful parse; with invalid JSON the tree pane is empty.
