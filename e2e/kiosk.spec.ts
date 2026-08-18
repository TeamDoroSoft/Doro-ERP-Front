import { expect, test, type Page, type Route } from '@playwright/test'
const orderId = '11111111-1111-4111-8111-111111111111',
  paymentId = '33333333-3333-4333-8333-333333333333',
  providerOrderId = 'kiosk-provider-1'

test('[mock-ui] activates a separate kiosk and reaches the option-free TAKEOUT checkout', async ({
  page, browserName,
}) => {
  let orderBody: unknown
  await mocks(page, (b) => (orderBody = b))
  await mockTossSdk(page)
  await page.goto('/kiosk')
  await expect(page).toHaveURL(/kiosk\/activate/)
  await expect(page.locator('.sidebar')).toHaveCount(0)
  await page.getByLabel('업체 코드').fill('doro')
  await page.getByLabel('기기 코드').fill('K-1')
  await page.getByLabel('일회성 Secret').fill('one-time')
  await page.getByRole('button', { name: '기기 활성화' }).click()
  await expect(page.getByRole('heading', { name: '무엇을 드릴까요?' })).toBeVisible()
  await page.setViewportSize({ width: 768, height: 1024 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.setViewportSize({ width: 1366, height: 768 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  if (browserName === 'chromium') {
    await page.screenshot({
      path: 'docs/screenshots/phase08/kiosk-menu-landscape.png',
      fullPage: true,
    })
  }
  await expect(page.getByText(/옵션|토핑|사이즈/)).toHaveCount(0)
  await page.getByRole('button', { name: /아메리카노/ }).click()
  await expect(page.getByRole('button', { name: '상품 선택 닫기' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /아메리카노/ })).toBeFocused()
  await page.getByRole('button', { name: /아메리카노/ }).click()
  await page.getByRole('button', { name: '수량 늘리기' }).click()
  await page.getByRole('button', { name: /장바구니 담기/ }).click()
  await page.getByRole('link', { name: /장바구니/ }).click()
  await expect(page.getByText('총 2개')).toBeVisible()
  await page.getByRole('link', { name: '주문하기', exact: true }).click()
  await page.getByText('매장 이용', { exact: true }).click()
  await expect(page.getByText('창가 1번')).toBeVisible()
  await page.getByText('창가 1번').click()
  await page.getByText('포장', { exact: true }).click()
  if (browserName === 'chromium') {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.screenshot({
      path: 'docs/screenshots/phase08/kiosk-checkout-portrait.png',
      fullPage: true,
    })
  }
  await page.getByRole('button', { name: '주문하고 결제하기' }).click()
  await expect(page).toHaveURL(new RegExp(`/kiosk/payments/${paymentId}`))
  expect(orderBody).toEqual({
    orderChannel: 'KIOSK',
    serviceType: 'TAKEOUT',
    lines: [{ productId: 'p1', quantity: 2 }],
  })
  await expect(page.getByText('9,000원')).toBeVisible()
  await page.getByRole('button', { name: '결제하기' }).click()
  await expect(page).toHaveURL(new RegExp(`/kiosk/orders/${orderId}`))
  await expect(page.getByText('주문 접수')).toBeVisible()
  await expect(page.getByText('결제 완료')).toBeVisible()
  await expect(page.getByText('조리 중')).toBeVisible()
  await page.getByRole('button', { name: '수동 새로고침' }).click()
  await expect(page.getByText('준비 완료')).toBeVisible()
  await expect(page.getByText(/초 후 다음 고객 화면/)).toBeVisible()
  if (browserName === 'chromium') {
    await page.screenshot({
      path: 'docs/screenshots/phase08/kiosk-order-status-portrait-ready.png',
      fullPage: true,
    })
  }
  await page.getByRole('button', { name: '새 고객 시작' }).click()
  await expect(page).toHaveURL(/\/kiosk$/)
})

test('[mock-ui] blocks an invalid or revoked credential without revealing which one it is', async ({
  page,
}) => {
  await page.route('**/api/v1/kiosk-auth/activate', (r) =>
    r.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({ code: 'KIOSK_AUTHENTICATION_FAILED', detail: 'internal' }),
    }),
  )
  await page.goto('/kiosk/activate')
  await page.getByLabel('업체 코드').fill('doro')
  await page.getByLabel('기기 코드').fill('K-2')
  await page.getByLabel('일회성 Secret').fill('secret')
  await page.getByRole('button', { name: '기기 활성화' }).click()
  await expect(page.getByText('기기 인증에 실패했습니다. 입력 내용을 확인해주세요.')).toBeVisible()
  await expect(page.getByText('internal')).toHaveCount(0)
})

test('[mock-ui] a kiosk payment 401 never touches the employee POS session', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('doro.kiosk-device-active', '1')
    sessionStorage.setItem(
      'doro-erp.operator-session',
      JSON.stringify({
        employeeId: 'staff-1',
        role: 'STAFF',
        tenantCode: 'DORO',
        passwordChangeRequired: false,
        isPreview: false,
      }),
    )
  })
  await mocks(page, () => {})
  await page.unroute('**/api/v1/payments')
  await page.route('**/api/v1/payments', (r) =>
    r.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({ code: 'KIOSK_AUTHENTICATION_FAILED', detail: 'internal' }),
    }),
  )

  await page.goto('/kiosk')
  await page.getByRole('button', { name: /아메리카노/ }).click()
  await page.getByRole('button', { name: /장바구니 담기/ }).click()
  await page.getByRole('link', { name: /장바구니/ }).click()
  await page.getByRole('link', { name: '주문하기', exact: true }).click()
  await page.getByRole('button', { name: '주문하고 결제하기' }).click()

  // The kiosk returns to its own activation screen, never to the employee login.
  await expect(page).toHaveURL(/\/kiosk\/activate$/)
  await expect(page).not.toHaveURL(/\/pos\//)
  await expect(page.getByText('internal')).toHaveCount(0)
  // The employee session survives untouched and the stale ACTIVE hint is gone.
  expect(
    await page.evaluate(() => sessionStorage.getItem('doro-erp.operator-session')),
  ).toContain('staff-1')
  expect(await page.evaluate(() => sessionStorage.getItem('doro.kiosk-device-active'))).toBeNull()
})

