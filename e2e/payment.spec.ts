import { mkdir } from 'node:fs/promises'
import { expect, test, type Page, type Route } from '@playwright/test'

const screenshotDirectory = 'playwright-report/screenshots'
const orderId = '11111111-1111-4111-8111-111111111111'
const paymentId = '33333333-3333-4333-8333-333333333333'
const providerOrderId = 'provider-order-123'
const amount = 12_000

test.beforeAll(async () => {
  await mkdir(screenshotDirectory, { recursive: true })
})

test('completes the mocked Edge and Toss payment flow', async ({ page }) => {
  let createRequests = 0
  let confirmRequests = 0
  let releaseCreate!: () => void
  const createBlocked = new Promise<void>((resolve) => {
    releaseCreate = resolve
  })

  await mockTossSdk(page, 'success')
  await page.route('**/api/v1/payments', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    createRequests += 1
    assertExternalPaymentRequest(route)
    await createBlocked
    await fulfillJson(route, paymentResponse('PENDING'), 201)
  })
  await page.route(`**/api/v1/payments/${paymentId}/confirm`, async (route) => {
    confirmRequests += 1
    assertExternalPaymentRequest(route)
    expect(route.request().postDataJSON()).toEqual({ paymentKey: 'e2e-payment-key', amount })
    await fulfillJson(route, paymentResponse('PAID'))
  })

  await page.goto('/payments/test')
  await expect(page.getByRole('heading', { name: '직원 테스트 결제' })).toBeVisible()
  await page.screenshot({ path: `${screenshotDirectory}/payment-initial.png`, fullPage: true })
  await fillPayment(page)
  await page.getByRole('button', { name: '결제하기' }).click()

  await expect(page.getByRole('button', { name: '결제 준비 중…' })).toBeDisabled()
  await page.screenshot({ path: `${screenshotDirectory}/payment-processing.png`, fullPage: true })

  releaseCreate()
  await expect(page.getByRole('heading', { name: '결제가 완료되었습니다' })).toBeVisible()
  await expect(page.getByText('PAID', { exact: true })).toBeVisible()
  await page.screenshot({ path: `${screenshotDirectory}/payment-success.png`, fullPage: true })

  expect(createRequests).toBe(1)
  expect(confirmRequests).toBe(1)
})

test('shows Payment creation failure without opening Toss', async ({ page }) => {
  let tossScriptRequested = false
  await page.route('https://js.tosspayments.com/v2/standard**', async (route) => {
    tossScriptRequested = true
    await route.abort()
  })
  await page.route('**/api/v1/payments', async (route) => {
    await fulfillJson(
      route,
      { code: 'ORDER_NOT_ELIGIBLE', title: '결제할 수 없는 주문', status: 422 },
      422,
      'application/problem+json',
    )
  })

  await openAndSubmit(page)

  await expect(page.getByText('결제 생성 실패', { exact: true })).toBeVisible()
  await expect(page.getByText('현재 결제할 수 없는 주문입니다.')).toBeVisible()
  await page.screenshot({
    path: `${screenshotDirectory}/payment-create-failure.png`,
    fullPage: true,
  })
  expect(tossScriptRequested).toBe(false)
})

test('shows Toss user cancellation and skips confirm', async ({ page }) => {
  let confirmRequests = 0
  await mockTossSdk(page, 'cancel')
  await mockPaymentCreate(page)
  await page.route('**/api/v1/payments/*/confirm', async (route) => {
    confirmRequests += 1
    await route.abort()
  })

  await openAndSubmit(page)

  await expect(page.getByRole('heading', { name: '결제가 취소되었습니다' })).toBeVisible()
  await expect(page.getByText('PAY_PROCESS_CANCELED', { exact: false })).toBeVisible()
  expect(confirmRequests).toBe(0)
})

test('rejects a modified amount before confirm', async ({ page }) => {
  let confirmRequests = 0
  await mockTossSdk(page, 'tamperedAmount')
  await mockPaymentCreate(page)
  await page.route('**/api/v1/payments/*/confirm', async (route) => {
    confirmRequests += 1
    await route.abort()
  })

  await openAndSubmit(page)

  await expect(page.getByRole('heading', { name: '결제 정보 검증 실패' })).toBeVisible()
  await expect(page.getByText('주문 ID 또는 금액', { exact: false })).toBeVisible()
  expect(confirmRequests).toBe(0)
})

