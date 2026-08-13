import { test, expect } from '@playwright/test'

// See here how to get started:
// https://playwright.dev/docs/intro
test('shows the active table management screen', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('doro-erp.employee-role', 'MANAGER'))
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
  await expect(page).toHaveURL(/\/tables$/)
  await expect(page.getByRole('heading', { name: '테이블 관리' })).toBeVisible()
  await expect(page.getByText('A-1')).toBeVisible()
  await expect(page.getByText('창가')).toBeVisible()
  await expect(page.getByRole('button', { name: '테이블 등록' })).toBeVisible()
})
