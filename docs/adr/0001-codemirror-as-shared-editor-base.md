# 采用 CodeMirror 6 作为共享编辑器底座

JSON 查看器需要语法高亮、行号与行内错误标记，手写 tokenizer 的隐藏成本（行号对齐、错误下划线、大文本性能）远超收益。我们决定引入 CodeMirror 6（含 `@codemirror/lang-json`）并以**窄契约**封装为 `src/shared/components/CodeEditor`（props 仅 `modelValue`/`readonly`/`language`/`errorMark`，即 v-model 四能力），供未来文本类工具复用。这使仓库从零编辑器依赖变为有编辑器依赖，是本仓库第一处重量级共享组件，故立档。

## Considered Options

- 纯手写高亮（零依赖）：与仓库薄平台气质一致，但核心体验（错误定位 + 高亮）需长期自行维护，放弃。
- Monaco：体积与复杂度对这个规模的项目过重，放弃。

## Consequences

- JSON 特有智能（校验、错误定位桥接）留在 `src/tools/json-viewer/`，共享层只放通用编辑能力；`kit.ts` 中的语法高亮风格是纯视觉呈现（当前只带 JSON 的标签配色），第二个语言出现时须把高亮风格参数化或下放到工具侧。
- 后续工具接入编辑器时若窄契约不够用，优先扩展契约而非绕过它。
