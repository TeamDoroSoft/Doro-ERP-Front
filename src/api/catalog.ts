import { request } from './http'
import type {
  CatalogHistoryPage,
  CatalogHistoryQuery,
  CatalogOverview,
  CatalogRevisionResult,
  CategoryMutationResult,
  ChangeSalesPolicyRequest,
  ChangeSoldOutRequest,
  CreateCategoryRequest,
  MediaCompleteResult,
  MediaUploadTicket,
  ProductBasicInfoRequest,
  ProductListPage,
  ProductMutationResult,
  ProductResponse,
  PublishedMenu,
  ReplaceCategoryOrderRequest,
  ReplaceProductOptionsRequest,
  ReplaceProductOrderRequest,
  RequestMediaUploadRequest,
  UpdateCategoryRequest,
} from '@/types/catalog'

function categoryIfMatch(version: number): string {
  return `"category-${version}"`
}

function productIfMatch(version: number): string {
  return `"product-${version}"`
}

function catalogIfMatch(revision: number): string {
  return `"catalog-${revision}"`
}

export function getCatalogOverview(): Promise<CatalogOverview> {
  return request<CatalogOverview>('/catalog')
}

export function createCategory(
  payload: CreateCategoryRequest,
  idempotencyKey: string,
): Promise<CategoryMutationResult> {
  return request<CategoryMutationResult>('/catalog/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
    idempotencyKey,
  })
}

export function updateCategory(
  categoryId: string,
  payload: UpdateCategoryRequest,
  version: number,
): Promise<CategoryMutationResult> {
  return request<CategoryMutationResult>(`/catalog/categories/${categoryId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    ifMatch: categoryIfMatch(version),
  })
}

export function replaceCategoryOrder(
  payload: ReplaceCategoryOrderRequest,
  catalogRevision: number,
): Promise<CatalogRevisionResult> {
  return request<CatalogRevisionResult>('/catalog/categories/order', {
    method: 'PUT',
    body: JSON.stringify(payload),
    ifMatch: catalogIfMatch(catalogRevision),
  })
}

export function listProducts(params: {
  categoryId?: string
  salesEnabled?: boolean
  soldOut?: boolean
  cursor?: string
  limit?: number
}): Promise<ProductListPage> {
  const query = new URLSearchParams()
  if (params.categoryId) query.set('categoryId', params.categoryId)
  if (params.salesEnabled !== undefined) query.set('salesEnabled', String(params.salesEnabled))
  if (params.soldOut !== undefined) query.set('soldOut', String(params.soldOut))
  if (params.cursor) query.set('cursor', params.cursor)
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  const queryString = query.toString()
  return request<ProductListPage>(`/catalog/products${queryString ? `?${queryString}` : ''}`)
}

export function getProduct(productId: string): Promise<ProductResponse> {
  return request<ProductResponse>(`/catalog/products/${productId}`)
}

export function createProduct(
  payload: ProductBasicInfoRequest,
  idempotencyKey: string,
): Promise<ProductMutationResult> {
  return request<ProductMutationResult>('/catalog/products', {
    method: 'POST',
    body: JSON.stringify(payload),
    idempotencyKey,
  })
}

export function updateProduct(
  productId: string,
  payload: ProductBasicInfoRequest,
  version: number,
): Promise<ProductMutationResult> {
  return request<ProductMutationResult>(`/catalog/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    ifMatch: productIfMatch(version),
  })
}

export function replaceProductOrder(
  categoryId: string,
  payload: ReplaceProductOrderRequest,
  catalogRevision: number,
): Promise<CatalogRevisionResult> {
  return request<CatalogRevisionResult>(`/catalog/categories/${categoryId}/product-order`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    ifMatch: catalogIfMatch(catalogRevision),
  })
}

export function replaceProductOptions(
  productId: string,
  payload: ReplaceProductOptionsRequest,
  version: number,
): Promise<ProductMutationResult> {
  return request<ProductMutationResult>(`/catalog/products/${productId}/options`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    ifMatch: productIfMatch(version),
  })
}

export function changeSalesPolicy(
  productId: string,
  payload: ChangeSalesPolicyRequest,
  version: number,
): Promise<ProductMutationResult> {
  return request<ProductMutationResult>(`/catalog/products/${productId}/sales-policy`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    ifMatch: productIfMatch(version),
  })
}

export function changeSoldOut(
  productId: string,
  payload: ChangeSoldOutRequest,
  version: number,
): Promise<ProductMutationResult> {
  return request<ProductMutationResult>(`/catalog/products/${productId}/sold-out`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    ifMatch: productIfMatch(version),
  })
}

export function requestMediaUpload(
  payload: RequestMediaUploadRequest,
  idempotencyKey: string,
): Promise<MediaUploadTicket> {
  return request<MediaUploadTicket>('/catalog/media-uploads', {
    method: 'POST',
    body: JSON.stringify(payload),
    idempotencyKey,
  })
}

export function completeMediaUpload(mediaId: string): Promise<MediaCompleteResult> {
  return request<MediaCompleteResult>(`/catalog/media-uploads/${mediaId}/complete`, {
    method: 'POST',
  })
}

/** Presigned URL로 실제 파일 Binary를 올린다. 봉투 없는 순수 S3 PUT이라 request()를 쓰지 않는다. */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  requiredHeaders: Record<string, string>,
  file: File,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: requiredHeaders,
    body: file,
  })
  if (!response.ok) {
    throw new Error(`이미지 업로드에 실패했습니다. status=${response.status}`)
  }
}

export function getPublishedMenu(): Promise<PublishedMenu> {
  return request<PublishedMenu>('/menu')
}

export function getCatalogHistory(params: CatalogHistoryQuery = {}): Promise<CatalogHistoryPage> {
  const query = new URLSearchParams()
  if (params.targetType) query.set('targetType', params.targetType)
  if (params.targetId) query.set('targetId', params.targetId)
  if (params.action) query.set('action', params.action)
  if (params.actorId) query.set('actorId', params.actorId)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.cursor) query.set('cursor', params.cursor)
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  const queryString = query.toString()
  return request<CatalogHistoryPage>(`/catalog/history${queryString ? `?${queryString}` : ''}`)
}
