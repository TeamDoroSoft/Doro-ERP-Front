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

test('navigates every Phase 1 POS destination from the sidebar', async ({ page }) => {
  const screens = [
    ['주문 관리', '주문 목록'],
    ['대기·조리', '대기·조리'],
    ['상품·메뉴', '상품·메뉴 관리'],
    ['테이블', '테이블 관리'],
    ['매출·마감', '매출·마감'],
    ['매장·직원 설정', '매장 설정'],
    ['감사·보안 이력', '감사 이력'],
  ] as const

  await page.route('**/api/v1/tables', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/api/v1/audits?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[],"nextCursor":null}' }))
  await page.goto('/pos/orders')

  for (const [menu, heading] of screens) {
    await page.getByRole('link', { name: menu, exact: true }).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: menu, exact: true })).toHaveAttribute('aria-current', 'page')
  }
})

test('hides manager-only menu items and redirects STAFF away from a direct URL', async ({
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

  await expect(page.getByRole('link', { name: '테이블', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '매장·직원 설정', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '감사·보안 이력', exact: true })).toHaveCount(0)

  await page.goto('/pos/tables')

  await expect(page).toHaveURL(/\/pos\/orders\?reason=forbidden$/)
  await expect(
    page.getByText('현재 계정으로는 요청한 화면에 접근할 수 없습니다.', { exact: true }),
  ).toBeVisible()
})

test('keeps management filters and action drawer usable at tablet width', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await page.goto('/pos/catalog')

  await expect(page.getByRole('heading', { name: '상품·메뉴 관리' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('overflow-x', 'visible')
  await page.getByRole('button', { name: '메뉴 등록' }).click()
  await expect(page.getByRole('complementary', { name: '새 상품 등록' })).toBeVisible()
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled()
})
