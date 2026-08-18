import { test, expect } from '@playwright/test'

// See here how to get started:
// https://playwright.dev/docs/intro
test('[mock-ui] shows the active table management screen', async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'doro-erp.operator-session',
      JSON.stringify({
        employeeId: '00000000-0000-4000-8000-000000000001',
        role: 'MANAGER',
        tenantCode: 'DORO-DEMO',
        passwordChangeRequired: false,
      }),
    ),
  )
  await page.route('**/api/v1/tables', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'table-1',
          tableNumber: 'A-1',
          displayName: '창가',
          status: 'ACTIVE',
          version: 0,
        },
      ]),
    })
  })

  await page.goto('/')
  await expect(page).toHaveURL(/\/pos\/orders$/)
  await expect(page.getByRole('heading', { name: '주문 목록' })).toBeVisible()

  await page.goto('/tables')
  await expect(page).toHaveURL(/\/pos\/tables$/)
  await expect(page.getByRole('heading', { name: '테이블 관리' })).toBeVisible()
  await expect(page.getByText('A-1')).toBeVisible()
  await expect(page.getByText('창가')).toBeVisible()
  await expect(page.getByRole('button', { name: '테이블 등록' })).toBeVisible()
})
