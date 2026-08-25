import { expect, test, type Page, type Route } from '@playwright/test'

const tenantId = '11111111-1111-4111-8111-111111111111'
const storeId = '22222222-2222-4222-8222-222222222222'

test('[mock-ui] unauthenticated operator receives the Admin Edge login CTA', async ({ page }) => {
  await page.route('**/api/v1/provider/auth/me', (route) => problem(route, 401, 'UNAUTHENTICATED'))

  await page.goto('/admin.html')

  await expect(page.getByRole('heading', { name: '관리자 인증이 필요합니다' })).toBeVisible()
  const login = page.getByRole('link', { name: '관리자 로그인' })
  await expect(login).toHaveAttribute('href', '/api/v1/provider/auth/login')
  await expect(page.getByRole('heading', { name: '업체 목록' })).toHaveCount(0)
})

test('[mock-ui] creates a tenant and first OWNER, then disables and re-enables it', async ({ page }) => {
  const requests: Array<{ method: string; path: string; body?: unknown }> = []
  let ownerRequired = true
  let status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'
  await installAuthenticatedApi(page, requests, () => ({ ownerRequired, status }), (next) => {
    ownerRequired = next.ownerRequired
    status = next.status
  })

  await page.goto('/admin.html')
  await expect(page.getByRole('heading', { name: '업체 목록' })).toBeVisible()
  await expect(page.getByText('도로 신규')).toBeVisible()

  await page.getByRole('button', { name: '신규 업체 등록' }).click()
  await page.getByLabel('업체 코드').fill('doro-new')
  await page.getByLabel('업체명').fill('도로 신규')
  await page.getByLabel('첫 매장명').fill('서울 본점')
  await page.getByRole('button', { name: '업체 및 매장 등록' }).click()
  await expect(page.getByRole('heading', { name: '도로 신규' })).toBeVisible()
  await expect(page.getByText('최초 관리자 계정을 등록해 주세요.')).toBeVisible()

  const temporaryPassword = 'Browser-only-secret!42'
  await page.getByLabel('로그인 ID').fill('first-owner')
  await page.getByLabel('임시 비밀번호').fill(temporaryPassword)
  await page.getByRole('button', { name: '최초 관리자 등록' }).click()
  await expect(page.getByRole('heading', { name: '등록 완료' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(temporaryPassword)
  expect(await page.content()).not.toContain(temporaryPassword)

  await page.getByRole('button', { name: '업체 이용 중지' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click()
  await expect(page.getByText('업체 상태가 이용 중지으로 변경되었습니다.')).toBeVisible()
  await expect(page.getByRole('button', { name: '업체 이용 재개' })).toBeVisible()

  await page.getByRole('button', { name: '업체 이용 재개' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click()
  await expect(page.getByText('업체 상태가 운영 중으로 변경되었습니다.')).toBeVisible()

  expect(requests).toContainEqual({
    method: 'POST',
    path: '/api/v1/provider/tenants',
    body: {
      tenantCode: 'doro-new',
      tenantName: '도로 신규',
      storeName: '서울 본점',
      timezone: 'Asia/Seoul',
    },
  })
  expect(requests).toContainEqual({
    method: 'POST',
    path: `/api/v1/provider/tenants/${tenantId}/first-owner`,
    body: { loginId: 'first-owner', temporaryPassword },
  })
  expect(requests.filter(({ method, path }) => method === 'PATCH' && path.endsWith('/status')).map(({ body }) => body)).toEqual([
    { status: 'INACTIVE' },
    { status: 'ACTIVE' },
  ])
})

test('[mock-ui] an expired session fails closed without exposing Problem Details', async ({ page }) => {
  const rawDetail = 'provider-hmac=raw-secret-value; upstream stack trace'
  await page.route('**/api/v1/provider/auth/me', (route) => json(route, session()))
  await page.route('**/api/v1/provider/tenants?**', (route) =>
    problem(route, 401, 'UNAUTHENTICATED', rawDetail),
  )

  await page.goto('/admin.html')

  await expect(page.getByRole('heading', { name: '관리자 인증이 필요합니다' })).toBeVisible()
  await expect(page.getByText('관리자 세션이 만료되었습니다. 다시 로그인해 주세요.')).toBeVisible()
  await expect(page.getByRole('link', { name: '관리자 로그인' })).toHaveAttribute(
    'href',
    '/api/v1/provider/auth/login',
  )
  await expect(page.getByRole('heading', { name: '업체 목록' })).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(rawDetail)
  await expect(page.locator('body')).not.toContainText('raw-secret-value')
})

async function installAuthenticatedApi(
  page: Page,
  requests: Array<{ method: string; path: string; body?: unknown }>,
  state: () => { ownerRequired: boolean; status: 'ACTIVE' | 'INACTIVE' },
  update: (state: { ownerRequired: boolean; status: 'ACTIVE' | 'INACTIVE' }) => void,
) {
  await page.route('**/api/v1/provider/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const path = url.pathname
    const body = request.postData() ? request.postDataJSON() : undefined
    requests.push({ method, path, ...(body === undefined ? {} : { body }) })

    if (method === 'GET' && path.endsWith('/auth/me')) return json(route, session())
    if (method === 'GET' && path.endsWith(`/tenants/${tenantId}`)) {
      return json(route, tenantDetail(state()))
    }
    if (method === 'GET' && path.endsWith('/tenants')) {
      return json(route, tenantPage(state()))
    }
    if (method === 'POST' && path.endsWith('/tenants')) {
      update({ ownerRequired: true, status: 'ACTIVE' })
      return json(route, {
        tenantId,
        storeId,
        tenantCode: 'doro-new',
        tenantName: '도로 신규',
        storeName: '서울 본점',
        timezone: 'Asia/Seoul',
        currency: 'KRW',
      }, 201)
    }
    if (method === 'POST' && path.endsWith('/first-owner')) {
      update({ ...state(), ownerRequired: false })
      return json(route, {
        employeeId: '33333333-3333-4333-8333-333333333333',
        loginId: 'first-owner',
        role: 'OWNER',
        status: 'ACTIVE',
        passwordChangeRequired: true,
      }, 201)
    }
    if (method === 'PATCH' && path.endsWith('/status')) {
      const nextStatus = (body as { status: 'ACTIVE' | 'INACTIVE' }).status
      update({ ...state(), status: nextStatus })
      return json(route, { tenantId, status: nextStatus })
    }
    return problem(route, 404, 'TEST_ROUTE_NOT_FOUND')
  })
}

function session() {
  return { adminId: '90000000-0000-4000-8000-000000000009', expiresAt: '2026-08-25T12:00:00Z' }
}

function tenantPage(state: { ownerRequired: boolean; status: 'ACTIVE' | 'INACTIVE' }) {
  return {
    items: [tenantDetail(state)],
    page: 0,
    size: 20,
    totalCount: '1',
    totalPages: '1',
  }
}

function tenantDetail(state: { ownerRequired: boolean; status: 'ACTIVE' | 'INACTIVE' }) {
  return {
    tenantId,
    tenantCode: 'doro-new',
    name: '도로 신규',
    status: state.status,
    createdAt: '2026-08-25T00:00:00Z',
    updatedAt: '2026-08-25T00:00:00Z',
    store: { storeId, name: '서울 본점', status: state.status },
    firstOwnerRequired: state.ownerRequired,
  }
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

function problem(route: Route, status: number, code: string, detail = 'raw internal detail') {
  return route.fulfill({
    status,
    contentType: 'application/problem+json',
    body: JSON.stringify({ status, code, detail }),
  })
}
