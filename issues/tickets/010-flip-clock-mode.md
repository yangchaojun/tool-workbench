---
id: "010"
title: 番茄钟翻页时钟动画模式
labels: [wayfinder:task]
status: closed
assignee: zcode-agent
blocked-by: []
created: 2026-08-29
---

## Question

给番茄任务钟增加第二种时钟动画「翻页时钟」：CSS 3D 变换让数字像分页钟一样翻转，并在设置中加入模式选择以切换环形/翻页。经 grilling（两轮，用户逐轮确认「全按推荐」）定案：

- **生效范围**：全局——主视图与全屏专注层一致，设置一处切换两处呈现。
- **视觉形态**：整体替换环形进度环，呈现纯粹翻页卡形态；进度感由阶段 tab、状态标签、循环圆点承担。
- **翻转机制**：经典 split-flap（卡片分上下两半，上半片折下、下半片展开，带中缝），每位数字独立翻转（仅变化的位翻），保留 MM:SS，秒位每秒翻，动画约 440ms。
- **设置项**：抽屉加「时钟动画」NRadioGroup（环形时钟 / 翻页时钟），持久化 `clockStyle: 'ring' | 'flip'`，默认 `'ring'`（老用户零感知，schema 缺字段自动补默认）。
- **阶段色**：冒号分隔点与状态标签染阶段色（专注橙 / 休息青），卡片本体保持中性。
- **配色**：翻页卡跟随主题 token（亮 = 白卡墨字，暗 = 深卡浅字），全屏强制深色下自然获得经典质感。

## Resolution

已落地 `components/FlipClock.vue` + `components/FlipDigit.vue`，设置项「时钟动画」：

- **翻转机制**：FlipDigit 为 split-flap 单数字位——静态上半翻转开始即显新值（旧叶折下后露出）、静态下半整段保持旧值（新叶落到 0° 覆盖后再切换）；旧上叶 `rotateX 0→-90°`（220ms ease-in）、新下叶 `rotateX -90→0°`（220ms ease-out + 220ms delay, fill both），卡片容器供 600px perspective，中缝 1px 折痕恒在最上层；每位独立翻转，翻转途中数字再变（跳段/重置）用代币作废旧定时器重起新翻。
- **reduced-motion 陷阱**：全局规则只清零 animation-duration 不清 delay，下叶会停在不可见的 -90° 露出空白——组件内已显式清零 `animation-delay`。
- **接入**：`settings.clockStyle: 'ring' | 'flip'`（Zod 默认 `'ring'`，老数据缺字段自动补默认）；设置抽屉 NRadioGroup（环形时钟/翻页时钟）；PomodoroView 与 FullscreenOverlay 双处按模式分支，全屏层用 `large`（clamp+vmin 随视口缩放）。
- **视觉**：卡片/描边/折痕全走 token（`--color-card`/`--color-line`/`--color-ink`），上下半带极浅渐变模拟翻页景深；环形模式的阶段色信号收敛为冒号圆点 + 状态标签（专注橙/休息青）。
- **验证**：vue-tsc + build 零错误；浏览器实测——设置切换即时生效、连拍抓到叶折叠中间帧（透视前倾、方向为向前折下）、短休阶段色转青、暗色主题深卡浅字、全屏沉浸层 large 版正常、刷新后模式持久化、切回环形正常；a11y 上 FlipDigit 挂 `aria-hidden`，读屏走 timer 的 aria-label。环境限制：IAB 录屏产出空文件、evaluate 桥接不可用，动画验证以连拍截图为准。

### 动效三次调校（经用户指定参考 codepen wen-yan/ogjMmdr「Minimal Flip Clock」）

Cloudflare 拦截直连（WebFetch/curl 均被挡），经应用内浏览器过挑战后在 CodePen 编辑器面板逐屏读出完整源码。pen 的手法，已原样移植：

- **结构**：每数字位 = 前后两张整卡（front=旧值 / back=新值），数字由上下两个裁切半区拼成（上半按卡高行高取上部、下半贴底取下部），替代此前「静态整卡 + 单叶」。
- **连续翻叶**：前卡上半叶（origin 50% 100%）`rotateX 0→180°` 与后卡下半叶（origin 50% 0）`rotateX 180→0°` **同一条 0.6s ease-in-out 同时转**，`backface-visibility: hidden` 使 ±90° 以外自然隐形——两叶角速度在 90° 交接处连续，读起来是一整张叶扫过折痕（慢起-快甩-缓落），惯性完全来自共享曲线，无需分段延迟。此前的蓄力/拍合分段方案废弃。
- **层级**（同 pen）：落下的前上叶 z3 > 升起的后下叶 z2 > 静态的背卡上半与前卡下半 z1；中缝折痕 z4 恒在最上层。
- **透视**：pen 用 52rem 对 20vw 卡 ≈ 卡高 3.25 倍；移植为 `--flip-perspective: calc(var(--flip-h) * 3.25)`，随尺寸换算保持同等张力；perspective 写在每个 transform 内（动画期间恒定）。
- **观感**：保留本仓 token 与暗/亮主题（pen 的米白配色不引入）；补 pen 式卡片软阴影，字重 600→700。
- **状态机**：displayed/leaving/entering 三值 + go 类，600ms 动画 660ms 清理；翻转途中再变沿用代币作废机制。

逐帧连拍验证：静置 → 旧叶压向折痕、新值下半到位（连续扫叶中间态）→ 干净落定，无空白帧；`vue-tsc` + build 零错误。
