import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PublicCheckoutView from '@/views/checkout/PublicCheckoutView.vue'
import {
  confirmPublicCheckout,
  getPublicCheckoutStatus,
  resolvePublicCheckout,
  type PublicCheckoutResult,
  type PublicCheckoutStart,
  type PublicCheckoutSummary,
} from '@/api/publicCheckout'

vi.mock('@/api/publicCheckout', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/publicCheckout')>()
  return {
    ...original,
    resolvePublicCheckout:
      vi.fn<(publicId: string, token: string) => Promise<PublicCheckoutSummary>>(),
    startPublicCheckout:
      vi.fn<(publicId: string, token: string) => Promise<PublicCheckoutStart>>(),
    confirmPublicCheckout:
      vi.fn<(publicId: string, input: unknown, signal?: AbortSignal) => Promise<PublicCheckoutResult>>(),
    getPublicCheckoutStatus: vi.fn<(publicId: string) => Promise<PublicCheckoutResult>>(),
  }
})

vi.mock('@/payments/tossPayment', () => ({
  requestTossPayment: vi.fn<() => Promise<void>>(),
  tossPaymentErrorMessage: () => '결제창을 열지 못했습니다.',
}))

const summary = {
  orderName: '아메리카노 외 1건',
  amount: '12000',
  currency: 'KRW' as const,
  expiresAt: '2026-08-27T12:30:00Z',
  status: 'DISPLAYED' as const,
}

describe('PublicCheckoutView', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
  })

  it('removes the token before resolving and shows only the server summary', async () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    vi.mocked(resolvePublicCheckout).mockImplementation(async () => {
      expect(window.location.hash).toBe('')
      return summary
    })
    const wrapper = await mountAt('/pay/public-1', '/pay/public-1#token=secret')

    expect(resolvePublicCheckout).toHaveBeenCalledWith('public-1', 'secret')
    expect(wrapper.text()).toContain('아메리카노 외 1건')
    expect(wrapper.text()).toContain('12,000원')
    expect(wrapper.text()).not.toContain('secret')
    expect(window.location.href).not.toContain('token')
    expect(storageWrite).not.toHaveBeenCalled()
    expect(localStorage).toHaveLength(0)
    expect(sessionStorage).toHaveLength(0)
  })

  it('never displays success from the Toss redirect alone', async () => {
    vi.mocked(confirmPublicCheckout).mockRejectedValue(new Error('timeout'))
    vi.mocked(getPublicCheckoutStatus).mockResolvedValue({
      status: 'PROCESSING',
    })
    const wrapper = await mountAt(
      '/pay/public-1/success',
      '/pay/public-1/success?paymentKey=pk&orderId=provider&amount=12000',
    )

    expect(window.location.search).toBe('')
    expect(wrapper.text()).toContain('결제 결과 확인 중')
    expect(wrapper.text()).not.toContain('결제가 완료되었습니다')
  })

  it('shows completion only after the public confirm returns PAID', async () => {
    vi.mocked(confirmPublicCheckout).mockResolvedValue({
      status: 'PAID',
    })
    const wrapper = await mountAt(
      '/pay/public-1/success',
      '/pay/public-1/success?paymentType=NORMAL&paymentKey=pk&orderId=provider&amount=12000',
    )

    expect(confirmPublicCheckout).toHaveBeenCalledExactlyOnceWith(
      'public-1',
      { paymentKey: 'pk', providerOrderId: 'provider', amount: '12000' },
      expect.any(AbortSignal),
    )
    expect(wrapper.text()).toContain('결제가 완료되었습니다')
    expect(getPublicCheckoutStatus).not.toHaveBeenCalled()
    expect(window.location.search).toBe('')
  })

  it('fails closed after refresh removes a token that was not exchanged for a cookie', async () => {
    const wrapper = await mountAt('/pay/public-1', '/pay/public-1')

    expect(wrapper.text()).toContain('결제 링크가 만료되었거나 사용할 수 없어요')
    expect(resolvePublicCheckout).not.toHaveBeenCalled()
  })

  it('automatically recovers an uncertain redirect result from the checkout cookie', async () => {
    vi.useFakeTimers()
    vi.mocked(getPublicCheckoutStatus)
      .mockResolvedValueOnce({ status: 'PROCESSING' })
      .mockResolvedValueOnce({ status: 'PAID' })
    const wrapper = await mountAt('/pay/public-1/success', '/pay/public-1/success')

    expect(wrapper.text()).toContain('결제 결과 확인 중')
    await vi.advanceTimersByTimeAsync(2_500)
    await flushPromises()

    expect(getPublicCheckoutStatus).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('결제가 완료되었습니다')
    wrapper.unmount()
  })
})

async function mountAt(routePath: string, browserPath: string) {
  window.history.replaceState({}, '', browserPath)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pay/:publicId', component: PublicCheckoutView },
      { path: '/pay/:publicId/success', component: PublicCheckoutView },
      { path: '/pay/:publicId/fail', component: PublicCheckoutView },
    ],
  })
  await router.push(routePath)
  await router.isReady()
  const wrapper = mount(PublicCheckoutView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}
