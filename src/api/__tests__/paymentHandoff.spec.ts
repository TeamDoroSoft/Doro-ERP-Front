import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelPaymentHandoff,
  createPaymentHandoff,
  getCurrentPaymentHandoff,
  reassignPaymentHandoff,
  reissuePaymentHandoff,
} from '@/api/paymentHandoff'
import { registerKioskUnauthorizedHandler, registerUnauthorizedHandler } from '@/api/http'

const handoffWire = {
  id: '11111111-1111-4111-8111-111111111111',
  paymentId: '22222222-2222-4222-8222-222222222222',
  publicId: '33333333-3333-4333-8333-333333333333',
  displayCode: 'A7K9',
  targetPaymentDeviceId: '44444444-4444-4444-8444-444444444444',
  targetPaymentDeviceName: '결제 01',
  status: 'QUEUED',
  expiresAt: '2026-08-27T10:05:00Z',
  version: 0,
}

describe('payment handoff api', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('reads every required current-display field and preserves the server amount', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            '{"id":"11111111-1111-4111-8111-111111111111",' +
              '"publicId":"33333333-3333-4333-8333-333333333333","displayCode":"A7K9",' +
              '"status":"DISPLAYED","expiresAt":"2026-08-27T10:05:00Z",' +
              '"amount":9007199254740993,"currency":"KRW","orderName":"주문 17",' +
              '"oneTimeToken":null}',
            { status: 200 },
          ),
      ),
    )

    await expect(getCurrentPaymentHandoff()).resolves.toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      publicId: '33333333-3333-4333-8333-333333333333',
      displayCode: 'A7K9',
      status: 'DISPLAYED',
      expiresAt: '2026-08-27T10:05:00Z',
      amount: '9007199254740993',
      currency: 'KRW',
      orderName: '주문 17',
      oneTimeToken: null,
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/kiosk/payment-handoffs/current',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('maps an empty current slot to null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    )
    await expect(getCurrentPaymentHandoff()).resolves.toBeNull()
  })

  it('creates a staff handoff with a stable idempotency key and target device', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(handoffWire), { status: 201 })),
    )
    await expect(
      createPaymentHandoff(handoffWire.paymentId, handoffWire.targetPaymentDeviceId, 'handoff-key'),
    ).resolves.toMatchObject({ version: '0', displayCode: 'A7K9' })
    const [, options] = vi.mocked(fetch).mock.calls[0]!
    expect(new Headers(options?.headers).get('Idempotency-Key')).toBe('handoff-key')
    expect(JSON.parse(String(options?.body))).toEqual({
      paymentId: handoffWire.paymentId,
      targetPaymentDeviceId: handoffWire.targetPaymentDeviceId,
    })
  })

  it('routes a kiosk create 401 only to the kiosk session boundary', async () => {
    const employeeUnauthorized = vi.fn<() => void>()
    const kioskUnauthorized = vi.fn<() => void>()
    registerUnauthorizedHandler(employeeUnauthorized)
    registerKioskUnauthorizedHandler(kioskUnauthorized)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: 401, code: 'UNAUTHENTICATED' }), { status: 401 }),
      ),
    )
    await expect(
      createPaymentHandoff(
        handoffWire.paymentId,
        handoffWire.targetPaymentDeviceId,
        'key',
        'kiosk',
      ),
    ).rejects.toMatchObject({ status: 401 })
    expect(kioskUnauthorized).toHaveBeenCalledOnce()
    expect(employeeUnauthorized).not.toHaveBeenCalled()
  })

  it('uses the exact employee recovery mutation paths', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(handoffWire), { status: 200 })),
    )
    await reissuePaymentHandoff('handoff/id')
    await reassignPaymentHandoff('handoff/id', handoffWire.targetPaymentDeviceId)
    await cancelPaymentHandoff('handoff/id')
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/payment-handoffs/handoff%2Fid/reissue',
      '/api/v1/payment-handoffs/handoff%2Fid/reassign',
      '/api/v1/payment-handoffs/handoff%2Fid/cancel',
    ])
  })
})
