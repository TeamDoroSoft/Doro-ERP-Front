import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/api/http'
import type * as CatalogApi from '@/api/catalog'
import { useCatalogManagement } from '@/composables/useCatalogManagement'
import { useOperatorSessionStore, type EmployeeRole } from '@/stores/operatorSession'

const category = { categoryId: 'category-1', name: '커피', displayOrder: 1, active: true, version: '2' }
const product = { productId: 'product-1', categoryId: category.categoryId, name: '라테', description: '', price: '5000', soldOut: false, active: true, displayOrder: 1, version: '3' }

describe('useCatalogManagement', () => {
  beforeEach(() => { setActivePinia(createPinia()); sessionStorage.clear() })
  it.each<EmployeeRole>(['OWNER', 'MANAGER', 'STAFF'])('%s can toggle sold-out', async (role) => {
    const api = mockApi(); useOperatorSessionStore().setRole(role)
    const model = useCatalogManagement(api); await model.load(); await model.toggleSoldOut(product)
    expect(api.changeProductSoldOut).toHaveBeenCalledWith(product.productId, true, product.version)
  })
  it('hides management permission from STAFF while preserving sold-out permission', async () => {
    const api = mockApi(); useOperatorSessionStore().setRole('STAFF'); const model = useCatalogManagement(api); await model.load()
    await model.saveCategory(); await model.saveProduct()
    expect(model.canManage.value).toBe(false); expect(api.createCategory).not.toHaveBeenCalled(); expect(api.createProduct).not.toHaveBeenCalled()
  })
  it('reloads canonical state after sold-out conflict instead of keeping an optimistic value', async () => {
    const api = mockApi(); api.changeProductSoldOut.mockRejectedValue(new ApiError(409)); useOperatorSessionStore().setRole('OWNER')
    const model = useCatalogManagement(api); await model.load(); await model.toggleSoldOut(product)
    expect(api.getManagedProducts).toHaveBeenCalledTimes(2); expect(model.products.value[0]?.soldOut).toBe(false)
  })
  it('uses the stable catalog problem code before the HTTP status', async () => {
    const api = mockApi(); api.createCategory.mockRejectedValue(new ApiError(409, { code: 'CATEGORY_NAME_DUPLICATED', requestId: 'req-catalog' })); useOperatorSessionStore().setRole('OWNER')
    const model = useCatalogManagement(api); await model.load(); model.categoryDraft.name = '커피'; await model.saveCategory()
    expect(model.errorMessage.value).toContain('같은 이름')
    expect(model.error.value?.requestId).toBe('req-catalog')
  })
  it('turns a nullable Product description into a safe editable string', async () => {
    const api = mockApi()
    const nullableProduct = { ...product, description: null }
    api.getManagedProducts.mockResolvedValue([nullableProduct])
    useOperatorSessionStore().setRole('OWNER')
    const model = useCatalogManagement(api)
    await model.load()

    model.editProduct(nullableProduct)

    expect(model.productDraft.description).toBe('')
  })
  it.each(['00', '05000', '100000001'])('rejects non-canonical or out-of-range price %s', async (price) => {
    const api = mockApi()
    useOperatorSessionStore().setRole('OWNER')
    const model = useCatalogManagement(api)
    await model.load()
    model.editProduct(product)
    model.productDraft.price = price

    await expect(model.saveProduct(product)).resolves.toBe(false)

    expect(api.updateProduct).not.toHaveBeenCalled()
    expect(model.errorMessage.value).toContain('가격')
  })
  it.each(['0', '100000000'])('accepts canonical boundary price %s', async (price) => {
    const api = mockApi()
    api.updateProduct.mockResolvedValue({ ...product, price, version: '4' })
    useOperatorSessionStore().setRole('OWNER')
    const model = useCatalogManagement(api)
    await model.load()
    model.editProduct(product)
    model.productDraft.price = price

    await expect(model.saveProduct(product)).resolves.toBe(true)

    expect(api.updateProduct).toHaveBeenCalledWith(
      product.productId,
      expect.objectContaining({ price }),
      product.version,
    )
  })
  it('preserves the draft and advances the editor version after a conflict refresh', async () => {
    const editor = { ...product }
    const latest = { ...editor, name: '서버 이름', version: '4' }
    const api = mockApi()
    api.getManagedProducts.mockResolvedValueOnce([editor]).mockResolvedValue([latest])
    api.updateProduct
      .mockRejectedValueOnce(new ApiError(412, { code: 'CATALOG_VERSION_CONFLICT' }))
      .mockResolvedValueOnce({ ...latest, name: '내 이름', version: '5' })
    useOperatorSessionStore().setRole('OWNER')
    const model = useCatalogManagement(api)
    await model.load()
    model.editProduct(editor)
    model.productDraft.name = '내 이름'
    model.notice.value = '이전 작업 성공'

    await expect(model.saveProduct(editor)).resolves.toBe(false)
    expect(model.productDraft.name).toBe('내 이름')
    expect(editor.version).toBe('4')
    expect(model.notice.value).toBe('')

    await expect(model.saveProduct(editor)).resolves.toBe(true)
    expect(api.updateProduct.mock.calls[1]?.[2]).toBe('4')
  })
  it('blocks reuse of a stale version until a failed conflict refresh succeeds', async () => {
    const editor = { ...product }
    const latest = { ...editor, version: '4' }
    const api = mockApi()
    api.getManagedProducts
      .mockResolvedValueOnce([editor])
      .mockRejectedValueOnce(new ApiError(0))
      .mockResolvedValue([latest])
    api.updateProduct.mockRejectedValueOnce(new ApiError(409))
    useOperatorSessionStore().setRole('OWNER')
    const model = useCatalogManagement(api)
    await model.load()
    model.editProduct(editor)
    model.productDraft.name = '보존할 이름'

    await model.saveProduct(editor)
    expect(model.errorMessage.value).toContain('충돌했고 최신 목록도 불러오지 못했습니다')
    await expect(model.saveProduct(editor)).resolves.toBe(false)
    expect(api.updateProduct).toHaveBeenCalledTimes(1)
    expect(model.productDraft.name).toBe('보존할 이름')

    await model.load()
    api.updateProduct.mockResolvedValue({ ...latest, name: '보존할 이름', version: '5' })
    await expect(model.saveProduct(editor)).resolves.toBe(true)
    expect(api.updateProduct.mock.calls[1]?.[2]).toBe('4')
  })
  it('reports mutation success independently when the follow-up refresh fails', async () => {
    const saved = { ...product, name: '카페라테', version: '4' }
    const api = mockApi()
    api.getManagedProducts.mockResolvedValueOnce([product]).mockRejectedValueOnce(new ApiError(503))
    api.updateProduct.mockResolvedValue(saved)
    useOperatorSessionStore().setRole('OWNER')
    const model = useCatalogManagement(api)
    await model.load()
    model.editProduct(product)
    model.productDraft.name = '카페라테'

    await expect(model.saveProduct(product)).resolves.toBe(true)

    expect(model.products.value[0]).toEqual(saved)
    expect(model.notice.value).toContain('수정했지만 최신 목록을 불러오지 못했습니다')
    expect(model.error.value?.status).toBe(503)
    expect(model.productDraft.name).toBe('')
  })
})

function mockApi() {
  return {
    getSalesMenu: vi.fn<typeof CatalogApi.getSalesMenu>(),
    getManagedCategories: vi.fn<typeof CatalogApi.getManagedCategories>().mockResolvedValue([category]),
    createCategory: vi.fn<typeof CatalogApi.createCategory>(), updateCategory: vi.fn<typeof CatalogApi.updateCategory>(),
    getManagedProducts: vi.fn<typeof CatalogApi.getManagedProducts>().mockResolvedValue([product]),
    createProduct: vi.fn<typeof CatalogApi.createProduct>(), updateProduct: vi.fn<typeof CatalogApi.updateProduct>(),
    changeProductSoldOut: vi.fn<typeof CatalogApi.changeProductSoldOut>().mockResolvedValue({ ...product, soldOut: true }),
  }
}
