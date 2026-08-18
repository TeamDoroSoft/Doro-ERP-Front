import { apiRequest } from './http'

/**
 * 판매 화면 전용 메뉴 응답이다. 판매 불가 Category·Product는 Commerce가 응답에서 제외한다.
 * 금액은 Commerce JSON `long` 값이며, 표시 전 안전한 정수 범위를 확인해야 한다.
 */
export interface SalesMenuItemResponse {
  productId: string
  name: string
  description: string
  price: number
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
  price: number
  soldOut: boolean
  active: boolean
  displayOrder: number
  version: number
}

export interface CategoryRequest { name: string; displayOrder: number; active: boolean }
export interface ProductRequest { categoryId: string; name: string; description: string; price: number; displayOrder: number; active: boolean }

export function getSalesMenu(): Promise<SalesMenuResponse> {
  return apiRequest<SalesMenuResponse>('/catalog/menu')
}

export const getManagedCategories = () => apiRequest<ManagedCategoryResponse[]>('/catalog/categories')
export const createCategory = (request: CategoryRequest) => apiRequest<ManagedCategoryResponse>('/catalog/categories', { method: 'POST', body: JSON.stringify(request) })
export const updateCategory = (id: string, request: Partial<CategoryRequest>, version: number) => apiRequest<ManagedCategoryResponse>(`/catalog/categories/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'If-Match': `"${version}"` }, body: JSON.stringify(request) })
export const getManagedProducts = () => apiRequest<ManagedProductResponse[]>('/catalog/products')
export const createProduct = (request: ProductRequest) => apiRequest<ManagedProductResponse>('/catalog/products', { method: 'POST', body: JSON.stringify(request) })
export const updateProduct = (id: string, request: Partial<ProductRequest>, version: number) => apiRequest<ManagedProductResponse>(`/catalog/products/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'If-Match': `"${version}"` }, body: JSON.stringify(request) })
export const changeProductSoldOut = (id: string, soldOut: boolean, version: number) => apiRequest<ManagedProductResponse>(`/catalog/products/${encodeURIComponent(id)}/sold-out`, { method: 'PATCH', headers: { 'If-Match': `"${version}"` }, body: JSON.stringify({ soldOut }) })
