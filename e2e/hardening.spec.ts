import { expect, test } from '@playwright/test'

test('[mock-ui] session expiry clears employee state and removes sensitive location data', async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'doro-erp.operator-session',
      JSON.stringify({
        employeeId: 'staff-1',
        role: 'STAFF',
        tenantCode: 'DORO',
        passwordChangeRequired: false,
        isPreview: false,
      }),
    ),
  )
  await page.route('**/api/v1/orders', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({ code: 'UNAUTHENTICATED', detail: 'internal session diagnostic' }),
    }),
  )
  await page.goto('/pos/orders?paymentKey=must-not-survive#secret')
  // Only the safe internal path returns; the sensitive query and hash are dropped.
  await expect(page).toHaveURL(
    /\/pos\/login\?reason=session-expired&redirect=%2Fpos%2Forders$|\/pos\/login\?reason=session-expired&redirect=\/pos\/orders$/,
  )
  await expect(page).not.toHaveURL(/paymentKey|secret/)
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('doro-erp.operator-session')))
    .toBeNull()
  await expect(page.getByText('internal session diagnostic')).toHaveCount(0)
})

test('[mock-ui] direct kiosk customer routes do not restore sensitive customer state', async ({
  page,
}) => {
  await page.addInitScript(() => sessionStorage.setItem('doro.kiosk-device-active', '1'))
  await page.goto('/kiosk/payments/payment-from-bookmark?paymentKey=must-not-survive#secret')
  await expect(page).toHaveURL('/kiosk/payments/payment-from-bookmark')
  await expect(page.getByRole('heading', { name: '결제 정보를 찾을 수 없어요' })).toBeVisible()
  await expect(page).not.toHaveURL(/paymentKey|secret/)
})
