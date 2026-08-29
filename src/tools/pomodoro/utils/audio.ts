/**
 * WebAudio 提示音——无资源文件。
 * AudioContext 必须在用户手势中创建（浏览器自动播放策略），
 * 因此 prepareAudio() 在点击「开始」时调用。
 */

let ctx: AudioContext | null = null

export function prepareAudio(): void {
  if (ctx === null) {
    try {
      ctx = new AudioContext()
    } catch {
      ctx = null
    }
  } else if (ctx.state === 'suspended') {
    void ctx.resume()
  }
}

/** 温和的三音上行（E5–A5–D6），结束一段时播放 */
export function playChime(): void {
  if (ctx === null || ctx.state !== 'running') return
  const now = ctx.currentTime
  const notes: Array<[freq: number, delaySec: number]> = [
    [659.25, 0],
    [880, 0.18],
    [1174.66, 0.36],
  ]
  for (const [freq, delay] of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = now + delay
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.5)
  }
}
