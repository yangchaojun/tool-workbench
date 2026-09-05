# ToolWorkbench

一个纯前端、本地优先的工具集合。每个工具自包含于 `src/tools/<id>/`，通过注册表接入导航与路由；所有数据只留在浏览器内（`tw:` 前缀的 localStorage），不发起任何网络请求。

## Language

### 工具平台

**工具（Tool）**:
以 `id`（小写 kebab-case）为唯一标识的自包含功能单元，同时决定其路由段与 localStorage 命名空间。
_Avoid_: 插件、模块、App

**注册表（Registry）**:
工具的唯一接入点；工具经它出现在首页卡片墙与侧边导航。
_Avoid_: 工具列表、manifest 文件

### JSON 编辑器

**输入（Input）**:
用户粘贴或上传进编辑器的 JSON 文本。校验合法后转化为数据源；修复等处理动作可在用户确认后改写它。
_Avoid_: 源文本、payload

**数据源（Data）**:
输入解析成功后的 JSON 数据。树形编辑、查询、对比都直接作用于它；文本视图是它的文本呈现。
_Avoid_: model、内部状态

**格式化（Format）**:
以 2 空格缩进重排 JSON 文本，语义与输入完全等价。
_Avoid_: 美化、pretty print、beautify

**压缩（Minify）**:
去除全部可省略空白后的 JSON 文本，语义与输入完全等价；不是 gzip 之类的传输压缩。
_Avoid_: 精简、uglify

**校验（Validate）**:
判断输入是否为合法 JSON 并给出结论；失败时伴随一次错误定位。
_Avoid_: lint、检查

**错误定位（Error Location）**:
校验失败时给出的精确 行:列 与人类可读的错误原因，跨浏览器引擎一致。
_Avoid_: 报错信息、exception

**文本视图（Text View）**:
带语法高亮与行号的 JSON 文本编辑区；是数据源的文本投影，也是查找替换与处理类动作的作用对象。
_Avoid_: 代码框、editor 面板

**树形视图（Tree View）**:
按数据结构折叠展开、可直接增删改节点与排序的编辑界面；默认展开前 2 层，展开状态跟随节点路径保留。
_Avoid_: 大纲、outline

**统一历史栈（History）**:
覆盖文本编辑与树形编辑的单一撤销/重做序列，仅存在于当前会话，不持久化。
_Avoid_: 多套栈、undo list

**查找定位（Find）**:
在树形视图中按 key 或字符串值匹配节点并逐个定位高亮。
_Avoid_: 全局搜索、search 面板

**替换（Replace）**:
仅在文本视图中进行的文本查找替换。
_Avoid_: 树形替换

**查询（Query）**:
以 JSONPath 或 JMESPath 表达式从数据源提取结果。
_Avoid_: 过滤、filter

**对比（Diff）**:
结构化呈现两份 JSON 的差异；数组按索引严格对齐、顺序敏感。
_Avoid_: 比较、compare

**修复（Repair）**:
对常见非法 JSON 书写错误给出候选修正，经用户确认后应用；永不静默改写。
_Avoid_: 自动纠错、autofix

**转义（Escape）**:
把整段 JSON 文本编码为一个 JSON 字符串字面量。
_Avoid_: 编码、encode

**反转义（Unescape）**:
把 JSON 字符串字面量还原为内层文本。
_Avoid_: 解码、decode

**Unicode 编解码（Unicode Codec）**:
`\uXXXX` 转义序列与原生字符的互转；不含 Base64、percent-encoding。
_Avoid_: 字符集转换

**软上限（Soft Cap）**:
超出即警告但不阻止继续使用的规模阈值（输入 1MB、上传 5MB、持久化 256KB）。
_Avoid_: 大小限制、max size
