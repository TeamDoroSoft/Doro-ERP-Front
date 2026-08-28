import { expect, test } from '@playwright/test'

test('[mock-ui] registers minimum contact data and displays only masked hints', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('doro.kiosk-device-active', '1'))
  await page.route('**/api/v1/kiosk/runtime', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        deviceId: 'entry-device',
        deviceName: '입장 대기 기기',
        mode: 'ENTRY_QUEUE',
        pairedPaymentDevice: null,
      }),
    }),
  )
  await page.route('**/api/v1/kiosk/entry-queues', async (route) => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
    expect(route.request().postDataJSON()).toEqual({
      partySize: 3,
      customerName: '김고객',
      phoneLastFour: '1278',
    })
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        entryId: '99000000-0000-4000-8000-000000000001',
        businessDate: '2026-08-28',
        queueNumber: 12,
        partySize: 3,
        customerNameMasked: '김**',
        phoneLastFourMasked: '**78',
        status: 'WAITING',
        version: 0,
        registeredAt: '2026-08-28T09:00:00Z',
      }),
    })
  })

  await page.goto('/kiosk/waiting')
  await page.getByLabel('인원수').fill('3')
  await page.getByLabel('예약자 이름').fill(' 김고객 ')
  await page.getByLabel('전화번호 뒷자리').fill('1278')
  await page.getByRole('button', { name: '대기 등록' }).click()

  await expect(page.getByRole('heading', { name: '대기번호 12' })).toBeVisible()
  await expect(page.getByText('김**', { exact: true })).toBeVisible()
  await expect(page.getByText('**78', { exact: true })).toBeVisible()
  await expect(page.getByText('김고객', { exact: true })).toHaveCount(0)
  await expect(page.getByText('1278', { exact: true })).toHaveCount(0)
})
