import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import router from '@/router'
import { useKioskSessionStore } from '@/stores/kioskSession'
import { useOperatorSessionStore } from '@/stores/operatorSession'

describe('page metadata', () => {
  beforeEach(async () => {
    sessionStorage.clear()
    setActivePinia(createPinia())
    await router.push('/pos/login')
  })

  it('defines a title and description for every rendered route', () => {
    const renderedRoutes = router
      .getRoutes()
      .filter((route) => route.name && route.components?.default)

    expect(renderedRoutes.length).toBeGreaterThan(0)
    for (const route of renderedRoutes) {
      expect(route.meta.title).toBeTypeOf('string')
      expect(route.meta.title?.trim()).not.toBe('')
      expect(route.meta.description).toBeTypeOf('string')
      expect(route.meta.description?.trim()).not.toBe('')
    }
  })

  it('updates the document title and description after POS navigation', async () => {
    useOperatorSessionStore().applyLogin(
      { employeeId: 'employee-1', role: 'STAFF', passwordChangeRequired: false },
      'doro',
    )

    await router.push('/pos/orders/new')

    expect(document.title).toBe('신규 주문 | Doro ERP')
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe(
      '매장 식사 또는 포장 주문을 새로 등록합니다.',
    )
  })

  it('uses the final guarded Kiosk route metadata', async () => {
    await router.push('/kiosk/cart')
    expect(router.currentRoute.value.path).toBe('/kiosk/activate')
    expect(document.title).toBe('키오스크 연결 | Doro ERP')

    useKioskSessionStore().deviceState = 'ACTIVE'
    await router.push('/kiosk/cart')
    expect(document.title).toBe('장바구니 | Doro ERP')
  })
})
