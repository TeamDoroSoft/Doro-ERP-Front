import { expect, test } from '@playwright/test'

test('enters and exits the OWNER DEV preview without calling Backend auth', async ({ page }) => {
  let authRequestCount = 0
  await page.route('**/api/v1/auth/**', async (route) => {
    authRequestCount += 1
    await route.abort()
  })

  await page.goto('/login')
  await page.getByRole('button', { name: '관리자 화면 미리보기' }).click()

  await expect(page).toHaveURL(/\/admin\/dashboard$/)
  await expect(page.getByText('개발 미리보기')).toBeVisible()
  await expect(page.getByRole('link', { name: '직원 관리' })).toBeVisible()
  expect(authRequestCount).toBe(0)

  await page.getByRole('button', { name: '사용자 메뉴' }).click()
  await page.getByRole('button', { name: '로그아웃' }).click()

  await expect(page).toHaveURL(/\/login$/)
  expect(authRequestCount).toBe(0)
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('doro-erp.operator-session')))
    .toBeNull()
})
