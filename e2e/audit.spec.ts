import { expect, test } from '@playwright/test'

const auditRecord = {
  id: '0f6f9f0c-6a1f-4a2f-9a2b-2c9a0e4f3b71',
  sourceService: 'commerce',
  eventId: '9c7a3f2b-1e5d-4a2b-9c11-abcdef123456',
  action: 'ORDER_ACCEPTED',
  actor: {
    type: 'EMPLOYEE',
    id: '6a1f4a2f-9a2b-4c9a-0e4f-3b710f6f9f0c',
    role: 'MANAGER',
  },
  target: {
    type: 'ORDER',
    id: '3f2b9c7a-1e5d-4a2b-9c11-abcdef123456',
  },
  result: 'SUCCESS',
  reasonCode: null,
  metadata: { orderChannel: 'POS', itemCount: 3 },
  traceId: 'req-3f2b9c7a',
  occurredAt: '2026-08-07T09:00:00Z',
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'doro-erp.operator-session',
      JSON.stringify({
        employeeId: '6a1f4a2f-9a2b-4c9a-0e4f-3b710f6f9f0c',
        role: 'MANAGER',
        tenantCode: 'DORO-DEMO',
        passwordChangeRequired: false,
      }),
    )
  })
  await page.route('**/api/v1/audits/*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auditRecord) })
  })
  await page.route('**/api/v1/audits?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [auditRecord], nextCursor: null }),
    })
  })
})

test('[mock-ui] shows the audit list and detail drawer', async ({ page }) => {
  await page.goto('/pos/history')

  await expect(page.getByRole('heading', { name: '감사 이력', exact: true })).toBeVisible()
  await expect(page.getByText('주문 접수')).toBeVisible()
  await expect(page.getByText('commerce')).toBeVisible()

  await page.getByRole('button', { name: '감사 기록 상세 보기' }).click()
  await expect(page.getByRole('heading', { name: '감사 기록 상세' })).toBeVisible()
  await expect(page.getByText('orderChannel')).toBeVisible()
  await expect(page.locator('.metadata').getByText('POS', { exact: true })).toBeVisible()
})

test('[mock-ui] keeps the audit screen usable at tablet width', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await page.goto('/pos/history')

  await expect(page.getByRole('heading', { name: '감사 이력', exact: true })).toBeVisible()
  await expect(page.getByRole('form', { name: '감사 이력 필터' })).toBeVisible()
  await expect(page.locator('.table-scroll')).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('overflow-x', 'visible')
})
