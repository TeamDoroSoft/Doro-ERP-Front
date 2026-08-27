import { computed, onScopeDispose, ref } from 'vue'
import {
  getCurrentPaymentHandoff,
  type PaymentKioskHandoff,
} from '@/api/paymentHandoff'
import { safeApiErrorMessage } from '@/api/http'

const qrStatuses = new Set<PaymentKioskHandoff['status']>(['DISPLAYED', 'PROCESSING'])

export function usePaymentHandoffDisplay(pollIntervalMs = 2_500) {
  const current = ref<PaymentKioskHandoff | null>(null)
  const loading = ref(true)
  const refreshing = ref(false)
  const errorMessage = ref('')
  const remainingSeconds = ref(0)
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let countdownTimer: ReturnType<typeof setInterval> | undefined
  let expiryRefreshRequested = false
  let started = false

  const canDisplayQr = computed(
    () =>
      !!current.value &&
      qrStatuses.has(current.value.status) &&
      remainingSeconds.value > 0,
  )

  async function refresh() {
    if (refreshing.value) return
    refreshing.value = true
    try {
      const next = await getCurrentPaymentHandoff()
      errorMessage.value = ''
      if (!next) {
        current.value = null
        remainingSeconds.value = 0
        return
      }

      current.value = next
      expiryRefreshRequested = false
      updateCountdown()
    } catch (error) {
      errorMessage.value = safeApiErrorMessage(
        error,
        '결제 요청을 확인할 수 없습니다. 네트워크 연결을 확인해 주세요.',
      )
    } finally {
      loading.value = false
      refreshing.value = false
    }
  }

  function updateCountdown() {
    if (!current.value) return
    const expiresAt = Date.parse(current.value.expiresAt)
    remainingSeconds.value =
      Number.isFinite(expiresAt)
        ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1_000))
        : 0
    if (remainingSeconds.value === 0 && !expiryRefreshRequested) {
      expiryRefreshRequested = true
      void refresh()
    }
  }

  function schedulePoll() {
    clearTimeout(pollTimer)
    if (!started || document.visibilityState !== 'visible') return
    pollTimer = setTimeout(async () => {
      await refresh()
      schedulePoll()
    }, pollIntervalMs)
  }

  function handleVisibility() {
    if (document.visibilityState === 'visible') {
      void refresh().finally(schedulePoll)
    } else {
      clearTimeout(pollTimer)
    }
  }

  function handleOnline() {
    if (document.visibilityState === 'visible') void refresh()
  }

  function start() {
    if (started) return
    started = true
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)
    countdownTimer = setInterval(updateCountdown, 1_000)
    void refresh().finally(schedulePoll)
  }

  function stop() {
    started = false
    clearTimeout(pollTimer)
    clearInterval(countdownTimer)
    document.removeEventListener('visibilitychange', handleVisibility)
    window.removeEventListener('online', handleOnline)
  }

  onScopeDispose(stop)
  return {
    current,
    loading,
    refreshing,
    errorMessage,
    remainingSeconds,
    canDisplayQr,
    refresh,
    start,
    stop,
  }
}
