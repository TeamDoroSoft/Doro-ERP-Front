import { apiRequest, apiResponse } from './http'
import { parseJsonWithInt64, type Int64String } from './int64'

/**
 * 판매 화면 전용 메뉴 응답이다. 판매 불가 Category·Product는 Commerce가 응답에서 제외한다.
 * 금액은 Commerce JSON `long` 값이며, 표시 전 안전한 정수 범위를 확인해야 한다.
 */
export interface SalesMenuItemResponse {
  productId: string
  name: string
  description: string
  price: Int64String
  displayOrder: number
}

export interface SalesMenuCategoryResponse {
  categoryId: string
  name: string
  displayOrder: number
  products: SalesMenuItemResponse[]
}

export interface SalesMenuResponse {
  currency: string
  categories: SalesMenuCategoryResponse[]
}

export interface ManagedCategoryResponse {
  categoryId: string
  name: string
  displayOrder: number
  active: boolean
  version: number
}

export interface ManagedProductResponse {
  productId: string
  categoryId: string
  name: string
  description: string
  price: Int64String
  soldOut: boolean
  active: boolean
  displayOrder: number
  version: number
}

export interface CategoryRequest { name: string; displayOrder: number; active: boolean }
export interface ProductRequest { categoryId: string; name: string; description: string; price: number; displayOrder: number; active: boolean }

export function getSalesMenu(): Promise<SalesMenuResponse> {
  return exactCatalogRequest<SalesMenuResponse>('/catalog/menu')
}

export const getManagedCategories = () => apiRequest<ManagedCategoryResponse[]>('/catalog/categories')
export const createCategory = (request: CategoryRequest) => apiRequest<ManagedCategoryResponse>('/catalog/categories', { method: 'POST', body: JSON.stringify(request) })
export const updateCategory = (id: string, request: Partial<CategoryRequest>, version: number) => apiRequest<ManagedCategoryResponse>(`/catalog/categories/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'If-Match': `"${version}"` }, body: JSON.stringify(request) })
export const getManagedProducts = () => exactCatalogRequest<ManagedProductResponse[]>('/catalog/products')
export const createProduct = (request: ProductRequest) => exactCatalogRequest<ManagedProductResponse>('/catalog/products', { method: 'POST', body: JSON.stringify(request) })
export const updateProduct = (id: string, request: Partial<ProductRequest>, version: number) => exactCatalogRequest<ManagedProductResponse>(`/catalog/products/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'If-Match': `"${version}"` }, body: JSON.stringify(request) })
export const changeProductSoldOut = (id: string, soldOut: boolean, version: number) => exactCatalogRequest<ManagedProductResponse>(`/catalog/products/${encodeURIComponent(id)}/sold-out`, { method: 'PATCH', headers: { 'If-Match': `"${version}"` }, body: JSON.stringify({ soldOut }) })

async function exactCatalogRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return parseJsonWithInt64<T>(await (await apiResponse(path, options)).text(), ['price'])
}
