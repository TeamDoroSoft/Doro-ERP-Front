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

  async function load() {
    loading.value = true
    error.value = null
    try {
      const [nextCategories, nextProducts] = await Promise.all([api.getManagedCategories(), api.getManagedProducts()])
      categories.value = nextCategories
      products.value = nextProducts
      if (!categories.value.some((item) => item.categoryId === selectedCategoryId.value)) selectedCategoryId.value = categories.value[0]?.categoryId ?? ''
      productDraft.categoryId = selectedCategoryId.value
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
    if (!canManage.value || busyId.value) return
    if (!productDraft.categoryId || !productDraft.name.trim() || !/^\d+$/.test(productDraft.price) || !Number.isInteger(productDraft.displayOrder) || productDraft.displayOrder < 0 || productDraft.displayOrder > 9999) {
      error.value = new ApiError(400, { code: 'CLIENT_PRODUCT_VALIDATION' }); return
    }
    busyId.value = existing?.productId ?? 'new-product'; error.value = null
    try {
      const request = { ...productDraft, name: productDraft.name.trim(), description: productDraft.description.trim() }
      if (existing) await api.updateProduct(existing.productId, request, existing.version)
      else await api.createProduct(request)
      notice.value = existing ? '상품을 수정했습니다.' : '상품을 생성했습니다.'
      resetProductDraft(); await load()
    } catch (error) { await mutationFailure(error) } finally { busyId.value = '' }
  }

  function editProduct(item: catalogApi.ManagedProductResponse) { Object.assign(productDraft, { categoryId: item.categoryId, name: item.name, description: item.description, price: item.price, displayOrder: item.displayOrder, active: item.active }) }
  async function toggleProductActive(item: catalogApi.ManagedProductResponse) {
    if (!canManage.value || busyId.value) return
    busyId.value = item.productId
    try { await api.updateProduct(item.productId, { active: !item.active }, item.version); await load() }
    catch (error) { await mutationFailure(error) } finally { busyId.value = '' }
  }
  async function toggleSoldOut(item: catalogApi.ManagedProductResponse) {
    if (!session.canToggleSoldOut || busyId.value) return
    busyId.value = item.productId; error.value = null
    try { await api.changeProductSoldOut(item.productId, !item.soldOut, item.version); notice.value = '품절 상태를 변경했습니다.'; await load() }
    catch (error) { await mutationFailure(error) } finally { busyId.value = '' }
  }

  async function mutationFailure(cause: unknown) {
    if (cause instanceof ApiError && [404, 409, 412, 428].includes(cause.status)) await load()
    error.value = asApiError(cause)
  }
  function resetCategoryDraft() { Object.assign(categoryDraft, { name: '', displayOrder: 0, active: true }) }
  function resetProductDraft() { Object.assign(productDraft, { categoryId: selectedCategoryId.value, name: '', description: '', price: '0', displayOrder: 0, active: true }) }
  return { categories, products, selectedProducts, selectedCategoryId, loading, busyId, error, errorMessage, notice, canManage, categoryDraft, productDraft, load, saveCategory, editCategory, toggleCategory, saveProduct, editProduct, toggleProductActive, toggleSoldOut, resetCategoryDraft, resetProductDraft }
}

function asApiError(error: unknown) { return error instanceof ApiError ? error : new ApiError(0) }

function message(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.code === 'CLIENT_CATEGORY_VALIDATION') return '메뉴 분류명과 0~9999 사이의 표시 순서를 확인해 주세요.'
  if (error instanceof ApiError && error.code === 'CLIENT_PRODUCT_VALIDATION') return '상품명, 메뉴 분류, 0원 이상의 가격과 표시 순서를 확인해 주세요.'
  return safeApiErrorMessage(error, fallback)
}
