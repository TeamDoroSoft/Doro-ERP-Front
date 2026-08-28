import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import KioskLayout from '@/layouts/KioskLayout.vue'
import { useKioskCartStore } from '@/stores/kioskCart'
import { useKioskRuntimeStore } from '@/stores/kioskRuntime'
import { useKioskSessionStore } from '@/stores/kioskSession'
import { useOperatorSessionStore } from '@/stores/operatorSession'

async function mountLayout(path = '/kiosk/order') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/kiosk',
        component: KioskLayout,
        children: [
          { path: 'order', component: { template: '<div>order</div>' } },
          {
            path: 'activate',
            component: { template: '<div>activate</div>' },
            meta: { kioskActivation: true },
          },
        ],
      },
    ],
  })
  await router.push(path)
  await router.isReady()
  return {
    router,
    wrapper: mount(KioskLayout, {
      attachTo: document.body,
      global: { plugins: [router] },
    }),
  }
}

describe('KioskLayout logout', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('hides logout on activation and restores focus when the dialog is cancelled', async () => {
    const activation = await mountLayout('/kiosk/activate')
    expect(activation.wrapper.find('button').exists()).toBe(false)
    activation.wrapper.unmount()

    const { wrapper } = await mountLayout()
    const trigger = wrapper.get('button')
    await trigger.trigger('click')
    expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(wrapper.get('input').element).toBe(document.activeElement)
    await wrapper.get('input').trigger('keydown', { key: 'Tab', shiftKey: true })
    const dialogButtons = wrapper.get('[role="dialog"]').findAll('button')
    expect(dialogButtons[1]?.element).toBe(document.activeElement)
    await dialogButtons[1]!.trigger('keydown', { key: 'Tab' })
    expect(wrapper.get('input').element).toBe(document.activeElement)
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(trigger.element).toBe(document.activeElement)
  })

  it('clears kiosk-only state and navigates only after a successful verified logout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    const session = useKioskSessionStore(),
      runtime = useKioskRuntimeStore(),
      cart = useKioskCartStore(),
      operator = useOperatorSessionStore()
    session.markAuthenticated()
    runtime.runtime = {
      deviceId: 'd1',
      deviceName: 'K-1',
      mode: 'ORDER',
      pairedPaymentDevice: null,
    }
    cart.addItem({ productId: 'p1', name: '커피', description: '', price: '1', displayOrder: 1 })
    operator.setRole('OWNER')
    const { router, wrapper } = await mountLayout()

    await wrapper.get('button').trigger('click')
    await wrapper.get('input').setValue('kdc_credential-id.one-time')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body))).toEqual({
      secret: 'one-time',
    })
    expect(session.deviceState).toBe('UNREGISTERED')
    expect(runtime.runtime).toBeNull()
    expect(cart.itemCount).toBe(0)
    expect(operator.role).toBe('OWNER')
    expect(router.currentRoute.value.path).toBe('/kiosk/activate')
  })

  it('keeps the session and customer state after a wrong code and clears the input', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ code: 'KIOSK_AUTHENTICATION_FAILED' }), {
          status: 401,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    )
    const session = useKioskSessionStore(), cart = useKioskCartStore()
    session.markAuthenticated()
    cart.addItem({ productId: 'p1', name: '커피', description: '', price: '1', displayOrder: 1 })
    const { router, wrapper } = await mountLayout()

    await wrapper.get('button').trigger('click')
    await wrapper.get('input').setValue('wrong')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('활성화 코드')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('')
    expect(session.deviceState).toBe('ACTIVE')
    expect(cart.itemCount).toBe(1)
    expect(router.currentRoute.value.path).toBe('/kiosk/order')
  })

  it.each([
    [
      'rate limit',
      () =>
        new Response(JSON.stringify({ code: 'AUTH_RATE_LIMITED' }), {
          status: 429,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      '요청이 너무 많습니다.',
    ],
    [
      'dependency outage',
      () =>
        new Response(JSON.stringify({ code: 'STORE_ACCESS_UNAVAILABLE' }), {
          status: 503,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      '일시적으로 사용할 수 없습니다.',
    ],
  ])('preserves local state after a %s response', async (_name, response, expected) => {
    vi.stubGlobal('fetch', vi.fn(async () => response()))
    const session = useKioskSessionStore(), cart = useKioskCartStore()
    session.markAuthenticated()
    cart.addItem({ productId: 'p1', name: '커피', description: '', price: '1', displayOrder: 1 })
    const { wrapper } = await mountLayout()

    await wrapper.get('button').trigger('click')
    await wrapper.get('input').setValue('secret')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain(expected)
    expect(session.deviceState).toBe('ACTIVE')
    expect(cart.itemCount).toBe(1)
  })

  it('preserves state on a network failure and ignores a double submit', async () => {
    let rejectRequest: ((reason: Error) => void) | undefined
    const request = vi.fn<() => Promise<Response>>(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectRequest = reject
        }),
    )
    vi.stubGlobal('fetch', request)
    const session = useKioskSessionStore(), cart = useKioskCartStore()
    session.markAuthenticated()
    cart.addItem({ productId: 'p1', name: '커피', description: '', price: '1', displayOrder: 1 })
    const { wrapper } = await mountLayout()

    await wrapper.get('button').trigger('click')
    await wrapper.get('input').setValue('secret')
    void wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    expect(request).toHaveBeenCalledTimes(1)
    rejectRequest?.(new Error('offline'))
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('네트워크 연결')
    expect(session.deviceState).toBe('ACTIVE')
    expect(cart.itemCount).toBe(1)
  })
})
