import { expect, test, type Page, type Route } from '@playwright/test'

const orderId = '11111111-1111-4111-8111-111111111111'
const paymentId = '33333333-3333-4333-8333-333333333333'
const providerOrderId = 'provider-order-123'
const amount = 12_000

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

test('starts from an order, confirms with a separate key, scrubs callback secrets, and returns', async ({
  page,
}) => {
  let confirmed = false
  let orderRequests = 0
  let createKey = ''
  let confirmKey = ''

  await mockOrder(page, () => {
    orderRequests += 1
    return confirmed ? 'ACCEPTED' : 'CREATED'
  })
  await mockTossSdk(page, 'success')
  await page.route('**/api/v1/payments', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    createKey = idempotencyKey(route)
    expect(route.request().postDataJSON()).toEqual({ orderId })
    await fulfillJson(route, payment('PENDING'), 201)
  })
  await page.route(`**/api/v1/payments/${paymentId}/confirm`, async (route) => {
    confirmKey = idempotencyKey(route)
    expect(route.request().postDataJSON()).toEqual({ paymentKey: 'e2e-payment-key', amount })
    confirmed = true
    await fulfillJson(route, payment('PAID'))
  })
  await page.route(`**/api/v1/payments/${paymentId}`, async (route) => {
    await fulfillJson(route, payment(confirmed ? 'PAID' : 'PENDING'))
  })

  await page.goto(`/pos/orders/${orderId}`)
  await page.getByRole('button', { name: '토스 결제 시작' }).click()

  await expect(page.getByRole('heading', { name: '결제가 완료되었습니다' })).toBeVisible()
  await expect(page).toHaveURL(/\/payments\/toss\/success\?flow=[^&]+$/)
  expect(createKey).toMatch(/^[0-9a-f-]{36}$/)
  expect(confirmKey).toMatch(/^[0-9a-f-]{36}$/)
  expect(confirmKey).not.toBe(createKey)

  await page.getByRole('button', { name: '주문으로 돌아가기' }).click()
  await expect(page).toHaveURL(new RegExp(`/pos/orders/${orderId}$`))
  await expect(page.getByText('결제 완료', { exact: true })).toBeVisible()
  await expect(page.getByText('주문 접수', { exact: true })).toBeVisible()
  expect(orderRequests).toBe(2)
})

test('keeps the created PENDING payment discoverable when Toss is cancelled', async ({ page }) => {
  let confirmRequests = 0
  await mockOrder(page, () => 'CREATED')
  await mockTossSdk(page, 'cancel')
  await mockPaymentCreate(page)
  await page.route(`**/api/v1/payments/${paymentId}/confirm`, async (route) => {
    confirmRequests += 1
    await route.abort()
  })
  await page.route(`**/api/v1/payments/${paymentId}`, async (route) => {
    await fulfillJson(route, payment('PENDING'))
  })

  await page.goto(`/pos/orders/${orderId}`)
  await page.getByRole('button', { name: '토스 결제 시작' }).click()
  await expect(page.getByRole('heading', { name: '결제가 취소되었습니다' })).toBeVisible()
  expect(confirmRequests).toBe(0)

  await page.getByRole('button', { name: '주문으로 돌아가기' }).click()
  await expect(page.getByText('결제 대기', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '토스 결제 시작' })).toHaveCount(0)
})

test('does not infer REVIEW_REQUIRED and lets the employee recheck it from the order', async ({
  page,
}) => {
  await mockOrder(page, () => 'CREATED')
  await mockTossSdk(page, 'success')
  await mockPaymentCreate(page)
  await page.route(`**/api/v1/payments/${paymentId}/confirm`, async (route) => {
    await fulfillJson(route, payment('REVIEW_REQUIRED'))
  })
  await page.route(`**/api/v1/payments/${paymentId}`, async (route) => {
    await fulfillJson(route, payment('REVIEW_REQUIRED'))
  })

  await page.goto(`/pos/orders/${orderId}`)
  await page.getByRole('button', { name: '토스 결제 시작' }).click()
  await expect(page.getByRole('heading', { name: '결제 확인이 필요합니다' })).toBeVisible()
  await page.getByRole('button', { name: '주문으로 돌아가기' }).click()

  await expect(page.getByText('결제 확인 필요', { exact: true })).toBeVisible()
  await expect(page.getByText('완료 또는 실패로 판단하지 않고', { exact: false })).toBeVisible()
})

