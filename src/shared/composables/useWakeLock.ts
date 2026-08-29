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

  async function acquire(): Promise<void> {
    const api = (navigator as WakeLockNavigator).wakeLock
    if (!api || sentinel) return
    try {
      sentinel = await api.request('screen')
      sentinel.addEventListener('release', () => {
        sentinel = null
      })
    } catch {
      sentinel = null
    }
  }

  function release(): void {
    sentinel?.release().catch(() => {})
    sentinel = null
  }

  return { acquire, release }
}
