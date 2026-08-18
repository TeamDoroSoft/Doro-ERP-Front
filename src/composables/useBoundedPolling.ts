import { onScopeDispose } from 'vue'

export function useBoundedPolling(callback: () => Promise<unknown>, intervalMs = 5_000, maxAttempts = 3) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let attempts = 0

  function start() {
    stop()
    attempts = 0
    schedule()
  }

  function schedule() {
    if (attempts >= maxAttempts) return
    timer = setTimeout(async () => {
      timer = undefined
      if (document.visibilityState !== 'visible') return
      attempts += 1
      await callback()
      schedule()
    }, intervalMs)
  }

  function stop() {
    if (timer) clearTimeout(timer)
    timer = undefined
  }

  onScopeDispose(stop)
  return { start, stop }
}
