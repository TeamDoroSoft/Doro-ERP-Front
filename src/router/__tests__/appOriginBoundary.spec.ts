import { describe, expect, it } from 'vitest'
import { crossOriginTarget, isPublicCheckoutPath, parseAppOrigin } from '@/router/appOriginBoundary'

describe('public application origin boundary', () => {
  const origins = {
    publicOrigin: 'https://doro.minseok.click',
    kioskOrigin: 'https://kiosk.minseok.click',
  }

  it('moves kiosk paths from the POS origin while preserving only the current location', () => {
    expect(
      crossOriginTarget(
        new URL('https://doro.minseok.click/kiosk/orders/order-1?step=2#status'),
        origins,
      ),
    ).toBe('https://kiosk.minseok.click/kiosk/orders/order-1?step=2#status')
  })

  it('normalizes employee routes on the kiosk origin to device activation', () => {
    expect(crossOriginTarget(new URL('https://kiosk.minseok.click/pos/login'), origins)).toBe(
      'https://kiosk.minseok.click/kiosk/activate',
    )
  })

  it('opens device activation directly when the kiosk origin root is entered', () => {
    expect(
      crossOriginTarget(new URL('https://kiosk.minseok.click/?from=device#start'), origins),
    ).toBe('https://kiosk.minseok.click/kiosk/activate?from=device#start')
  })

  it('does not redirect an application already on its assigned origin', () => {
    expect(
      crossOriginTarget(new URL('https://kiosk.minseok.click/kiosk/activate'), origins),
    ).toBeNull()
  })

  it.each(['/pay/public-id', '/pay/public-id/success', '/pay/public-id/fail', '/pay/%E3%85%87'])(
    'allows only a structurally valid public checkout path: %s',
    (path) => {
      expect(isPublicCheckoutPath(path)).toBe(true)
      expect(crossOriginTarget(new URL(`https://kiosk.minseok.click${path}`), origins)).toBeNull()
    },
  )

  it.each([
    '/pay',
    '/pay/',
    '/pay/public-id/',
    '/pay/public-id/unknown',
    '/pay/public-id/success/extra',
    '/pay/public%2Fid',
    '/payments/public-id',
  ])('rejects an invalid public checkout path on the kiosk origin: %s', (path) => {
    expect(isPublicCheckoutPath(path)).toBe(false)
    expect(crossOriginTarget(new URL(`https://kiosk.minseok.click${path}`), origins)).toBe(
      'https://kiosk.minseok.click/kiosk/activate',
    )
  })

  it('moves public checkout routes to the kiosk origin without losing query or fragment data', () => {
    expect(
      crossOriginTarget(
        new URL(
          'https://doro.minseok.click/pay/public-id?paymentKey=provider-value#token=one-time',
        ),
        origins,
      ),
    ).toBe('https://kiosk.minseok.click/pay/public-id?paymentKey=provider-value#token=one-time')
  })

  it('keeps employee routes on the public origin when checkout routing is enabled', () => {
    expect(crossOriginTarget(new URL('https://kiosk.minseok.click/pos/orders'), origins)).toBe(
      'https://kiosk.minseok.click/kiosk/activate',
    )
    expect(crossOriginTarget(new URL('https://doro.minseok.click/pos/orders'), origins)).toBeNull()
  })

  it.each([
    'https://example.com/path',
    'https://user:password@example.com',
    'javascript:alert(1)',
    'http://example.com',
  ])('rejects unsafe or non-origin configuration: %s', (value) => {
    expect(parseAppOrigin(value)).toBeNull()
  })

  it('allows an explicit localhost HTTP origin for development', () => {
    expect(parseAppOrigin(' http://localhost:5173 ')).toBe('http://localhost:5173')
  })
})
