import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeKioskMode, getKiosks, getSecurityHistory, registerKiosk } from '@/api/administration'

describe('administration API', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('uses the Store Access security-history contract and preserves nullable actors', async () => {
    const fixture = {
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          eventType: 'EMPLOYEE_LOGIN_FAILED',
          actorEmployeeId: null,
          targetType: 'EMPLOYEE',
          targetId: '22222222-2222-4222-8222-222222222222',
          result: 'FAILURE',
          reasonCode: 'AUTHENTICATION_FAILED',
          previousValue: null,
          newValue: null,
          occurredAt: '2026-08-25T09:00:00Z',
        },
      ],
      nextCursorOccurredAt: '2026-08-25T09:00:00Z',
      nextCursorId: '11111111-1111-4111-8111-111111111111',
      hasMore: true,
    }
    fetchMock.mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 }))

    const page = await getSecurityHistory({
      from: '2026-08-18T09:00:00.000Z',
      to: '2026-08-25T09:00:00.000Z',
      eventType: 'EMPLOYEE_LOGIN_FAILED',
      targetType: 'EMPLOYEE',
      targetId: '22222222-2222-4222-8222-222222222222',
      result: 'FAILURE',
      cursorOccurredAt: '2026-08-25T09:00:00Z',
      cursorId: '11111111-1111-4111-8111-111111111111',
      size: 20,
    })

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://local')
    expect(url.pathname).toBe('/api/v1/security-history')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: '2026-08-18T09:00:00.000Z',
      to: '2026-08-25T09:00:00.000Z',
      eventType: 'EMPLOYEE_LOGIN_FAILED',
      targetType: 'EMPLOYEE',
      targetId: '22222222-2222-4222-8222-222222222222',
      result: 'FAILURE',
      cursorOccurredAt: '2026-08-25T09:00:00Z',
      cursorId: '11111111-1111-4111-8111-111111111111',
      size: '20',
    })
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('GET')
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe('include')
    expect(page.items[0]?.actorEmployeeId).toBeNull()
    expect(page.hasMore).toBe(true)
  })

  it('lists only safe kiosk device metadata from the management endpoint', async () => {
    const devices = [
      {
        id: '88000000-0000-0000-0000-000000000001',
        deviceCode: 'KIOSK-01',
        displayName: '입구 주문 Kiosk 01',
        lastSeenAt: '2026-08-26T08:30:00Z',
        status: 'ACTIVE',
        mode: 'ORDER',
        pairedPaymentDeviceId: null,
        credentialVersion: 2,
        createdAt: '2026-08-25T09:00:00Z',
        updatedAt: '2026-08-26T09:00:00Z',
      },
    ]
    fetchMock.mockResolvedValue(new Response(JSON.stringify(devices), { status: 200 }))

    const result = await getKiosks()

    const [input, init] = fetchMock.mock.calls[0]!
    expect(new URL(String(input), 'http://local').pathname).toBe('/api/v1/kiosk-devices')
    expect(init?.method).toBe('GET')
    expect(init?.credentials).toBe('include')
    expect(result).toEqual(devices)
    expect(result[0]).not.toHaveProperty('credential')
    expect(result[0]?.displayName).toBe('입구 주문 Kiosk 01')
    expect(result[0]?.lastSeenAt).toBe('2026-08-26T08:30:00Z')
  })

  it('updates a kiosk mode and clears pairing outside ORDER mode', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: '88000000-0000-0000-0000-000000000001',
          deviceCode: 'KIOSK-01',
          displayName: '카운터 결제 Kiosk 01',
          lastSeenAt: null,
          status: 'ACTIVE',
          mode: 'PAYMENT',
          pairedPaymentDeviceId: null,
          credentialVersion: 2,
          createdAt: '2026-08-25T09:00:00Z',
          updatedAt: '2026-08-26T09:00:00Z',
        }),
        { status: 200 },
      ),
    )

    await changeKioskMode('88000000-0000-0000-0000-000000000001', 'PAYMENT', 'ignored-pair')

    const [input, init] = fetchMock.mock.calls[0]!
    expect(new URL(String(input), 'http://local').pathname).toBe(
      '/api/v1/kiosk-devices/88000000-0000-0000-0000-000000000001/mode',
    )
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({
      mode: 'PAYMENT',
      pairedPaymentDeviceId: null,
    })
  })

  it('sends the selected payment device only for ORDER mode', async () => {
    const pairedPaymentDeviceId = '88000000-0000-4000-8000-000000000002'
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: '88000000-0000-0000-0000-000000000001',
          deviceCode: 'KIOSK-01',
          displayName: '입구 주문 Kiosk 01',
          lastSeenAt: null,
          status: 'ACTIVE',
          mode: 'ORDER',
          pairedPaymentDeviceId,
          credentialVersion: 2,
          createdAt: '2026-08-25T09:00:00Z',
          updatedAt: '2026-08-26T09:00:00Z',
        }),
        { status: 200 },
      ),
    )

    await changeKioskMode('88000000-0000-0000-0000-000000000001', 'ORDER', pairedPaymentDeviceId)

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      mode: 'ORDER',
      pairedPaymentDeviceId,
    })
  })

  it('registers a device code and a separate friendly display name', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ kioskDeviceId: '88000000-0000-0000-0000-000000000001', credential: 'secret' }),
        { status: 200 },
      ),
    )

    await registerKiosk('KIOSK-01', '입구 주문 Kiosk 01')

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      deviceCode: 'KIOSK-01',
      displayName: '입구 주문 Kiosk 01',
    })
  })
})
