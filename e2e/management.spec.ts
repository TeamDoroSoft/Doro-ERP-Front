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
    ['대기·조리 준비', '대기·조리'],
    ['상품·메뉴 준비', '상품·메뉴 관리'],
    ['테이블', '테이블 관리'],
    ['매출·마감 준비', '매출·마감'],
    ['매장·직원 설정 준비', '매장 설정'],
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

test('keeps management filters and action drawer usable at tablet width', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await page.goto('/pos/catalog')

  await expect(page.getByRole('heading', { name: '상품·메뉴 관리' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('overflow-x', 'visible')
  await page.getByRole('button', { name: '메뉴 등록' }).click()
  await expect(page.getByRole('complementary', { name: '새 상품 등록' })).toBeVisible()
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled()
})
