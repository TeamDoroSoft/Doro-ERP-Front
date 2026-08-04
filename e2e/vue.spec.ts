import { expect, test } from '@playwright/test'

test('table operations screen connects to table APIs', async ({ page }) => {
  let tableListRequested = false
  await page.route('**/tables', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.continue()
      return
    }
    if (route.request().method() === 'GET') {
      tableListRequested = true
      await route.fulfill({
        json: [
          {
            tableId: 'table-a',
            tableNumber: 'A1',
            displayName: '창가',
            seatCapacity: 4,
            active: true,
            usageStatus: 'VACANT',
            version: 3,
          },
        ],
      })
      return
    }
    await route.fulfill({
      status: 201,
      json: {
        tableId: 'table-b',
        tableNumber: 'B2',
        displayName: '홀',
        seatCapacity: 2,
        active: true,
        usageStatus: 'VACANT',
        version: 1,
      },
    })
  })
  await page.route('**/tables/*/sessions/current/orders**', async (route) => {
    await route.fulfill({ json: { session: null, items: [], nextCursor: null } })
  })
  await page.route('**/tables/*/sessions/history**', async (route) => {
    await route.fulfill({ json: { items: [], nextCursor: null } })
  })

  await page.goto('/tables')

  await expect(page.getByRole('heading', { name: '테이블 운영' })).toBeVisible()
  await expect(page.getByRole('button', { name: /A1 창가/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '등록' })).toBeVisible()
  expect(tableListRequested).toBe(true)
})

test('qr landing removes fragment and uses the public verification API only', async ({ page }) => {
  let requestBody = ''
  await page.route('**/qr/table-access', async (route) => {
    requestBody = route.request().postData() ?? ''
    await route.fulfill({
      json: {
        accessible: true,
        store: { tenantId: 'qr-store' },
        table: { tableNumber: 'A1', displayName: '창가' },
        session: { sessionId: 'session-1' },
      },
    })
  })

  await page.goto('/qr#token=e2e-secret-token')

  await expect(page.getByText('테이블 접근이 확인됐습니다.')).toBeVisible()
  await expect(page.getByText('창가 · A1')).toBeVisible()
  expect(await page.evaluate(() => window.location.hash)).toBe('')
  expect(requestBody).toBe(JSON.stringify({ token: 'e2e-secret-token' }))
  await expect(page.getByText('e2e-secret-token')).toHaveCount(0)
})
