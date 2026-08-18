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

export function getSalesMenu(): Promise<SalesMenuResponse> {
  return apiRequest<SalesMenuResponse>('/catalog/menu')
}
