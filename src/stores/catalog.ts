import { ref } from 'vue'
import { defineStore } from 'pinia'
import * as catalogApi from '@/api/catalog'
import { ApiError } from '@/api/http'
import type {
  CatalogOverview,
  ChangeSalesPolicyRequest,
  ChangeSoldOutRequest,
  ProductBasicInfoRequest,
  ReplaceProductOptionsRequest,
} from '@/types/catalog'

function unknownOperationError(detail: string): ApiError {
  return new ApiError({
    status: 0,
    code: 'CATALOG_NOT_LOADED',
    detail,
    requestId: '',
    fieldErrors: [],
  })
}

function toApiError(caught: unknown): ApiError {
  return caught instanceof ApiError
    ? caught
    : new ApiError({
        status: 0,
        code: 'UNKNOWN_ERROR',
        detail: '알 수 없는 오류가 발생했습니다.',
        requestId: '',
        fieldErrors: [],
      })
}

function randomIdempotencyKey(): string {
  return crypto.randomUUID()
}

export const useCatalogStore = defineStore('catalog', () => {
  const overview = ref<CatalogOverview | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  async function run<T>(operation: () => Promise<T>): Promise<T> {
    loading.value = true
    error.value = null
    try {
      return await operation()
    } catch (caught) {
      const apiError = toApiError(caught)
      error.value = apiError
      throw apiError
    } finally {
      loading.value = false
    }
  }

  async function load(): Promise<void> {
    await run(async () => {
      overview.value = await catalogApi.getCatalogOverview()
    })
  }

  function findCategory(categoryId: string) {
    const category = overview.value?.categories.find((c) => c.categoryId === categoryId)
    if (!category) {
      throw unknownOperationError('카테고리를 찾을 수 없습니다. 목록을 다시 불러와 주세요.')
    }
    return category
  }

  function findProduct(productId: string) {
    for (const category of overview.value?.categories ?? []) {
      const product = category.products.find((p) => p.productId === productId)
      if (product) return product
    }
    throw unknownOperationError('상품을 찾을 수 없습니다. 목록을 다시 불러와 주세요.')
  }

  async function createCategory(name: string): Promise<void> {
    await run(async () => {
      await catalogApi.createCategory({ name }, randomIdempotencyKey())
      await load()
    })
  }

  async function renameCategory(categoryId: string, name: string): Promise<void> {
    await run(async () => {
      const category = findCategory(categoryId)
      await catalogApi.updateCategory(categoryId, { name }, category.version)
      await load()
    })
  }

  async function reorderCategories(orderedCategoryIds: string[]): Promise<void> {
    await run(async () => {
      if (!overview.value) {
        throw unknownOperationError('카테고리 목록을 먼저 불러와 주세요.')
      }
      await catalogApi.replaceCategoryOrder({ categoryIds: orderedCategoryIds }, overview.value.catalogRevision)
      await load()
    })
  }

  async function createProduct(payload: ProductBasicInfoRequest): Promise<void> {
    await run(async () => {
      await catalogApi.createProduct(payload, randomIdempotencyKey())
      await load()
    })
  }

  async function updateProduct(productId: string, payload: ProductBasicInfoRequest): Promise<void> {
    await run(async () => {
      const product = findProduct(productId)
      await catalogApi.updateProduct(productId, payload, product.version)
      await load()
    })
  }

  async function reorderProducts(categoryId: string, orderedProductIds: string[]): Promise<void> {
    await run(async () => {
      if (!overview.value) {
        throw unknownOperationError('상품 목록을 먼저 불러와 주세요.')
      }
      await catalogApi.replaceProductOrder(categoryId, { productIds: orderedProductIds }, overview.value.catalogRevision)
      await load()
    })
  }

  async function replaceProductOptions(productId: string, payload: ReplaceProductOptionsRequest): Promise<void> {
    await run(async () => {
      const product = findProduct(productId)
      await catalogApi.replaceProductOptions(productId, payload, product.version)
      await load()
    })
  }

  async function changeSalesPolicy(productId: string, payload: ChangeSalesPolicyRequest): Promise<void> {
    await run(async () => {
      const product = findProduct(productId)
      await catalogApi.changeSalesPolicy(productId, payload, product.version)
      await load()
    })
  }

  async function changeSoldOut(productId: string, payload: ChangeSoldOutRequest): Promise<void> {
    await run(async () => {
      const product = findProduct(productId)
      await catalogApi.changeSoldOut(productId, payload, product.version)
      await load()
    })
  }

  async function uploadProductImage(file: File): Promise<string> {
    return run(async () => {
      const checksumSha256 = await sha256Base64(file)
      const ticket = await catalogApi.requestMediaUpload(
        { contentType: file.type, byteSize: file.size, checksumSha256 },
        randomIdempotencyKey(),
      )
      await catalogApi.uploadToPresignedUrl(ticket.uploadUrl, ticket.requiredHeaders, file)
      const completed = await catalogApi.completeMediaUpload(ticket.mediaId)
      return completed.mediaId
    })
  }

  return {
    overview,
    loading,
    error,
    load,
    createCategory,
    renameCategory,
    reorderCategories,
    createProduct,
    updateProduct,
    reorderProducts,
    replaceProductOptions,
    changeSalesPolicy,
    changeSoldOut,
    uploadProductImage,
  }
})

/** 업로드 준비 API가 요구하는 SHA-256 Checksum(Base64)을 파일 Binary에서 계산한다. */
async function sha256Base64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const bytes = new Uint8Array(digest)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}
