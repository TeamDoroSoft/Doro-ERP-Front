import { expect, test, type Page, type Route } from '@playwright/test'

const categoryId = '11111111-1111-4111-8111-111111111111'
const productId = '22222222-2222-4222-8222-222222222222'
const category = { categoryId, name: '커피', displayOrder: 1, active: true, version: 0 }
const product = { productId, categoryId, name: '라테', description: '', price: 5000, soldOut: false, active: true, displayOrder: 1, version: 0 }

test('[mock-ui] OWNER creates and updates Catalog data and changes sold-out state', async ({ page, browserName }) => {
  await session(page, 'OWNER')
  const categories = [{ ...category }]
  const products = [{ ...product }]
  await catalogRoutes(page, categories, products)
  await page.goto('/pos/catalog')
  await expect(page.getByRole('heading', { name: '상품·메뉴 관리' })).toBeVisible()

  await page.getByRole('button', { name: '분류 등록' }).click()
  let editor = page.locator('.editor').filter({ has: page.getByRole('heading', { name: '메뉴 분류 등록' }) })
  await editor.getByLabel('분류명').fill('디저트'); await editor.getByLabel('표시 순서').fill('2'); await editor.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('디저트', { exact: true })).toBeVisible()

  const coffee = page.locator('.category-list li').filter({ hasText: '커피' })
  await coffee.getByRole('button', { name: '수정' }).click()
  editor = page.locator('.editor').filter({ has: page.getByRole('heading', { name: '메뉴 분류 수정' }) })
  await editor.getByLabel('분류명').fill('커피·차'); await editor.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('커피·차', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '상품 등록' }).click()
  const productEditor = page.locator('.editor').filter({ has: page.getByRole('heading', { name: '상품 등록' }) })
  await productEditor.getByLabel('상품명').fill('아메리카노'); await productEditor.getByLabel('가격').fill('4500'); await productEditor.getByLabel('표시 순서').fill('2'); await productEditor.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('아메리카노', { exact: true })).toBeVisible()

  let latte = page.getByRole('row').filter({ hasText: '라테' })
  await latte.getByRole('button', { name: '수정' }).click()
  const editProduct = page.locator('.editor').filter({ has: page.getByRole('heading', { name: '상품 수정' }) })
  await editProduct.getByLabel('상품명').fill('카페라테'); await editProduct.getByLabel('가격').fill('5500'); await editProduct.getByRole('button', { name: '저장' }).click()
  latte = page.getByRole('row').filter({ hasText: '카페라테' }); await expect(latte.getByText('₩5,500')).toBeVisible()
  await latte.getByRole('button', { name: '판매 중지' }).click(); await expect(latte.getByText('판매 중지', { exact: true })).toBeVisible()
  await latte.getByRole('button', { name: '품절 처리' }).click()
  await expect(latte.getByText('품절', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '삭제' })).toHaveCount(0)
  if (browserName === 'chromium') {
    await page.screenshot({
      path: 'docs/screenshots/phase08/pos-owner-catalog-desktop.png',
      fullPage: true,
    })
  }
})

test('[mock-ui] STAFF can change sold-out but cannot open Catalog management forms', async ({ page }) => {
  await session(page, 'STAFF'); const categories = [{ ...category }]; const products = [{ ...product }]
  await catalogRoutes(page, categories, products); await page.goto('/pos/catalog')
  await expect(page.getByRole('button', { name: '분류 등록' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '상품 등록' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '수정' })).toHaveCount(0)
  await page.getByRole('button', { name: '품절 처리' }).click()
  await expect(page.getByRole('cell', { name: '품절', exact: true })).toBeVisible()
})

