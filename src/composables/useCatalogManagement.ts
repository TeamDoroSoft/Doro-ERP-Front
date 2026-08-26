import { computed, reactive, ref } from 'vue'
import { ApiError, safeApiErrorMessage } from '@/api/http'
import * as catalogApi from '@/api/catalog'
import { useOperatorSessionStore } from '@/stores/operatorSession'

export function useCatalogManagement(api = catalogApi) {
  const session = useOperatorSessionStore()
  const categories = ref<catalogApi.ManagedCategoryResponse[]>([])
  const products = ref<catalogApi.ManagedProductResponse[]>([])
  const selectedCategoryId = ref('')
  const loading = ref(true)
  const busyId = ref('')
  const error = ref<ApiError | null>(null)
  const errorMessage = computed(() => error.value ? message(error.value, '상품 관리 요청을 처리하지 못했습니다.') : '')
  const notice = ref('')
  const canManage = computed(() => session.role === 'OWNER' || session.role === 'MANAGER')
  const selectedProducts = computed(() => products.value.filter((item) => item.categoryId === selectedCategoryId.value))
  const categoryDraft = reactive({ name: '', displayOrder: 0, active: true })
  const productDraft = reactive({ categoryId: '', name: '', description: '', price: '0', displayOrder: 0, active: true })
  const staleProductEditors = new Map<string, catalogApi.ManagedProductResponse>()

  async function load() {
    loading.value = true
    error.value = null
    try {
      const [nextCategories, nextProducts] = await Promise.all([api.getManagedCategories(), api.getManagedProducts()])
      categories.value = nextCategories
      products.value = nextProducts
      if (!categories.value.some((item) => item.categoryId === selectedCategoryId.value)) selectedCategoryId.value = categories.value[0]?.categoryId ?? ''
      if (!productDraft.categoryId) productDraft.categoryId = selectedCategoryId.value
      for (const [productId, editor] of staleProductEditors) {
        const latest = nextProducts.find((item) => item.productId === productId)
        if (latest) {
          editor.version = latest.version
          staleProductEditors.delete(productId)
        }
      }
    } catch (cause) { error.value = asApiError(cause) }
    finally { loading.value = false }
  }

  async function saveCategory(existing?: catalogApi.ManagedCategoryResponse) {
    if (!canManage.value || busyId.value) return
    if (!categoryDraft.name.trim() || !Number.isInteger(categoryDraft.displayOrder) || categoryDraft.displayOrder < 0 || categoryDraft.displayOrder > 9999) {
      error.value = new ApiError(400, { code: 'CLIENT_CATEGORY_VALIDATION' }); return
    }
    busyId.value = existing?.categoryId ?? 'new-category'; error.value = null
    try {
      const request = { name: categoryDraft.name.trim(), displayOrder: categoryDraft.displayOrder, active: categoryDraft.active }
      if (existing) await api.updateCategory(existing.categoryId, request, existing.version)
      else await api.createCategory(request)
      notice.value = existing ? '메뉴 분류를 수정했습니다.' : '메뉴 분류를 등록했습니다.'
      resetCategoryDraft(); await load()
    } catch (error) { await mutationFailure(error) } finally { busyId.value = '' }
  }

  function editCategory(item: catalogApi.ManagedCategoryResponse) { Object.assign(categoryDraft, { name: item.name, displayOrder: item.displayOrder, active: item.active }) }
  async function toggleCategory(item: catalogApi.ManagedCategoryResponse) {
    if (!canManage.value || busyId.value) return
    busyId.value = item.categoryId; error.value = null
    try { await api.updateCategory(item.categoryId, { active: !item.active }, item.version); notice.value = '메뉴 분류 상태를 변경했습니다.'; await load() }
    catch (error) { await mutationFailure(error) } finally { busyId.value = '' }
  }

  async function saveProduct(existing?: catalogApi.ManagedProductResponse) {
    if (!canManage.value || busyId.value) return false
    if (existing && staleProductEditors.has(existing.productId)) {
      error.value = new ApiError(409, { code: 'CLIENT_PRODUCT_STALE' })
      return false
    }
    if (!isValidProductDraft()) {
      error.value = new ApiError(400, { code: 'CLIENT_PRODUCT_VALIDATION' }); return false
    }
    busyId.value = existing?.productId ?? 'new-product'; error.value = null; notice.value = ''
    try {
      const request = { ...productDraft, name: productDraft.name.trim(), description: productDraft.description.trim() }
      const saved = existing
        ? await api.updateProduct(existing.productId, request, existing.version)
        : await api.createProduct(request)
      upsertProduct(saved)
      const successNotice = existing ? '상품을 수정했습니다.' : '상품을 생성했습니다.'
      resetProductDraft()
      await refreshAfterProductMutation(successNotice)
      return true
    } catch (error) {
      await mutationFailure(error, existing)
      return false
    } finally { busyId.value = '' }
  }

  function editProduct(item: catalogApi.ManagedProductResponse) { Object.assign(productDraft, { categoryId: item.categoryId, name: item.name, description: item.description ?? '', price: item.price, displayOrder: item.displayOrder, active: item.active }) }
  async function toggleProductActive(item: catalogApi.ManagedProductResponse) {
    if (!canManage.value || busyId.value) return
    busyId.value = item.productId; error.value = null; notice.value = ''
    try {
      const saved = await api.updateProduct(item.productId, { active: !item.active }, item.version)
      upsertProduct(saved)
      await refreshAfterProductMutation('상품 판매 상태를 변경했습니다.')
    }
    catch (error) { await mutationFailure(error) } finally { busyId.value = '' }
  }
  async function toggleSoldOut(item: catalogApi.ManagedProductResponse) {
    if (!session.canToggleSoldOut || busyId.value) return
    busyId.value = item.productId; error.value = null; notice.value = ''
    try {
      const saved = await api.changeProductSoldOut(item.productId, !item.soldOut, item.version)
      upsertProduct(saved)
      await refreshAfterProductMutation('품절 상태를 변경했습니다.')
    }
    catch (error) { await mutationFailure(error) } finally { busyId.value = '' }
  }

  async function mutationFailure(cause: unknown, productEditor?: catalogApi.ManagedProductResponse) {
    if (cause instanceof ApiError && [404, 409, 412, 428].includes(cause.status)) {
      if (productEditor) staleProductEditors.set(productEditor.productId, productEditor)
      await load()
      if (productEditor && error.value) {
        error.value = new ApiError(cause.status, {
          code: 'CLIENT_PRODUCT_REFRESH_FAILED',
          requestId: cause.requestId,
        })
        return
      }
    }
    error.value = asApiError(cause)
  }
  function isValidProductDraft() {
    const canonicalPrice = /^(0|[1-9]\d*)$/.test(productDraft.price)
    const priceInRange = canonicalPrice && BigInt(productDraft.price) <= 100_000_000n
    return !!productDraft.categoryId && !!productDraft.name.trim() && priceInRange &&
      Number.isInteger(productDraft.displayOrder) && productDraft.displayOrder >= 0 && productDraft.displayOrder <= 9999
  }
  function upsertProduct(saved: catalogApi.ManagedProductResponse | undefined) {
    if (!saved) return
    const index = products.value.findIndex((item) => item.productId === saved.productId)
    if (index === -1) products.value.push(saved)
    else products.value[index] = saved
  }
  async function refreshAfterProductMutation(successNotice: string) {
    notice.value = successNotice
    await load()
    if (error.value) notice.value = `${successNotice.replace(/했습니다\.$/, '했지만')} 최신 목록을 불러오지 못했습니다. 새로고침해 주세요.`
  }
  function resetCategoryDraft() { Object.assign(categoryDraft, { name: '', displayOrder: 0, active: true }) }
  function resetProductDraft() { Object.assign(productDraft, { categoryId: selectedCategoryId.value, name: '', description: '', price: '0', displayOrder: 0, active: true }) }
  return { categories, products, selectedProducts, selectedCategoryId, loading, busyId, error, errorMessage, notice, canManage, categoryDraft, productDraft, load, saveCategory, editCategory, toggleCategory, saveProduct, editProduct, toggleProductActive, toggleSoldOut, resetCategoryDraft, resetProductDraft }
}

function asApiError(error: unknown) { return error instanceof ApiError ? error : new ApiError(0) }

function message(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.code === 'CLIENT_CATEGORY_VALIDATION') return '메뉴 분류명과 0~9999 사이의 표시 순서를 확인해 주세요.'
  if (error instanceof ApiError && error.code === 'CLIENT_PRODUCT_VALIDATION') return '상품명, 메뉴 분류, 0~100,000,000원 가격과 표시 순서를 확인해 주세요.'
  if (error instanceof ApiError && error.code === 'CLIENT_PRODUCT_STALE') return '최신 상품 버전을 불러온 뒤 다시 저장해 주세요.'
  if (error instanceof ApiError && error.code === 'CLIENT_PRODUCT_REFRESH_FAILED') return '상품 변경이 충돌했고 최신 목록도 불러오지 못했습니다. 새로고침한 뒤 다시 저장해 주세요.'
  return safeApiErrorMessage(error, fallback)
}
