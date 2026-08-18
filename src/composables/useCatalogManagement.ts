import { computed, reactive, ref } from 'vue'
import { ApiError } from '@/api/http'
import * as catalogApi from '@/api/catalog'
import { useOperatorSessionStore } from '@/stores/operatorSession'

export function useCatalogManagement(api = catalogApi) {
  const session = useOperatorSessionStore()
  const categories = ref<catalogApi.ManagedCategoryResponse[]>([])
  const products = ref<catalogApi.ManagedProductResponse[]>([])
  const selectedCategoryId = ref('')
  const loading = ref(true)
  const busyId = ref('')
  const errorMessage = ref('')
  const notice = ref('')
  const canManage = computed(() => session.role === 'OWNER' || session.role === 'MANAGER')
  const selectedProducts = computed(() => products.value.filter((item) => item.categoryId === selectedCategoryId.value))
  const categoryDraft = reactive({ name: '', displayOrder: 0, active: true })
  const productDraft = reactive({ categoryId: '', name: '', description: '', price: 0, displayOrder: 0, active: true })

  async function load() {
    loading.value = true
    errorMessage.value = ''
    try {
      const [nextCategories, nextProducts] = await Promise.all([api.getManagedCategories(), api.getManagedProducts()])
      categories.value = nextCategories
      products.value = nextProducts
      if (!categories.value.some((item) => item.categoryId === selectedCategoryId.value)) selectedCategoryId.value = categories.value[0]?.categoryId ?? ''
      productDraft.categoryId = selectedCategoryId.value
    } catch (error) { errorMessage.value = message(error, 'Catalog 목록을 불러오지 못했습니다.') }
    finally { loading.value = false }
  }

  async function saveCategory(existing?: catalogApi.ManagedCategoryResponse) {
    if (!canManage.value || busyId.value) return
    if (!categoryDraft.name.trim() || !Number.isInteger(categoryDraft.displayOrder) || categoryDraft.displayOrder < 0 || categoryDraft.displayOrder > 9999) {
      errorMessage.value = 'Category 이름과 0~9999의 표시 순서를 확인해 주세요.'; return
    }
    busyId.value = existing?.categoryId ?? 'new-category'; errorMessage.value = ''
    try {
      const request = { name: categoryDraft.name.trim(), displayOrder: categoryDraft.displayOrder, active: categoryDraft.active }
      if (existing) await api.updateCategory(existing.categoryId, request, existing.version)
      else await api.createCategory(request)
      notice.value = existing ? 'Category를 수정했습니다.' : 'Category를 생성했습니다.'
      resetCategoryDraft(); await load()
    } catch (error) { await mutationFailure(error) } finally { busyId.value = '' }
  }

  function editCategory(item: catalogApi.ManagedCategoryResponse) { Object.assign(categoryDraft, { name: item.name, displayOrder: item.displayOrder, active: item.active }) }
  async function toggleCategory(item: catalogApi.ManagedCategoryResponse) {
    if (!canManage.value || busyId.value) return
    busyId.value = item.categoryId; errorMessage.value = ''
    try { await api.updateCategory(item.categoryId, { active: !item.active }, item.version); notice.value = 'Category 상태를 변경했습니다.'; await load() }
    catch (error) { await mutationFailure(error) } finally { busyId.value = '' }
  }

  async function saveProduct(existing?: catalogApi.ManagedProductResponse) {
    if (!canManage.value || busyId.value) return
    if (!productDraft.categoryId || !productDraft.name.trim() || !Number.isSafeInteger(productDraft.price) || productDraft.price < 0 || !Number.isInteger(productDraft.displayOrder) || productDraft.displayOrder < 0 || productDraft.displayOrder > 9999) {
      errorMessage.value = '상품명, Category, 0원 이상의 정수 가격과 표시 순서를 확인해 주세요.'; return
    }
    busyId.value = existing?.productId ?? 'new-product'; errorMessage.value = ''
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
    busyId.value = item.productId; errorMessage.value = ''
    try { await api.changeProductSoldOut(item.productId, !item.soldOut, item.version); notice.value = '품절 상태를 변경했습니다. 판매 메뉴 반영은 서버 재조회 결과를 따릅니다.'; await load() }
    catch (error) { await mutationFailure(error) } finally { busyId.value = '' }
  }

  async function mutationFailure(error: unknown) {
    if (error instanceof ApiError && [404, 409, 412, 428].includes(error.status)) await load()
    errorMessage.value = message(error, 'Catalog 요청을 처리하지 못했습니다.')
  }
  function resetCategoryDraft() { Object.assign(categoryDraft, { name: '', displayOrder: 0, active: true }) }
  function resetProductDraft() { Object.assign(productDraft, { categoryId: selectedCategoryId.value, name: '', description: '', price: 0, displayOrder: 0, active: true }) }
  return { categories, products, selectedProducts, selectedCategoryId, loading, busyId, errorMessage, notice, canManage, categoryDraft, productDraft, load, saveCategory, editCategory, toggleCategory, saveProduct, editProduct, toggleProductActive, toggleSoldOut, resetCategoryDraft, resetProductDraft }
}

function message(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback
  if (error.status === 401) return '직원 세션이 만료되었습니다.'
  if (error.status === 403) return '현재 권한으로 Catalog를 변경할 수 없습니다.'
  if (error.status === 404) return '항목을 찾을 수 없어 최신 목록을 다시 불러왔습니다.'
  if ([409, 412, 428].includes(error.status)) return '다른 변경과 충돌했습니다. 최신 목록을 다시 확인해 주세요.'
  if (error.status === 503) return 'Catalog 서비스를 일시적으로 사용할 수 없습니다.'
  if (error.status === 0) return '네트워크 연결을 확인해 주세요.'
  return fallback
}
