import { apiRequestExact } from './http'
import { assertInt64, stringifyWithInt64, type Int64String } from './int64'

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
  version: Int64String
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
  version: Int64String
}

export interface CategoryRequest { name: string; displayOrder: number; active: boolean }
/** `price`는 Commerce의 `Long`이므로 요청에서도 number를 거치지 않고 원문 정수로 보낸다. */
export interface ProductRequest { categoryId: string; name: string; description: string; price: Int64String; displayOrder: number; active: boolean }

/**
 * `price`와 `version`은 Commerce의 Java `long`이다. `version`은 `If-Match`로 되돌아가는
 * 낙관적 잠금 값이므로 표시용이 아니라 계약 값으로서 원문을 그대로 유지한다.
 */
const CATALOG_INT64 = { fields: ['price', 'version'] } as const

export function getSalesMenu(): Promise<SalesMenuResponse> {
  return exactCatalogRequest<SalesMenuResponse>('/catalog/menu')
}

export const getManagedCategories = () => exactCatalogRequest<ManagedCategoryResponse[]>('/catalog/categories')
export const createCategory = (request: CategoryRequest) => exactCatalogRequest<ManagedCategoryResponse>('/catalog/categories', { method: 'POST', body: JSON.stringify(request) })
export const updateCategory = (id: string, request: Partial<CategoryRequest>, version: Int64String) => exactCatalogRequest<ManagedCategoryResponse>(`/catalog/categories/${encodeURIComponent(id)}`, { method: 'PATCH', headers: ifMatch(version), body: JSON.stringify(request) })
export const getManagedProducts = () => exactCatalogRequest<ManagedProductResponse[]>('/catalog/products')
export const createProduct = (request: ProductRequest) => exactCatalogRequest<ManagedProductResponse>('/catalog/products', { method: 'POST', body: productBody(request) })
export const updateProduct = (id: string, request: Partial<ProductRequest>, version: Int64String) => exactCatalogRequest<ManagedProductResponse>(`/catalog/products/${encodeURIComponent(id)}`, { method: 'PATCH', headers: ifMatch(version), body: productBody(request) })
export const changeProductSoldOut = (id: string, soldOut: boolean, version: Int64String) => exactCatalogRequest<ManagedProductResponse>(`/catalog/products/${encodeURIComponent(id)}/sold-out`, { method: 'PATCH', headers: ifMatch(version), body: JSON.stringify({ soldOut }) })

/** Emits `price` as an exact JSON integer literal, matching the Commerce `Long` request field. */
function productBody({ price, ...rest }: Partial<ProductRequest>): string {
  return stringifyWithInt64(rest, { price })
}

/** Sends the server's own version literal back untouched; a rounded value would break the lock. */
function ifMatch(version: Int64String): HeadersInit {
  return { 'If-Match': `"${assertInt64(version)}"` }
}

function exactCatalogRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequestExact<T>(path, options, CATALOG_INT64)
}
