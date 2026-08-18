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

test('creates a takeout order with one idempotent command and opens server detail', async ({
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
  await expect(page.getByText('4,500 KRW')).toBeVisible()
  expect(createRequests).toBe(1)
  expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
})

test('opens a listed CREATED order and cancels it without an accept action', async ({ page }) => {
  const cancelled = { ...order, status: 'CANCELLED' }

  await page.route('**/api/v1/orders', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([order]),
    })
  })
  await page.route(`**/api/v1/orders/${orderId}*`, async (route) => {
    const isCancel = route.request().url().endsWith('/cancel')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isCancel ? cancelled : order),
    })
  })
  page.on('dialog', (dialog) => dialog.accept())

  await page.goto('/pos/orders')
  await page.getByRole('button', { name: /#7/ }).click()
  await page.getByRole('button', { name: '주문 취소' }).click()

  await expect(page.getByText('취소', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '주문 접수' })).toHaveCount(0)
})

test('creates a dine-in order with a selected table', async ({ page }) => {
  const tableId = 'table-1'
  let createBody: unknown

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
  await page.route('**/api/v1/tables', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: tableId, tableNumber: 'A-1', displayName: '창가', status: 'ACTIVE', version: 0 },
      ]),
    })
  })
  await page.route('**/api/v1/orders', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    createBody = route.request().postDataJSON()
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
  await page.getByLabel('활성 테이블').selectOption(tableId)
  await page.getByRole('button', { name: '담기' }).click()
  await page.getByRole('button', { name: '주문 생성', exact: true }).click()

  await expect(page).toHaveURL(new RegExp(`/pos/orders/${orderId}$`))
  expect(createBody).toEqual({
    orderChannel: 'POS',
    serviceType: 'DINE_IN',
    tableId,
    lines: [{ productId, quantity: 1 }],
  })
})

test('completes an ACCEPTED order once fulfillment is ready', async ({ page }) => {
  const accepted = { ...order, status: 'ACCEPTED' }
  const completed = { ...order, status: 'COMPLETED' }
  let completeRequests = 0

  await page.route(`**/api/v1/orders/${orderId}/complete`, async (route) => {
    completeRequests += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(completed),
    })
  })
  await page.route(`**/api/v1/orders/${orderId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(accepted),
    })
  })

  await page.goto(`/pos/orders/${orderId}`)
  await page.getByRole('button', { name: '주문 완료' }).click()

  await expect(page.getByText('처리 완료', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '주문 완료' })).toHaveCount(0)
  expect(completeRequests).toBe(1)
})
