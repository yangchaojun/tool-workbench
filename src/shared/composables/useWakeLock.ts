type WakeLockSentinelLike = {
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void) => void
}

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
}

/**
 * Screen Wake Lock 封装：全屏专注期间防止屏幕息屏。
 * 不支持的浏览器（Firefox / 部分 iOS）acquire 静默降级为 no-op；
 * 系统可能在页面隐藏时自动释放（sentinel 归 null），重新可见后需再次 acquire。
 */
export function useWakeLock() {
  let sentinel: WakeLockSentinelLike | null = null
  // acquire 是异步的：若在请求落定前发生 release（或新的 acquire 前又 release），
  // 代际号让过期的请求直接释放自己得到的锁，避免屏保锁泄漏
  let generation = 0

  async function acquire(): Promise<void> {
    const api = (navigator as WakeLockNavigator).wakeLock
    if (!api || sentinel) return
    const gen = ++generation
    try {
      const s = await api.request('screen')
      // 请求落定前的 release 使代际失效：放弃这把刚拿到、但已无人需要的锁
      if (gen !== generation) {
        void s.release()
        return
      }
      sentinel = s
      s.addEventListener('release', () => {
        sentinel = null
      })
    } catch {
      sentinel = null
    }
  }

  function release(): void {
    generation++
    sentinel?.release().catch(() => {})
    sentinel = null
  }

  return { acquire, release }
}
