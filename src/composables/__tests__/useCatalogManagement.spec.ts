import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/api/http'
import type * as CatalogApi from '@/api/catalog'
import { useCatalogManagement } from '@/composables/useCatalogManagement'
import { useOperatorSessionStore, type EmployeeRole } from '@/stores/operatorSession'

const category = { categoryId: 'category-1', name: '커피', displayOrder: 1, active: true, version: 2 }
const product = { productId: 'product-1', categoryId: category.categoryId, name: '라테', description: '', price: '5000', soldOut: false, active: true, displayOrder: 1, version: 3 }

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
