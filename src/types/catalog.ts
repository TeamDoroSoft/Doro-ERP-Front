export interface CategoryResponse {
  categoryId: string
  name: string
  displayOrder: number
  version: number
}

export interface ProductOptionResponse {
  optionId: string
  name: string
  additionalPrice: number
  enabled: boolean
  displayOrder: number
}

export interface ProductResponse {
  productId: string
  categoryId: string
  mediaId: string | null
  name: string
  description: string | null
  basePrice: number
  imageAltText: string | null
  salesEnabled: boolean
  soldOut: boolean
  stockManaged: boolean
  displayOrder: number
  version: number
  options: ProductOptionResponse[]
}

export interface CategoryOverview extends CategoryResponse {
  products: ProductResponse[]
}

export interface CatalogOverview {
  catalogRevision: number
  categories: CategoryOverview[]
}

export interface CategoryMutationResult {
  category: CategoryResponse
  catalogRevision: number
}

export interface ProductMutationResult {
  product: ProductResponse
  catalogRevision: number
}

export interface CatalogRevisionResult {
  catalogRevision: number
}

export interface ProductListPage {
  items: ProductResponse[]
  nextCursor: string | null
  hasMore: boolean
}

export interface MediaUploadTicket {
  mediaId: string
  uploadUrl: string
  requiredHeaders: Record<string, string>
  expiresAt: string
}

export interface MediaCompleteResult {
  mediaId: string
  status: 'PENDING' | 'READY' | 'REJECTED'
  checksumSha256: string
  readyAt: string | null
}

export interface CreateCategoryRequest {
  name: string
}

export interface UpdateCategoryRequest {
  name: string
}

export interface ReplaceCategoryOrderRequest {
  categoryIds: string[]
}

export interface ProductBasicInfoRequest {
  categoryId: string
  name: string
  description: string | null
  basePrice: number
  mediaId: string | null
  imageAltText: string | null
  salesEnabled: boolean
  stockManaged: boolean
}

export interface ReplaceProductOrderRequest {
  productIds: string[]
}

export interface ProductOptionEntry {
  optionId: string | null
  name: string
  additionalPrice: number
  enabled: boolean
}

export interface ReplaceProductOptionsRequest {
  options: ProductOptionEntry[]
}

export interface ChangeSalesPolicyRequest {
  salesEnabled: boolean
  stockManaged: boolean
}

export interface ChangeSoldOutRequest {
  soldOut: boolean
}

export interface RequestMediaUploadRequest {
  contentType: string
  byteSize: number
  checksumSha256: string
}

export interface PublishedOption {
  optionId: string
  name: string
  additionalPrice: number
}

export interface PublishedProduct {
  productId: string
  name: string
  description: string | null
  basePrice: number
  imageUrl: string | null
  imageAltText: string | null
  soldOut: boolean
  orderable: boolean
  options: PublishedOption[]
}

export interface PublishedCategory {
  categoryId: string
  name: string
  products: PublishedProduct[]
}

export interface PublishedMenu {
  catalogRevision: number
  categories: PublishedCategory[]
}

export interface CatalogHistoryEntry {
  auditId: string
  action: string
  actorType: string
  actorId: string | null
  actorRoleSnapshot: string | null
  targetType: string | null
  targetId: string | null
  occurredAt: string
  requestId: string | null
  beforeValue: Record<string, unknown> | null
  afterValue: Record<string, unknown> | null
}

export interface CatalogHistoryPage {
  items: CatalogHistoryEntry[]
  nextCursor: string | null
}

export interface CatalogHistoryQuery {
  targetType?: 'CATEGORY' | 'PRODUCT'
  targetId?: string
  action?: string
  actorId?: string
  from?: string
  to?: string
  cursor?: string
  limit?: number
}
