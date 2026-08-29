/** 浏览器通知封装：权限在用户打开开关时请求，发送时静默失败 */

export async function requestNotifyPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function sendNotification(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, silent: true })
  } catch {
    // 部分环境（移动端浏览器）不支持构造式通知：静默降级
  }
}
