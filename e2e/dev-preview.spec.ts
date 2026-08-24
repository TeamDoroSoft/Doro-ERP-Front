import { expect, test } from '@playwright/test'

test('[mock-ui] shows only the employee login form without calling authentication', async ({ page }) => {
  let authRequestCount = 0
  await page.route('**/api/v1/auth/**', async (route) => {
    authRequestCount += 1
    await route.abort()
  })

  await page.goto('/pos/login')
  await expect(page).toHaveURL(/\/pos\/login$/)
  await expect(page.getByRole('heading', { name: '직원 로그인', exact: true })).toBeVisible()
  await expect(page.getByLabel('업체 코드')).toBeVisible()
  await expect(page.getByLabel('로그인 아이디')).toBeVisible()
  // The password field's accessible name includes the visibility toggle label ("비밀번호 비밀번호 보기").
  await expect(page.getByLabel(/^비밀번호/).and(page.locator('input[name="password"]'))).toBeVisible()
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible()
  expect(authRequestCount).toBe(0)
})
