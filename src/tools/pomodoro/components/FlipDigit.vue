<script setup lang="ts">
import { ref, watch } from 'vue'

// 参考 codepen wen-yan/ogjMmdr 的连续翻叶：前卡（旧值）上半叶与后卡（新值）
// 下半叶在同一条 ease-in-out 里镜像旋转（0→180 / 180→0），角速度在 90° 交接处
// 连续，视觉上是一整张叶扫过折痕——慢起、快甩、缓落，惯性来自曲线本身。
const props = defineProps<{ digit: string; large?: boolean }>()

const displayed = ref(props.digit) // 落定值（静置时前卡显示它）
const leaving = ref(props.digit) // 翻转中的旧值（前卡）
const entering = ref(props.digit) // 翻转中的新值（后卡）
const flipping = ref(false)

// 翻转途中数字再变（跳段/重置）时作废旧定时器、重起新翻
let flipToken = 0
let cleanupTimer: number | undefined

watch(
  () => props.digit,
  (next) => {
    if (next === displayed.value) return
    leaving.value = displayed.value
    entering.value = next
    window.clearTimeout(cleanupTimer)
    const token = ++flipToken
    flipping.value = false
    // 下一帧再置 true，确保连续变化时两叶动画从头播放
    requestAnimationFrame(() => {
      if (token !== flipToken) return
      flipping.value = true
      cleanupTimer = window.setTimeout(() => {
        if (token !== flipToken) return
        displayed.value = entering.value
        flipping.value = false
      }, 660)
    })
  },
)
</script>

<template>
  <span class="flip-card" :class="{ go: flipping }" aria-hidden="true">
    <span class="digital front">
      <span class="half top"><span class="digit">{{ flipping ? leaving : displayed }}</span></span>
      <span class="half bottom"><span class="digit">{{ flipping ? leaving : displayed }}</span></span>
    </span>
    <span class="digital back">
      <span class="half top"><span class="digit">{{ flipping ? entering : displayed }}</span></span>
      <span class="half bottom"><span class="digit">{{ flipping ? entering : displayed }}</span></span>
    </span>
  </span>
</template>

<style scoped>
.flip-card {
  --flip-w: 52px;
  --flip-h: 76px;
  --flip-font: 44px;
  --flip-radius: 10px;
  /* pen 用 52rem 对 20vw 卡 ≈ 卡高 3.25 倍，随尺寸换算保持同等透视张力 */
  --flip-perspective: calc(var(--flip-h) * 3.25);
  position: relative;
  display: inline-block;
  width: var(--flip-w);
  height: var(--flip-h);
  font-size: var(--flip-font);
  font-weight: 700;
  color: var(--color-ink);
  font-variant-numeric: tabular-nums;
  border-radius: var(--flip-radius);
  box-shadow:
    0 1px 2px rgb(0 0 0 / 0.08),
    0 4px 10px rgb(0 0 0 / 0.1);
}

/* 全屏层随视口缩放 */
.flip-card.large {
  --flip-w: clamp(56px, 11vmin, 96px);
  --flip-h: clamp(80px, 16vmin, 140px);
  --flip-font: clamp(48px, 9.5vmin, 84px);
  --flip-radius: 14px;
}

/* 前后两张整卡叠放，数字由上下两个裁切半区拼成 */
.digital {
  position: absolute;
  inset: 0;
}

.half {
  position: absolute;
  left: 0;
  right: 0;
  height: 50%;
  overflow: hidden;
  background: var(--color-card);
  border: 1px solid var(--color-line);
}

.half.top {
  top: 0;
  border-radius: var(--flip-radius) var(--flip-radius) 0 0;
  border-bottom: none;
}

.half.bottom {
  bottom: 0;
  border-radius: 0 0 var(--flip-radius) var(--flip-radius);
  border-top: none;
}

/* 数字居中于整卡中线：上半按卡高行高取其上部，下半贴底取其下部 */
.digit {
  position: absolute;
  left: 0;
  width: 100%;
  height: var(--flip-h);
  line-height: var(--flip-h);
  text-align: center;
}

.half.top .digit {
  top: 0;
}

.half.bottom .digit {
  bottom: 0;
}

/* 静置层级：前卡上半为可见面（z3），后卡下半盖住前卡下半（z2），
   其余两半垫底（z1）——与 pen 的 z-index 方案一致 */
.front .top {
  z-index: 3;
}

.back .bottom {
  z-index: 2;
}

.front .bottom,
.back .top {
  z-index: 1;
}

/* 中缝折痕恒在最上层 */
.flip-card::after {
  content: '';
  position: absolute;
  left: 1px;
  right: 1px;
  top: calc(50% - 0.5px);
  height: 1px;
  background: var(--color-line);
  z-index: 4;
}

/* 翻转：两叶同时起步、共用同一条曲线；backface 让 ±90° 以外自然隐形 */
.go .front .top {
  transform-origin: 50% 100%;
  animation: flip-front 600ms ease-in-out both;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  will-change: transform;
}

.go .back .bottom {
  transform-origin: 50% 0;
  animation: flip-back 600ms ease-in-out both;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  will-change: transform;
}

@keyframes flip-front {
  0% {
    transform: perspective(var(--flip-perspective)) rotateX(0deg);
  }
  100% {
    transform: perspective(var(--flip-perspective)) rotateX(180deg);
  }
}

@keyframes flip-back {
  0% {
    transform: perspective(var(--flip-perspective)) rotateX(180deg);
  }
  100% {
    transform: perspective(var(--flip-perspective)) rotateX(0deg);
  }
}
</style>
