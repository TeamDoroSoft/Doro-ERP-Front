import { expect, test, type Page, type Route } from '@playwright/test'
const orderId = '11111111-1111-4111-8111-111111111111',
  paymentId = '33333333-3333-4333-8333-333333333333',
  providerOrderId = 'kiosk-provider-1'

test('[mock-ui] activates a separate kiosk and reaches the option-free TAKEOUT checkout', async ({
  page, browserName,
}) => {
  let orderBody: unknown
  const requests = await mocks(page, (b) => (orderBody = b))
  await mockTossSdk(page)
  await page.goto('/kiosk')
  await expect(page).toHaveURL(/kiosk\/activate/)
  await expect(page.locator('.sidebar')).toHaveCount(0)
  await page.getByLabel('업체 코드').fill('doro')
  await page.getByLabel('기기 코드').fill('K-1')
  await page.getByLabel('활성화 코드').fill('kdc_credential-id.one-time')
  await page.getByRole('button', { name: '기기 연결' }).click()
  await expect(page.getByRole('heading', { name: '메뉴', exact: true })).toBeVisible()
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
  await page.getByRole('button', { name: /담기/ }).click()
  await page.getByRole('link', { name: '주문 확인' }).click()
  await expect(page.getByText('총 2개')).toBeVisible()
  await page.getByRole('link', { name: '이용 방법 선택' }).click()
  await page.getByLabel('매장에서 먹기').check()
  await expect(page.getByText('창가 1번')).toBeVisible()
  await page.getByText('창가 1번').click()
  await page.getByLabel('포장하기').check()
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
  const callbackNavigation = page.waitForRequest(
    (request) => request.isNavigationRequest() && request.url().includes('paymentKey=e2e-key'),
  )
  await page.getByRole('button', { name: '결제하기' }).click()
  await callbackNavigation
  await expect(page).toHaveURL(new RegExp(`/kiosk/orders/${orderId}`))
  await expect(page.getByText('주문 확정')).toBeVisible()
  await expect(page.getByText('결제 완료')).toBeVisible()
  await expect(page.getByText('조리 중')).toBeVisible()
  expect(requests.confirmCalls).toBe(1)
  await page.getByRole('button', { name: '상태 새로고침' }).click()
  await expect(page.getByText('준비 완료')).toBeVisible()
  await expect(page.getByText(/초 후 다음 고객 화면/)).toBeVisible()
  if (browserName === 'chromium') {
    await page.screenshot({
      path: 'docs/screenshots/phase08/kiosk-order-status-portrait-ready.png',
      fullPage: true,
    })
  }
  await page.getByRole('button', { name: '새 주문 시작' }).click()
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
  await page.getByLabel('활성화 코드').fill('secret')
  await page.getByRole('button', { name: '기기 연결' }).click()
  await expect(page.getByText('기기를 연결하지 못했습니다. 입력 내용을 확인해 주세요.')).toBeVisible()
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
  await page.getByRole('button', { name: /담기/ }).click()
  await page.getByRole('link', { name: '주문 확인' }).click()
  await page.getByRole('link', { name: '이용 방법 선택' }).click()
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

test('[mock-ui] kiosk logout requires the activation code and preserves the POS session', async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('doro.kiosk-device-active', '1')
    sessionStorage.setItem(
      'doro-erp.operator-session',
      JSON.stringify({ employeeId: 'staff-1', role: 'STAFF', tenantCode: 'DORO' }),
    )
  })
  await page.route('**/api/v1/kiosk/runtime', (route) =>
    json(route, {
      deviceId: 'device-1',
      deviceName: 'K-1',
      mode: 'ORDER',
      pairedPaymentDevice: null,
    }),
  )
  await page.route('**/api/v1/catalog/menu', (route) =>
    json(route, { currency: 'KRW', categories: [] }),
  )
  let logoutCalls = 0
  await page.route('**/api/v1/kiosk-auth/logout', async (route) => {
    logoutCalls += 1
    const body = route.request().postDataJSON()
    if (body.secret !== 'one-time') {
      await route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        body: JSON.stringify({ code: 'KIOSK_AUTHENTICATION_FAILED', detail: 'internal' }),
      })
      return
    }
    await route.fulfill({ status: 204 })
  })

  await page.goto('/kiosk/order')
  await page.getByRole('button', { name: '로그아웃' }).click()
  const input = page.getByLabel('활성화 코드')
  await expect(input).toBeFocused()
  await input.fill('wrong')
  await page.getByRole('dialog').getByRole('button', { name: '로그아웃' }).click()
  await expect(page.getByRole('alert')).toContainText('활성화 코드')
  await expect(input).toHaveValue('')
  await expect(page).toHaveURL(/\/kiosk\/order$/)

  await input.fill('kdc_credential-id.one-time')
  await page.getByRole('dialog').getByRole('button', { name: '로그아웃' }).click()
  await expect(page).toHaveURL(/\/kiosk\/activate$/)
  expect(logoutCalls).toBe(2)
  expect(await page.evaluate(() => sessionStorage.getItem('doro.kiosk-device-active'))).toBeNull()
  expect(await page.evaluate(() => sessionStorage.getItem('doro-erp.operator-session'))).toContain(
    'staff-1',
  )
})

async function mocks(page: Page, capture: (body: unknown) => void) {
  const requests = { confirmCalls: 0 }
  let statusReads = 0
  await page.route('**/api/v1/kiosk-auth/activate', async (r) => {
    expect(r.request().postDataJSON()).toEqual({
      tenantCode: 'doro',
      deviceCode: 'K-1',
      secret: 'one-time',
    })
    await r.fulfill({ status: 204 })
  })
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
  await page.route(`**/api/v1/payments/${paymentId}`, (r) =>
    json(r, {
      id: paymentId,
      orderId,
      providerOrderId,
      amount: 9000,
      currency: 'KRW',
      status: 'PENDING',
    }),
  )
  await page.route(`**/api/v1/payments/${paymentId}/confirm`, (r) => {
    requests.confirmCalls += 1
    expect(r.request().postDataJSON()).toEqual({ paymentKey: 'e2e-key', amount: 9000 })
    expect(r.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
    return json(r, {
      id: paymentId,
      orderId,
      providerOrderId,
      amount: 9000,
      currency: 'KRW',
      status: 'PAID',
    })
  })
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
  return requests
}
async function mockTossSdk(page: Page) {
  await page.route('https://js.tosspayments.com/v2/standard**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `window.TossPayments=function(){return{widgets:function(){let amount;return{setAmount:async function(v){amount=v},renderPaymentWindow:async function(){return{on:function(n,cb){if(n==='paymentRequest')Promise.resolve().then(cb)}}},requestPayment:async function(r){const u=new URL(r.successUrl);u.searchParams.set('paymentKey','e2e-key');u.searchParams.set('orderId',r.orderId);u.searchParams.set('amount',String(amount.value));window.location.assign(u.toString())}}}}}`,
    }),
  )
}
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
