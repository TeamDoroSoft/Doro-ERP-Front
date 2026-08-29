import { expect, test, type Page, type Route } from '@playwright/test'

const businessDate = '2026-08-18'
const ids = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('doro-erp.operator-session', JSON.stringify({
      employeeId: '00000000-0000-4000-8000-000000000001', role: 'MANAGER', tenantCode: 'DORO-DEMO', passwordChangeRequired: false,
    }))
  })
  await page.route('**/api/v1/store', (route) => fulfill(route, {
    id: 'store-1', tenantId: 'tenant-1', name: '도로', timezone: 'Asia/Seoul',
    currency: 'KRW', status: 'ACTIVE', businessDate,
  }))
})

test('[mock-ui] registers an entry and handles enter, cancel, and no-show from WAITING', async ({ page, browserName }) => {
  const entries = ids.map((entryId, index) => entry(entryId, index + 1))
  await page.route('**/api/v1/queues/entry?businessDate=*', (route) => {
    expect(new URL(route.request().url()).searchParams.get('businessDate')).toBe(businessDate)
    return fulfill(route, entries)
  })
  await page.route('**/api/v1/queues/entry', async (route) => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
    expect(route.request().postDataJSON()).toEqual({ businessDate, partySize: 4 })
    const created = entry('44444444-4444-4444-8444-444444444444', 4, 4)
    entries.push(created)
    await fulfill(route, created, 201)
  })
  for (const [index, action, status] of [
    [0, 'enter', 'ENTERED'], [1, 'cancel', 'CANCELLED'], [2, 'no-show', 'NO_SHOW'],
  ] as const) {
    await page.route(`**/api/v1/queues/entry/${ids[index]}/${action}`, async (route) => {
      expect(route.request().method()).toBe('POST')
      entries[index] = { ...entries[index]!, status, version: 1 }
      await fulfill(route, entries[index])
    })
  }

  await page.goto('/pos/queues/entry')
  await expect(page.getByRole('button', { name: '조리 현황 보기' })).toHaveCount(0)
  await page.getByLabel('영업일').fill(businessDate)
  await page.getByRole('button', { name: '새로고침' }).click()
  await expect(page.getByText('#1', { exact: true })).toBeVisible()
  await expect(row(page, '#1').getByRole('cell', { name: '김**', exact: true })).toBeVisible()
  await expect(row(page, '#1').getByRole('cell', { name: '**78', exact: true })).toBeVisible()

  await page.getByLabel('인원수').fill('4')
  await page.getByRole('button', { name: '등록', exact: true }).click()
  await expect(page.getByText('#4', { exact: true })).toBeVisible()
  if (browserName === 'chromium') {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.screenshot({
      path: 'docs/screenshots/phase08/pos-manager-queue-tablet-waiting.png',
      fullPage: true,
    })
  }

  await row(page, '#1').getByRole('button', { name: '입장 완료', exact: true }).click()
  await expect(row(page, '#1').getByText('입장 완료', { exact: true })).toBeVisible()
  await row(page, '#2').getByRole('button', { name: '취소', exact: true }).click()
  await expect(row(page, '#2').getByText('취소', { exact: true })).toBeVisible()
  await row(page, '#3').getByRole('button', { name: '미방문 처리', exact: true }).click()
  await expect(row(page, '#3').getByRole('cell', { name: '미방문', exact: true })).toBeVisible()
  await expect(row(page, '#1').getByRole('button', { name: '입장 완료', exact: true })).toBeDisabled()
})

test('[mock-ui] shows fulfillment event lag and moves only PREPARING to READY', async ({ page }) => {
  const items = [
    fulfillment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'PREPARING', 7),
    fulfillment('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'READY', 8),
    fulfillment('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'CANCELLED', 9),
  ]
  await page.route('**/api/v1/queues/fulfillment?businessDate=*', (route) => {
    expect(new URL(route.request().url()).searchParams.get('businessDate')).toBe(businessDate)
    return fulfill(route, items)
  })
  await page.route(`**/api/v1/queues/fulfillment/${items[0]!.fulfillmentId}/ready`, async (route) => {
    items[0] = { ...items[0]!, status: 'READY', version: 1 }
    await fulfill(route, items[0])
  })
  await page.goto('/pos/queues/fulfillment')
  await expect(page.getByRole('button', { name: '입장 대기 보기' })).toHaveCount(0)
  await expect(page.getByText('결제가 완료된 주문은 잠시 후 목록에 표시될 수 있습니다.', { exact: false })).toBeVisible()
  await row(page, '#7').getByRole('button', { name: '준비 완료' }).click()
  await expect(row(page, '#7').locator('td:nth-child(2)')).toHaveText('준비 완료')
  await expect(row(page, '#8').getByRole('button', { name: '준비 완료' })).toBeDisabled()
  await expect(row(page, '#9').getByText('취소', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /등록/ })).toHaveCount(0)
})

test('[mock-ui] renders empty entry and unavailable fulfillment states safely', async ({ page }) => {
  await page.route('**/api/v1/queues/entry?businessDate=*', (route) => fulfill(route, []))
  await page.goto('/pos/queues/entry')
  await page.getByLabel('영업일').fill(businessDate)
  await page.getByRole('button', { name: '새로고침' }).click()
  await expect(page.getByText('현재 입장 대기 중인 고객이 없습니다.')).toBeVisible()

  await page.route('**/api/v1/queues/fulfillment?businessDate=*', (route) => fulfill(route, { status: 503, code: 'DEPENDENCY_UNAVAILABLE', detail: 'internal host' }, 503))
  await page.goto('/pos/queues/fulfillment')
  await expect(page.getByText('조리 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')).toBeVisible()
  await expect(page.getByText('internal host')).toHaveCount(0)
})

function entry(entryId: string, queueNumber: number, partySize = 2) {
  return {
    entryId, businessDate, queueNumber, partySize,
    customerNameMasked: queueNumber === 1 ? '김**' : null,
    phoneLastFourMasked: queueNumber === 1 ? '**78' : null,
    status: 'WAITING', version: 0, registeredAt: '2026-08-18T09:00:00Z',
  }
}

function fulfillment(fulfillmentId: string, status: 'PREPARING' | 'READY' | 'CANCELLED', displayNumber: number) {
  return { fulfillmentId, orderId: `${displayNumber}0000000-0000-4000-8000-000000000000`, businessDate, displayNumber, status, version: 0 }
}

function row(page: Page, text: string) { return page.getByRole('row').filter({ hasText: text }) }
async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: status >= 400 ? 'application/problem+json' : 'application/json', body: JSON.stringify(body) })
}