async function mocks(page: Page, capture: (body: unknown) => void) {
  let statusReads = 0
  await page.route('**/api/v1/kiosk-auth/activate', (r) => r.fulfill({ status: 204 }))
  await page.route('**/api/v1/catalog/menu', (r) =>
    json(r, {
      currency: 'KRW',
      categories: [
        {
          categoryId: 'c1',
          name: '커피',
          displayOrder: 1,
          products: [
            {
              productId: 'p1',
              name: '아메리카노 매우 긴 메뉴 이름 테스트',
              description: '깔끔한 커피',
              price: 4500,
              displayOrder: 1,
            },
          ],
        },
      ],
    }),
  )
  await page.route('**/api/v1/tables', (r) =>
    json(r, [
      { id: 't1', tableNumber: '1', displayName: '창가 1번', status: 'ACTIVE', version: 1 },
    ]),
  )
  await page.route('**/api/v1/orders', async (r) => {
    capture(r.request().postDataJSON())
    expect(r.request().headers()['idempotency-key']).toBeTruthy()
    await json(
      r,
      {
        orderId,
        displayNumber: 104,
        totalAmount: 9000,
        currency: 'KRW',
        status: 'CREATED',
        businessDate: '2026-08-18',
        orderAccessToken: 'short-token',
      },
      201,
    )
  })
  await page.route('**/api/v1/payments', (r) =>
    json(
      r,
      { id: paymentId, orderId, providerOrderId, amount: 9000, currency: 'KRW', status: 'PENDING' },
      201,
    ),
  )
  await page.route(`**/api/v1/payments/${paymentId}/confirm`, (r) =>
    json(r, {
      id: paymentId,
      orderId,
      providerOrderId,
      amount: 9000,
      currency: 'KRW',
      status: 'PAID',
    }),
  )
  await page.route(`**/api/v1/orders/${orderId}`, (r) => {
    expect(r.request().headers()['x-order-access-token']).toBe('short-token')
    statusReads += 1
    return json(r, {
      orderId,
      displayNumber: 104,
      status: 'ACCEPTED',
      paymentStatus: 'PAID',
      fulfillmentStatus: statusReads > 1 ? 'READY' : 'PREPARING',
    })
  })
}
async function mockTossSdk(page: Page) {
  await page.route('https://js.tosspayments.com/v2/standard**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `window.TossPayments=function(){return{widgets:function(){let amount;return{setAmount:async function(v){amount=v},renderPaymentWindow:async function(){return{on:function(n,cb){if(n==='paymentRequest')Promise.resolve().then(cb)}}},requestPayment:async function(r){const u=new URL(r.successUrl);u.searchParams.set('paymentKey','e2e-key');u.searchParams.set('orderId',r.orderId);u.searchParams.set('amount',String(amount.value));history.pushState({},'',u.toString());window.dispatchEvent(new PopStateEvent('popstate'))}}}}}`,
    }),
  )
}
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
