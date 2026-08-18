import { expect, test } from '@playwright/test'

const orderId = '11111111-1111-4111-8111-111111111111'
const productId = '22222222-2222-4222-8222-222222222222'

const order = {
  orderId,
  displayNumber: 7,
  totalAmount: 4500,
  currency: 'KRW',
  status: 'CREATED',
  businessDate: '2026-08-17',
  orderAccessToken: null,
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'doro-erp.operator-session',
      JSON.stringify({
        employeeId: '00000000-0000-4000-8000-000000000001',
        role: 'STAFF',
        tenantCode: 'DORO-DEMO',
        passwordChangeRequired: false,
      }),
    )
  })
})

test('[mock-ui] creates a takeout order with one idempotent command and opens server detail', async ({
  page,
}) => {
  let createRequests = 0
  let idempotencyKey = ''

  await page.route('**/api/v1/catalog/menu', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        currency: 'KRW',
        categories: [
          {
            categoryId: 'category-1',
            name: '커피',
            displayOrder: 1,
            products: [
              {
                productId,
                name: '아메리카노',
                description: '',
                price: 4500,
                displayOrder: 1,
              },
            ],
          },
        ],
      }),
    })
  })
  await page.route('**/api/v1/orders', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    createRequests += 1
    idempotencyKey = route.request().headers()['idempotency-key'] ?? ''
    expect(route.request().postDataJSON()).toEqual({
      orderChannel: 'POS',
      serviceType: 'TAKEOUT',
      lines: [{ productId, quantity: 1 }],
    })
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(order),
    })
  })
  await page.route(`**/api/v1/orders/${orderId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(order),
    })
  })

  await page.goto('/pos/orders/new')
  await page.getByRole('button', { name: '담기' }).click()
  await page.getByRole('button', { name: '주문 생성', exact: true }).click()

  await expect(page).toHaveURL(new RegExp(`/pos/orders/${orderId}$`))
  await expect(page.getByRole('heading', { name: '주문 상세' })).toBeVisible()
  await expect(page.getByRole('article').getByText('4,500 KRW')).toBeVisible()
  expect(createRequests).toBe(1)
  expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
})

test('[mock-ui] opens a listed CREATED order and cancels it without an accept action', async ({ page }) => {
  const cancelled = { ...order, status: 'CANCELLED' }

  await page.route('**/api/v1/orders', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([order]),
    })
  })
  await page.route(`**/api/v1/orders/${orderId}/cancel`, async (route) => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().postData()).toBeNull()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cancelled),
    })
  })
  await page.route(`**/api/v1/orders/${orderId}`, async (route) => {
    expect(route.request().method()).toBe('GET')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(order),
    })
  })
  page.on('dialog', (dialog) => dialog.accept())

  await page.goto('/pos/orders')
  await page.getByRole('button', { name: /#7/ }).click()
  await page.getByRole('button', { name: '주문 취소' }).click()

  await expect(page.getByText('취소', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '주문 접수' })).toHaveCount(0)
})

test('[mock-ui] creates a DINE_IN order with the selected active table id', async ({ page }) => {
  const tableId = '33333333-3333-4333-8333-333333333333'
  let createdPayload: unknown = null
  let tableRequests = 0

  await page.route('**/api/v1/catalog/menu', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: menuBody() })
  })
  await page.route('**/api/v1/tables', async (route) => {
    tableRequests += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: tableId,
          tableNumber: 'T-1',
          displayName: '창가',
          status: 'ACTIVE',
          version: 1,
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          tableNumber: 'T-9',
          displayName: '정리 중',
          status: 'INACTIVE',
          version: 1,
        },
      ]),
    })
  })
  await page.route('**/api/v1/orders', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    createdPayload = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(order),
    })
  })
  await page.route(`**/api/v1/orders/${orderId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(order),
    })
  })

  await page.goto('/pos/orders/new')
  await page.getByLabel('매장 식사').check()
  await expect(page.getByLabel('활성 테이블')).toBeVisible()
  // Only ACTIVE tables are offered for selection.
  await expect(page.getByLabel('활성 테이블').locator('option')).toHaveCount(2)
  await page.getByLabel('활성 테이블').selectOption(tableId)
  await page.getByRole('button', { name: '담기' }).click()
  await page.getByRole('button', { name: '주문 생성', exact: true }).click()

  await expect(page).toHaveURL(new RegExp(`/pos/orders/${orderId}$`))
  expect(tableRequests).toBeGreaterThan(0)
  expect(createdPayload).toEqual({
    orderChannel: 'POS',
    serviceType: 'DINE_IN',
    tableId,
    lines: [{ productId, quantity: 1 }],
  })
})

