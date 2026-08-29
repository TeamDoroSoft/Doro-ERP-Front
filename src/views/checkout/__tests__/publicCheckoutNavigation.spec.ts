import { describe, expect, it, vi } from 'vitest'
import { capturePublicCheckoutNavigation } from '@/views/checkout/publicCheckoutNavigation'

describe('public checkout navigation credential capture', () => {
  const historyReplace = () =>
    vi.fn<(data: unknown, unused: string, url?: string | URL | null) => void>()

  it('reads the fragment token in memory and immediately removes it from history', () => {
    const replaceState = historyReplace()
    const captured = capturePublicCheckoutNavigation(
      { pathname: '/pay/public-1', search: '', hash: '#token=one-time%20secret' },
      { state: { navigation: 1 }, replaceState },
    )

    expect(captured.token).toBe('one-time secret')
    expect(replaceState).toHaveBeenCalledWith({ navigation: 1 }, '', '/pay/public-1')
    expect(JSON.stringify(captured)).not.toContain('#token=')
  })

  it('captures Toss values and removes the entire redirect query before async work', () => {
    const replaceState = historyReplace()
    const captured = capturePublicCheckoutNavigation(
      {
        pathname: '/pay/public-1/success',
        search: '?paymentKey=pk_123&orderId=provider-1&amount=12000',
        hash: '',
      },
      { state: null, replaceState },
    )

    expect(captured).toEqual({
      token: '',
      paymentKey: 'pk_123',
      providerOrderId: 'provider-1',
      amount: '12000',
    })
    expect(replaceState).toHaveBeenCalledWith(null, '', '/pay/public-1/success')
  })

  it('captures a Toss V2 NORMAL redirect in any query order without exposing paymentType', () => {
    const replaceState = historyReplace()
    const captured = capturePublicCheckoutNavigation(
      {
        pathname: '/pay/public-1/success',
        search: '?amount=12000&paymentType=NORMAL&orderId=provider-1&paymentKey=pk_123',
        hash: '',
      },
      { state: null, replaceState },
    )

    expect(captured).toEqual({
      token: '',
      paymentKey: 'pk_123',
      providerOrderId: 'provider-1',
      amount: '12000',
    })
    expect(captured).not.toHaveProperty('paymentType')
    expect(replaceState).toHaveBeenCalledWith(null, '', '/pay/public-1/success')
  })

  it('does not accept a malformed provider amount for confirmation', () => {
    const captured = capturePublicCheckoutNavigation(
      { pathname: '/pay/public-1/success', search: '?amount=12.5', hash: '' },
      { state: null, replaceState: historyReplace() },
    )

    expect(captured.amount).toBe('')
  })

  it.each([
    '#token=',
    '#other=value',
    '#token=first&token=second',
    '#token=value&extra=value',
    '#token=%E0%A4%A',
  ])('scrubs and rejects a malformed token fragment: %s', (hash) => {
    const replaceState = historyReplace()
    const captured = capturePublicCheckoutNavigation(
      { pathname: '/pay/public-1', search: '', hash },
      { state: null, replaceState },
    )

    expect(captured.token).toBe('')
    expect(replaceState).toHaveBeenCalledOnce()
  })

  it.each([
    '?paymentKey=key&orderId=order',
    '?paymentKey=first&paymentKey=second&amount=1',
    '?paymentKey=key&orderId=order&amount=1&extra=value',
    '?paymentType=BRANDPAY&paymentKey=key&orderId=order&amount=1',
    '?paymentType=KEYIN&paymentKey=key&orderId=order&amount=1',
    '?paymentType=&paymentKey=key&orderId=order&amount=1',
    '?paymentType=NORMAL&paymentType=NORMAL&paymentKey=key&orderId=order&amount=1',
    '?paymentType=NORMAL&paymentKey=key&orderId=order&amount=1&extra=value',
    '?paymentType=NORMAL&paymentKey=key&orderId=order&amount=%E0%A4%A',
    '?paymentType=NORMAL&paymentKey=key&orderId=order&amount=1&',
  ])('scrubs and rejects an incomplete or ambiguous redirect: %s', (search) => {
    const captured = capturePublicCheckoutNavigation(
      { pathname: '/pay/public-1/success', search, hash: '' },
      { state: null, replaceState: historyReplace() },
    )
    expect(captured.paymentKey).toBe('')
    expect(captured.providerOrderId).toBe('')
    expect(captured.amount).toBe('')
  })
})
