import { describe, expect, it } from 'vitest'
import { crossOriginTarget, parseAppOrigin } from '@/router/appOriginBoundary'

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

  it('moves non-kiosk paths away from the kiosk origin', () => {
    expect(crossOriginTarget(new URL('https://kiosk.minseok.click/pos/login'), origins)).toBe(
      'https://doro.minseok.click/pos/login',
    )
  })

  it('opens the kiosk home when the kiosk origin root is entered directly', () => {
    expect(crossOriginTarget(new URL('https://kiosk.minseok.click/?from=device#start'), origins)).toBe(
      'https://kiosk.minseok.click/kiosk?from=device#start',
    )
  })

  it('does not redirect an application already on its assigned origin', () => {
    expect(
      crossOriginTarget(new URL('https://kiosk.minseok.click/kiosk/activate'), origins),
    ).toBeNull()
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