test('[mock-ui] keeps the idempotency key for a retry and rotates it for a changed payload', async ({
  page,
}) => {
  const keys: string[] = []
  let failNext = true

  await page.route('**/api/v1/catalog/menu', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: menuBody() })
  })
  await page.route('**/api/v1/orders', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    keys.push(route.request().headers()['idempotency-key'] ?? '')
    if (failNext) {
      failNext = false
      await route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status: 503, code: 'DEPENDENCY_UNAVAILABLE' }),
      })
      return
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(order),
    })
  })
  await page.route(`**/api/v1/orders/${orderId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(order),
    })
  })

  await page.goto('/pos/orders/new')
  await page.getByRole('button', { name: '담기' }).click()

  await page.getByRole('button', { name: '주문 생성', exact: true }).click()
  await expect(page.getByText('주문 서비스를 지금 사용할 수 없습니다.')).toBeVisible()

  // Same draft payload retried: the operation keeps its key.
  await page.getByRole('button', { name: '같은 주문 다시 시도' }).click()
  await expect(page).toHaveURL(new RegExp(`/pos/orders/${orderId}$`))
  expect(keys).toHaveLength(2)
  expect(keys[1]).toBe(keys[0])

  // A changed draft payload is a new operation and must not reuse the key.
  await page.goto('/pos/orders/new')
  await page.getByRole('button', { name: '담기' }).click()
  await page.getByRole('button', { name: '수량 늘리기' }).click()
  await page.getByRole('button', { name: '주문 생성', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/pos/orders/${orderId}$`))
  expect(keys).toHaveLength(3)
  expect(keys[2]).not.toBe(keys[1])
})

test('[mock-ui] completes an ACCEPTED order only after the server answers', async ({ page }) => {
  const accepted = { ...order, status: 'ACCEPTED' }
  const completed = { ...order, status: 'COMPLETED' }
  let completeRequests = 0
  let releaseComplete = () => {}
  const completeGate = new Promise<void>((resolve) => {
    releaseComplete = resolve
  })

  await page.route(`**/api/v1/orders/${orderId}/complete`, async (route) => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().postData()).toBeNull()
    completeRequests += 1
    await completeGate
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(completed),
    })
  })
  await page.route(`**/api/v1/orders/${orderId}`, async (route) => {
    expect(route.request().method()).toBe('GET')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(accepted),
    })
  })

  await page.goto(`/pos/orders/${orderId}`)
  await expect(page.getByText('주문 접수')).toBeVisible()
  await page.getByRole('button', { name: '주문 완료' }).click()

  // Nothing is optimistically applied while the command is in flight.
  await expect(page.getByRole('button', { name: '완료 확인 중…' })).toBeVisible()
  await expect(page.getByText('처리 완료', { exact: true })).toHaveCount(0)

  releaseComplete()
  await expect(page.getByText('처리 완료', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '주문 완료' })).toHaveCount(0)
  expect(completeRequests).toBe(1)
})

function menuBody() {
  return JSON.stringify({
    currency: 'KRW',
    categories: [
      {
        categoryId: 'category-1',
        name: '커피',
        displayOrder: 1,
        products: [{ productId, name: '아메리카노', description: '', price: 4500, displayOrder: 1 }],
      },
    ],
  })
}