test('[mock-ui] MANAGER manages active tables, sees conflict, and STAFF is route-guarded', async ({ browser }) => {
  const manager = await browser.newPage(); await session(manager, 'MANAGER')
  const tables = [{ id: '33333333-3333-4333-8333-333333333333', tableNumber: 'A-1', displayName: '창가', status: 'ACTIVE', version: 0 }]
  await manager.route('**/api/v1/tables', async (route) => {
    if (route.request().method() === 'GET') return fulfill(route, tables)
    const created = { ...tables[0]!, id: '44444444-4444-4444-8444-444444444444', ...route.request().postDataJSON() }; tables.push(created); await fulfill(route, created)
  })
  await manager.route(`**/api/v1/tables/${tables[0]!.id}`, async (route) => { Object.assign(tables[0]!, route.request().postDataJSON()); await fulfill(route, tables[0]) })
  await manager.route(`**/api/v1/tables/${tables[0]!.id}/status`, (route) => fulfill(route, { status: 409, code: 'TABLE_HAS_ACTIVE_ORDER', detail: 'raw' }, 409))
  await manager.goto('/pos/tables'); await manager.getByRole('button', { name: '테이블 등록' }).click()
  await manager.getByLabel('테이블 번호').fill('B-2'); await manager.getByLabel('표시 이름').fill('홀'); await manager.getByRole('button', { name: '저장' }).click(); await expect(manager.getByText('B-2')).toBeVisible()
  await manager.getByRole('button', { name: '수정' }).first().click(); await manager.getByLabel('표시 이름').fill('중앙'); await manager.getByRole('button', { name: '저장' }).click(); await expect(manager.getByText('중앙')).toBeVisible()
  manager.on('dialog', (dialog) => dialog.accept()); await manager.getByRole('button', { name: '이용 중지' }).first().click(); await expect(manager.getByText('진행 중인 주문이 있어', { exact: false })).toBeVisible(); await expect(manager.getByText('A-1')).toBeVisible()

  const staff = await browser.newPage(); await session(staff, 'STAFF'); await staff.goto('/pos/tables'); await expect(staff).toHaveURL(/\/pos\/orders\?reason=forbidden/)
})

async function catalogRoutes(page: Page, categories: typeof category[], products: typeof product[]) {
  await page.route('**/api/v1/catalog/categories', async (route) => {
    if (route.request().method() === 'GET') return fulfill(route, categories)
    const created = { ...route.request().postDataJSON(), categoryId: '55555555-5555-4555-8555-555555555555', version: 0 }; categories.push(created); await fulfill(route, created, 201)
  })
  await page.route(`**/api/v1/catalog/categories/${categoryId}`, async (route) => { Object.assign(categories[0]!, route.request().postDataJSON(), { version: categories[0]!.version + 1 }); await fulfill(route, categories[0]) })
  await page.route('**/api/v1/catalog/products', async (route) => {
    if (route.request().method() === 'GET') return fulfill(route, products)
    const created = { ...route.request().postDataJSON(), productId: '66666666-6666-4666-8666-666666666666', soldOut: false, version: 0 }; products.push(created); await fulfill(route, created, 201)
  })
  await page.route(`**/api/v1/catalog/products/${productId}/sold-out`, async (route) => { Object.assign(products[0]!, route.request().postDataJSON(), { version: products[0]!.version + 1 }); await fulfill(route, products[0]) })
  await page.route(`**/api/v1/catalog/products/${productId}`, async (route) => { Object.assign(products[0]!, route.request().postDataJSON(), { version: products[0]!.version + 1 }); await fulfill(route, products[0]) })
}
async function session(page: Page, role: 'OWNER' | 'MANAGER' | 'STAFF') { await page.addInitScript((value) => sessionStorage.setItem('doro-erp.operator-session', JSON.stringify({ employeeId: '00000000-0000-4000-8000-000000000001', role: value, tenantCode: 'DORO-DEMO', passwordChangeRequired: false })), role) }
async function fulfill(route: Route, body: unknown, status = 200) { await route.fulfill({ status, contentType: status >= 400 ? 'application/problem+json' : 'application/json', body: JSON.stringify(body) }) }