test('shows Backend confirm failure with a retry action', async ({ page }) => {
  await mockTossSdk(page, 'success')
  await mockPaymentCreate(page)
  await page.route('**/api/v1/payments/*/confirm', async (route) => {
    await fulfillJson(
      route,
      { code: 'PAYMENT_UNAVAILABLE', title: '결제 서비스 사용 불가', status: 503 },
      503,
      'application/problem+json',
    )
  })

  await openAndSubmit(page)

  await expect(
    page.getByRole('heading', { name: '결제 서비스를 확인할 수 없습니다' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '승인 다시 시도' })).toBeVisible()
  await page.screenshot({
    path: `${screenshotDirectory}/payment-confirm-failure.png`,
    fullPage: true,
  })
})

test('prevents duplicate payment creation clicks', async ({ page }) => {
  let createRequests = 0
  let releaseCreate!: () => void
  const createBlocked = new Promise<void>((resolve) => {
    releaseCreate = resolve
  })
  await mockTossSdk(page, 'cancel')
  await page.route('**/api/v1/payments', async (route) => {
    createRequests += 1
    await createBlocked
    await fulfillJson(route, paymentResponse('PENDING'), 201)
  })

  await page.goto('/payments/test')
  await fillPayment(page)
  const button = page.getByRole('button', { name: '결제하기' })
  await button.click()
  await expect(page.getByRole('button', { name: '결제 준비 중…' })).toBeDisabled()
  await page
    .locator('button[type="submit"]')
    .evaluate((element: HTMLButtonElement) => element.click())
  expect(createRequests).toBe(1)

  releaseCreate()
  await expect(page.getByRole('heading', { name: '결제가 취소되었습니다' })).toBeVisible()
  expect(createRequests).toBe(1)
})

async function openAndSubmit(page: Page) {
  await page.goto('/payments/test')
  await fillPayment(page)
  await page.getByRole('button', { name: '결제하기' }).click()
}

async function fillPayment(page: Page) {
  await page.getByLabel('주문 ID *').fill(orderId)
  await page.getByLabel('주문 번호').fill('A-001')
  await page.getByLabel('표시 금액 (KRW) *').fill(String(amount))
}

async function mockPaymentCreate(page: Page) {
  await page.route('**/api/v1/payments', async (route) => {
    assertExternalPaymentRequest(route)
    expect(route.request().postDataJSON()).toEqual({ orderId })
    await fulfillJson(route, paymentResponse('PENDING'), 201)
  })
}

async function mockTossSdk(page: Page, outcome: 'success' | 'cancel' | 'tamperedAmount') {
  await page.route('https://js.tosspayments.com/v2/standard**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: tossSdkScript(outcome),
    })
  })
}

function tossSdkScript(outcome: 'success' | 'cancel' | 'tamperedAmount') {
  return `
    window.TossPayments = function () {
      return {
        widgets: function () {
          let configuredAmount;
          return {
            setAmount: async function (amount) {
              configuredAmount = amount;
            },
            renderPaymentWindow: async function () {
              return {
                on: function (eventName, callback) {
                  if (eventName === 'paymentRequest') {
                    Promise.resolve().then(function () {
                      return callback({ paymentMethod: { code: 'CARD' } });
                    });
                  }
                },
                destroy: async function () {}
              };
            },
            requestPayment: async function (request) {
              const outcome = ${JSON.stringify(outcome)};
              const target = new URL(outcome === 'cancel' ? request.failUrl : request.successUrl);
              if (outcome === 'cancel') {
                target.searchParams.set('code', 'PAY_PROCESS_CANCELED');
                target.searchParams.set('message', 'mocked cancellation');
              } else {
                target.searchParams.set('paymentKey', 'e2e-payment-key');
                target.searchParams.set('orderId', request.orderId);
                target.searchParams.set('amount', String(configuredAmount.value + (outcome === 'tamperedAmount' ? 1 : 0)));
              }
              window.location.assign(target.toString());
            }
          };
        }
      };
    };
  `
}

function assertExternalPaymentRequest(route: Route) {
  const headers = route.request().headers()
  expect(headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
  expect(headers.authorization).toBeUndefined()
  expect(Object.keys(headers).some((name) => name.startsWith('x-doro-'))).toBe(false)
}

async function fulfillJson(
  route: Route,
  body: unknown,
  status = 200,
  contentType = 'application/json',
) {
  await route.fulfill({ status, contentType, body: JSON.stringify(body) })
}

function paymentResponse(status: 'PENDING' | 'PAID') {
  return {
    id: paymentId,
    orderId,
    providerOrderId,
    amount,
    currency: 'KRW',
    status,
  }
}