test('cancels a PAID payment without optimistically cancelling the order', async ({ page }) => {
  let cancelKey = ''
  let orderRequests = 0
  await page.addInitScript(
    ({ storedOrderId, storedPaymentId }) => {
      sessionStorage.setItem(`doro.payment-order.${storedOrderId}`, storedPaymentId)
    },
    { storedOrderId: orderId, storedPaymentId: paymentId },
  )
  await mockOrder(page, () => {
    orderRequests += 1
    return 'ACCEPTED'
  })
  await page.route(`**/api/v1/payments/${paymentId}/cancel`, async (route) => {
    cancelKey = idempotencyKey(route)
    expect(route.request().postDataJSON()).toEqual({ reasonCode: 'CUSTOMER_REQUEST' })
    await fulfillJson(route, payment('CANCELLED'))
  })
  await page.route(`**/api/v1/payments/${paymentId}`, async (route) => {
    await fulfillJson(route, payment('PAID'))
  })

  await page.goto(`/pos/orders/${orderId}`)
  await expect(page.getByText('결제 완료', { exact: true })).toBeVisible()
  expect(orderRequests).toBe(1)
  await page.getByRole('button', { name: '전액 취소' }).click()

  await expect(page.getByText('결제 취소 요청이 처리되었습니다', { exact: false })).toBeVisible()
  await expect(page.getByText('주문 접수', { exact: true })).toBeVisible()
  await expect(page.getByText('취소', { exact: true })).toBeVisible()
  expect(cancelKey).toMatch(/^[0-9a-f-]{36}$/)
  expect(orderRequests).toBe(2)
})

async function mockOrder(page: Page, status: () => 'CREATED' | 'ACCEPTED') {
  await page.route(`**/api/v1/orders/${orderId}`, async (route) => {
    await fulfillJson(route, {
      orderId,
      displayNumber: 7,
      totalAmount: amount,
      currency: 'KRW',
      status: status(),
      businessDate: '2026-08-17',
      orderAccessToken: null,
    })
  })
}

async function mockPaymentCreate(page: Page) {
  await page.route('**/api/v1/payments', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    expect(route.request().postDataJSON()).toEqual({ orderId })
    expect(idempotencyKey(route)).toMatch(/^[0-9a-f-]{36}$/)
    await fulfillJson(route, payment('PENDING'), 201)
  })
}

async function mockTossSdk(page: Page, outcome: 'success' | 'cancel') {
  await page.route('https://js.tosspayments.com/v2/standard**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: tossSdkScript(outcome),
    })
  })
}

function tossSdkScript(outcome: 'success' | 'cancel') {
  return `
    window.TossPayments = function () {
      return {
        widgets: function () {
          let configuredAmount;
          return {
            setAmount: async function (amount) { configuredAmount = amount; },
            renderPaymentWindow: async function () {
              return {
                on: function (eventName, callback) {
                  if (eventName === 'paymentRequest') Promise.resolve().then(callback);
                }
              };
            },
            requestPayment: async function (request) {
              const target = new URL(${JSON.stringify(outcome)} === 'cancel' ? request.failUrl : request.successUrl);
              if (${JSON.stringify(outcome)} === 'cancel') {
                target.searchParams.set('code', 'PAY_PROCESS_CANCELED');
                target.searchParams.set('message', 'untrusted provider message');
              } else {
                target.searchParams.set('paymentKey', 'e2e-payment-key');
                target.searchParams.set('orderId', request.orderId);
                target.searchParams.set('amount', String(configuredAmount.value));
              }
              window.location.assign(target.toString());
            }
          };
        }
      };
    };
  `
}

function idempotencyKey(route: Route): string {
  return route.request().headers()['idempotency-key'] ?? ''
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

function payment(status: 'PENDING' | 'PAID' | 'REVIEW_REQUIRED' | 'CANCELLED') {
  return { id: paymentId, orderId, providerOrderId, amount, currency: 'KRW', status }
}
