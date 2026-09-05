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

### JSON 查看器

**输入（Input）**:
用户粘贴或上传进查看器的原始 JSON 文本。工具只读输入，从不修改它。
_Avoid_: 源文本、payload

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
带语法高亮与行号的 JSON 文本呈现，与编辑行为共存于同一区域。
_Avoid_: 代码框、editor 面板

**树形视图（Tree View）**:
按数据结构折叠展开的 JSON 呈现；默认展开前 2 层，节点悬停显示类型与长度。
_Avoid_: 大纲、outline

**软上限（Soft Cap）**:
超出即警告但不阻止继续使用的规模阈值（输入 1MB、上传 5MB、持久化 256KB）。
_Avoid_: 大小限制、max size
