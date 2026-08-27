import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/http'
import { useKioskRuntimeStore } from '@/stores/kioskRuntime'
import type { KioskRuntime } from '@/api/kioskRuntime'

const api = vi.hoisted(() => ({
  getKioskRuntime: vi.fn<() => Promise<KioskRuntime>>(),
}))
vi.mock('@/api/kioskRuntime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/kioskRuntime')>()),
  getKioskRuntime: api.getKioskRuntime,
}))

describe('kiosk runtime store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('derives the exact home from server runtime mode', async () => {
    api.getKioskRuntime.mockResolvedValue({
      deviceId: 'device-1',
      deviceName: '입구 대기',
      mode: 'ENTRY_QUEUE',
      pairedPaymentDevice: null,
    })
    const store = useKioskRuntimeStore()

    await store.load()

    expect(store.homePath).toBe('/kiosk/waiting')
  })

  it('reloads runtime for mode forbidden without clearing authentication state', async () => {
    api.getKioskRuntime.mockResolvedValue({
      deviceId: 'device-1',
      deviceName: '결제 1',
      mode: 'PAYMENT',
      pairedPaymentDevice: null,
    })
    const store = useKioskRuntimeStore()

    await expect(
      store.recoverModeMismatch(
        new ApiError(403, { status: 403, code: 'KIOSK_MODE_FORBIDDEN' }),
      ),
    ).resolves.toBe(true)
    expect(store.runtime?.mode).toBe('PAYMENT')
  })

  it('clears cached runtime when runtime authentication is rejected', async () => {
    api.getKioskRuntime
      .mockResolvedValueOnce({
        deviceId: 'device-1',
        deviceName: '주문 1',
        mode: 'ORDER',
        pairedPaymentDevice: null,
      })
      .mockRejectedValueOnce(new ApiError(401, { status: 401, code: 'UNAUTHENTICATED' }))
    const store = useKioskRuntimeStore()
    await store.load()

    await expect(store.load()).rejects.toMatchObject({ status: 401 })
    expect(store.runtime).toBeNull()
  })
})
