import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'doro-erp.operator-session',
      JSON.stringify({
        employeeId: '00000000-0000-4000-8000-000000000001',
        role: 'OWNER',
        tenantCode: 'DORO-DEMO',
        passwordChangeRequired: false,
      }),
    )
  })
})

test('[mock-ui] navigates every Phase 1 POS destination from the sidebar', async ({ page, browserName }) => {
  const screens = [
    ['주문 관리', '주문'],
    ['대기·조리', '입장 대기 관리'],
    ['상품·메뉴', '상품·메뉴 관리'],
    ['테이블', '테이블 관리'],
    ['매출·마감', '일별 매출과 마감'],
    ['매장·직원 설정', '매장·직원 설정'],
    ['운영·보안 기록', '운영 변경 내역'],
  ] as const

  await page.route('**/api/v1/tables', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/api/v1/audits?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[],"nextCursor":null}' }))
  await page.route('**/api/v1/sales/daily?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"businessDate":"2026-08-18","grossSales":184500,"netSales":172500,"refundAmount":12000,"orderCount":37,"closed":false}' }))
  await page.route('**/api/v1/sales/closings/*', (route) => route.fulfill({ status: 404, contentType: 'application/problem+json', body: '{"code":"CLOSING_NOT_FOUND"}' }))
  await page.goto('/pos/orders')

  for (const [menu, heading] of screens) {
    // Sidebar links whose feature is still `ready: false` append a "준비" badge to the
    // accessible name (see PosSidebar.vue), so match the label as a prefix, not exact.
    const menuLink = page.getByRole('link', { name: new RegExp(`^${menu}`) })
    await menuLink.click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(menuLink).toHaveAttribute('aria-current', 'page')
    if (browserName === 'chromium' && menu === '매출·마감') {
      await page.screenshot({
        path: 'docs/screenshots/phase08/pos-owner-sales-desktop.png',
        fullPage: true,
      })
    }
  }
})

test('[mock-ui] hides manager-only menu items and redirects STAFF away from a direct URL', async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'doro-erp.operator-session',
      JSON.stringify({
        employeeId: '00000000-0000-4000-8000-000000000002',
        role: 'STAFF',
        tenantCode: 'DORO-DEMO',
        passwordChangeRequired: false,
      }),
    )
  })
  await page.route('**/api/v1/orders*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.goto('/pos/orders')

  await expect(page.getByRole('link', { name: /^테이블/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^매장·직원 설정/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^운영·보안 기록/ })).toHaveCount(0)

  await page.goto('/pos/tables')

  await expect(page).toHaveURL(/\/pos\/orders\?reason=forbidden$/)
  await expect(
    page.getByText('현재 계정으로는 요청한 화면에 접근할 수 없습니다.', { exact: true }),
  ).toBeVisible()
})

test('[mock-ui] keeps the implemented Catalog editor usable at tablet width', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await page.route('**/api/v1/catalog/categories', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[{"categoryId":"11111111-1111-4111-8111-111111111111","name":"커피","displayOrder":1,"active":true,"version":0}]' }))
  await page.route('**/api/v1/catalog/products', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.goto('/pos/catalog')

  await expect(page.getByRole('heading', { name: '상품·메뉴 관리' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('overflow-x', 'visible')
  await page.getByRole('button', { name: '분류 등록' }).click()
  await expect(page.getByRole('heading', { name: '메뉴 분류 등록' })).toBeVisible()
  await expect(page.getByLabel('분류명')).toBeVisible()
})
