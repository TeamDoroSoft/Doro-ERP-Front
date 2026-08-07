<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  createCategory,
  createProduct,
  errorKind,
  getCategories,
  getProducts,
  getSalesMenu,
  updateCategory,
  updateProduct,
  updateProductSoldOut,
  type CatalogRoleCode,
  type CategoryResponse,
  type ProductResponse,
  type SalesMenuResponse,
} from '@/api/catalog'
import ApiErrorNotice from '@/components/catalog/ApiErrorNotice.vue'
import { useCatalogSessionStore } from '@/stores/catalogSession'

type FormMode = 'create' | 'edit'

const session = useCatalogSessionStore()

const roleOptions: CatalogRoleCode[] = ['OWNER', 'MANAGER', 'STAFF', 'KIOSK_DEVICE']

const menu = ref<SalesMenuResponse>({ currency: 'KRW', categories: [] })
const categories = ref<CategoryResponse[]>([])
const products = ref<ProductResponse[]>([])

const loading = ref(false)
const notice = ref('')
const loadError = ref<unknown>(null)
const actionError = ref<unknown>(null)
const formError = ref<unknown>(null)

const categoryFormOpen = ref(false)
const categoryFormMode = ref<FormMode>('create')
const editingCategoryId = ref('')
const editingCategoryVersion = ref(0)
const categoryForm = reactive({ name: '', displayOrder: 0, active: true })

const productFormOpen = ref(false)
const productFormMode = ref<FormMode>('create')
const editingProductId = ref('')
const editingProductVersion = ref(0)
const productForm = reactive({
  categoryId: '',
  name: '',
  description: '',
  price: 0,
  displayOrder: 0,
  active: true,
})

const saving = ref(false)
const soldOutBusyId = ref('')

const canManageCatalog = computed(() => session.canManageCatalog)
const canChangeSoldOut = computed(() => session.canChangeSoldOut)
const isKioskDevice = computed(() => session.roleCode === 'KIOSK_DEVICE')

const categoryNameById = computed(() =>
  Object.fromEntries(categories.value.map((category) => [category.categoryId, category.name])),
)

/**
 * POS·Kiosk가 실제로 받는 판매 메뉴.
 *
 * 서버가 비활성·품절을 이미 제외하므로 화면에서 다시 거르지 않는다.
 */
const menuItems = computed(() =>
  menu.value.categories.flatMap((category) =>
    category.products.map((product) => ({
      ...product,
      categoryId: category.categoryId,
      categoryName: category.name,
    })),
  ),
)

/**
 * 품절 운영 목록.
 *
 * 품절 상품은 판매 메뉴에서 빠지므로 되돌리려면 품절·비활성까지 보이는 운영 목록이 필요하다.
 * 최신 version도 여기에서 가져와 If-Match로 보낸다.
 */
const operationsProducts = computed(() =>
  products.value.map((product) => ({
    ...product,
    categoryName: categoryNameById.value[product.categoryId] ?? product.categoryId,
  })),
)

onMounted(() => {
  void reload()
})

async function reload() {
  loading.value = true
  loadError.value = null
  actionError.value = null
  try {
    menu.value = await getSalesMenu(session.auth)
  } catch (error) {
    loadError.value = error
    menu.value = { currency: 'KRW', categories: [] }
  }

  // 운영 목록은 품절을 바꿀 수 있는 Role(OWNER·MANAGER·STAFF)만 조회한다. Kiosk 기기는 서버가 막는다.
  if (canChangeSoldOut.value) {
    try {
      const [loadedCategories, loadedProducts] = await Promise.all([
        getCategories(session.auth),
        getProducts(session.auth),
      ])
      categories.value = loadedCategories
      products.value = loadedProducts
    } catch (error) {
      // 관리 목록 조회 실패는 판매 메뉴 조회 결과를 지우지 않고 별도로 알린다.
      loadError.value = loadError.value ?? error
      categories.value = []
      products.value = []
    }
  } else {
    categories.value = []
    products.value = []
  }
  loading.value = false
}

function changeRole(role: CatalogRoleCode) {
  session.roleCode = role
  notice.value = ''
  void reload()
}

// -------------------------------------------------------------- Category

function openCategoryCreate() {
  categoryFormMode.value = 'create'
  editingCategoryId.value = ''
  editingCategoryVersion.value = 0
  Object.assign(categoryForm, { name: '', displayOrder: categories.value.length, active: true })
  formError.value = null
  categoryFormOpen.value = true
}

function openCategoryEdit(category: CategoryResponse) {
  categoryFormMode.value = 'edit'
  editingCategoryId.value = category.categoryId
  editingCategoryVersion.value = category.version
  Object.assign(categoryForm, {
    name: category.name,
    displayOrder: category.displayOrder,
    active: category.active,
  })
  formError.value = null
  categoryFormOpen.value = true
}

async function submitCategoryForm() {
  saving.value = true
  formError.value = null
  notice.value = ''
  try {
    if (categoryFormMode.value === 'create') {
      await createCategory(session.auth, {
        name: categoryForm.name.trim(),
        displayOrder: Number(categoryForm.displayOrder),
        active: categoryForm.active,
      })
      notice.value = 'Category를 등록했습니다.'
    } else {
      await updateCategory(
        session.auth,
        editingCategoryId.value,
        {
          name: categoryForm.name.trim(),
          displayOrder: Number(categoryForm.displayOrder),
          active: categoryForm.active,
        },
        editingCategoryVersion.value,
      )
      notice.value = 'Category를 변경했습니다.'
    }
    categoryFormOpen.value = false
    await reload()
  } catch (error) {
    formError.value = error
  } finally {
    saving.value = false
  }
}

async function toggleCategoryActive(category: CategoryResponse) {
  actionError.value = null
  notice.value = ''
  try {
    await updateCategory(
      session.auth,
      category.categoryId,
      { active: !category.active },
      category.version,
    )
    notice.value = category.active
      ? 'Category를 비활성화했습니다. 데이터는 삭제되지 않습니다.'
      : 'Category를 다시 활성화했습니다.'
    await reload()
  } catch (error) {
    actionError.value = error
  }
}

// --------------------------------------------------------------- Product

function openProductCreate() {
  productFormMode.value = 'create'
  editingProductId.value = ''
  editingProductVersion.value = 0
  Object.assign(productForm, {
    categoryId: categories.value[0]?.categoryId ?? '',
    name: '',
    description: '',
    price: 0,
    displayOrder: products.value.length,
    active: true,
  })
  formError.value = null
  productFormOpen.value = true
}

function openProductEdit(product: ProductResponse) {
  productFormMode.value = 'edit'
  editingProductId.value = product.productId
  editingProductVersion.value = product.version
  Object.assign(productForm, {
    categoryId: product.categoryId,
    name: product.name,
    description: product.description ?? '',
    price: product.price,
    displayOrder: product.displayOrder,
    active: product.active,
  })
  formError.value = null
  productFormOpen.value = true
}

async function submitProductForm() {
  saving.value = true
  formError.value = null
  notice.value = ''
  try {
    const payload = {
      categoryId: productForm.categoryId,
      name: productForm.name.trim(),
      description: productForm.description.trim() === '' ? null : productForm.description.trim(),
      price: Number(productForm.price),
      displayOrder: Number(productForm.displayOrder),
      active: productForm.active,
    }
    if (productFormMode.value === 'create') {
      await createProduct(session.auth, payload)
      notice.value = '상품을 등록했습니다.'
    } else {
      await updateProduct(session.auth, editingProductId.value, payload, editingProductVersion.value)
      notice.value = '상품 정보를 변경했습니다.'
    }
    productFormOpen.value = false
    await reload()
  } catch (error) {
    formError.value = error
  } finally {
    saving.value = false
  }
}

async function toggleSoldOut(productId: string, soldOut: boolean, version: number) {
  soldOutBusyId.value = productId
  actionError.value = null
  notice.value = ''
  try {
    await updateProductSoldOut(session.auth, productId, soldOut, version)
    notice.value = soldOut ? '품절로 변경했습니다.' : '판매 가능으로 변경했습니다.'
    await reload()
  } catch (error) {
    actionError.value = error
    if (errorKind(error) === 'CONFLICT') {
      // 충돌은 최신 상태를 다시 읽어야 복구된다.
      await reload()
      actionError.value = error
    }
  } finally {
    soldOutBusyId.value = ''
  }
}

function formatPrice(price: number): string {
  return `${price.toLocaleString('ko-KR')}원`
}
</script>

<template>
  <main class="catalog">
    <header class="catalog__header">
      <h1>상품·메뉴 관리</h1>
      <label class="catalog__role">
        <span>현재 역할</span>
        <select
          id="catalog-role"
          :value="session.roleCode"
          @change="changeRole(($event.target as HTMLSelectElement).value as CatalogRoleCode)"
        >
          <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
        </select>
      </label>
    </header>

    <p class="catalog__role-notice" data-testid="role-notice">
      <template v-if="canManageCatalog">
        Category·상품·가격·판매 상태와 품절을 모두 변경할 수 있습니다.
      </template>
      <template v-else-if="canChangeSoldOut">
        조회와 품절 변경만 가능합니다. Category·상품·가격 편집 권한이 없습니다.
      </template>
      <template v-else>
        Kiosk 기기는 판매 메뉴 조회만 가능합니다. 메뉴 관리와 품절 변경은 할 수 없습니다.
      </template>
    </p>

    <p v-if="notice" class="catalog__notice" role="status" data-testid="notice">{{ notice }}</p>
    <ApiErrorNotice :error="loadError" />
    <ApiErrorNotice :error="actionError" />

    <section aria-labelledby="sales-menu-heading">
      <div class="catalog__section-head">
        <h2 id="sales-menu-heading">판매 메뉴</h2>
        <button type="button" :disabled="loading" @click="reload">새로고침</button>
      </div>
      <p v-if="loading" data-testid="loading">불러오는 중…</p>
      <p v-else-if="menuItems.length === 0" data-testid="empty-menu">판매 중인 메뉴가 없습니다.</p>
      <table v-else class="catalog__table" data-testid="sales-menu-table">
        <caption class="catalog__caption">
          POS와 Kiosk가 받는 것과 같은 목록입니다. 비활성 Category·비활성 상품·품절 상품은 서버가
          제외하며 데이터는 삭제되지 않습니다.
        </caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">상품</th>
            <th scope="col">가격</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in menuItems" :key="item.productId">
            <td>{{ item.categoryName }}</td>
            <td>{{ item.name }}</td>
            <td>{{ formatPrice(item.price) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="canChangeSoldOut" aria-labelledby="sold-out-heading">
      <div class="catalog__section-head">
        <h2 id="sold-out-heading">품절 운영</h2>
      </div>
      <table class="catalog__table" data-testid="sold-out-table">
        <caption class="catalog__caption">
          품절 상품은 판매 메뉴에서 빠집니다. 여기에서 다시 판매를 재개할 수 있습니다.
        </caption>
        <thead>
          <tr>
            <th scope="col">상품</th>
            <th scope="col">Category</th>
            <th scope="col">가격</th>
            <th scope="col">판매 상태</th>
            <th scope="col">품절</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in operationsProducts" :key="item.productId">
            <td>{{ item.name }}</td>
            <td>{{ item.categoryName }}</td>
            <td>{{ formatPrice(item.price) }}</td>
            <td>{{ item.active ? '활성' : '비활성' }}</td>
            <td>
              <button
                type="button"
                :disabled="soldOutBusyId === item.productId"
                :data-testid="`sold-out-${item.productId}`"
                @click="toggleSoldOut(item.productId, !item.soldOut, item.version)"
              >
                {{ item.soldOut ? '판매 재개' : '품절 처리' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="canManageCatalog" aria-labelledby="category-heading">
      <div class="catalog__section-head">
        <h2 id="category-heading">Category 관리</h2>
        <button type="button" data-testid="open-category-create" @click="openCategoryCreate">
          Category 등록
        </button>
      </div>
      <table class="catalog__table">
        <thead>
          <tr>
            <th scope="col">이름</th>
            <th scope="col">표시 순서</th>
            <th scope="col">상태</th>
            <th scope="col">작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="category in categories" :key="category.categoryId">
            <td>{{ category.name }}</td>
            <td>{{ category.displayOrder }}</td>
            <td>{{ category.active ? '활성' : '비활성' }}</td>
            <td>
              <button type="button" @click="openCategoryEdit(category)">수정</button>
              <button
                type="button"
                :data-testid="`category-activation-${category.categoryId}`"
                @click="toggleCategoryActive(category)"
              >
                {{ category.active ? '비활성화' : '활성화' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="canManageCatalog" aria-labelledby="product-heading">
      <div class="catalog__section-head">
        <h2 id="product-heading">상품 관리</h2>
        <button
          type="button"
          data-testid="open-product-create"
          :disabled="categories.length === 0"
          @click="openProductCreate"
        >
          상품 등록
        </button>
      </div>
      <table class="catalog__table">
        <thead>
          <tr>
            <th scope="col">상품</th>
            <th scope="col">Category</th>
            <th scope="col">가격</th>
            <th scope="col">표시 순서</th>
            <th scope="col">상태</th>
            <th scope="col">품절</th>
            <th scope="col">작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.productId">
            <td>{{ product.name }}</td>
            <td>{{ categoryNameById[product.categoryId] ?? product.categoryId }}</td>
            <td>{{ formatPrice(product.price) }}</td>
            <td>{{ product.displayOrder }}</td>
            <td>{{ product.active ? '활성' : '비활성' }}</td>
            <td>{{ product.soldOut ? '품절' : '판매 중' }}</td>
            <td>
              <button type="button" @click="openProductEdit(product)">수정</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <div v-if="categoryFormOpen" class="catalog__dialog" role="dialog" aria-labelledby="category-form-title">
      <h3 id="category-form-title">
        {{ categoryFormMode === 'create' ? 'Category 등록' : 'Category 수정' }}
      </h3>
      <ApiErrorNotice :error="formError" />
      <form data-testid="category-form" @submit.prevent="submitCategoryForm">
        <label for="category-name">이름</label>
        <input id="category-name" v-model="categoryForm.name" type="text" maxlength="100" required />

        <label for="category-display-order">표시 순서</label>
        <input
          id="category-display-order"
          v-model.number="categoryForm.displayOrder"
          type="number"
          min="0"
          max="9999"
        />

        <label for="category-active">
          <input id="category-active" v-model="categoryForm.active" type="checkbox" />
          활성
        </label>

        <div class="catalog__dialog-actions">
          <button type="submit" :disabled="saving">저장</button>
          <button type="button" :disabled="saving" @click="categoryFormOpen = false">취소</button>
        </div>
      </form>
    </div>

    <div v-if="productFormOpen" class="catalog__dialog" role="dialog" aria-labelledby="product-form-title">
      <h3 id="product-form-title">
        {{ productFormMode === 'create' ? '상품 등록' : '상품 수정' }}
      </h3>
      <ApiErrorNotice :error="formError" />
      <form data-testid="product-form" @submit.prevent="submitProductForm">
        <label for="product-category">Category</label>
        <select id="product-category" v-model="productForm.categoryId">
          <option v-for="category in categories" :key="category.categoryId" :value="category.categoryId">
            {{ category.name }}{{ category.active ? '' : ' (비활성)' }}
          </option>
        </select>

        <label for="product-name">상품명</label>
        <input id="product-name" v-model="productForm.name" type="text" maxlength="100" required />

        <label for="product-description">설명</label>
        <textarea id="product-description" v-model="productForm.description" maxlength="500"></textarea>

        <label for="product-price">가격 (KRW)</label>
        <input id="product-price" v-model.number="productForm.price" type="number" min="0" step="1" />

        <label for="product-display-order">표시 순서</label>
        <input
          id="product-display-order"
          v-model.number="productForm.displayOrder"
          type="number"
          min="0"
          max="9999"
        />

        <label for="product-active">
          <input id="product-active" v-model="productForm.active" type="checkbox" />
          활성
        </label>

        <div class="catalog__dialog-actions">
          <button type="submit" :disabled="saving">저장</button>
          <button type="button" :disabled="saving" @click="productFormOpen = false">취소</button>
        </div>
      </form>
    </div>

    <p v-if="isKioskDevice" class="catalog__kiosk-note" data-testid="kiosk-note">
      Kiosk 기기 자격증명으로는 메뉴 관리와 품절 변경 API가 서버에서 차단됩니다.
    </p>
  </main>
</template>

<style scoped>
.catalog {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.catalog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.catalog__role {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.catalog__role-notice {
  margin: 0;
  color: #445;
}

.catalog__notice {
  margin: 0;
  padding: 0.6rem 0.9rem;
  border-radius: 6px;
  background: #eef7ee;
  color: #1f5130;
}

.catalog__section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.catalog__table {
  width: 100%;
  border-collapse: collapse;
}

.catalog__caption {
  text-align: left;
  padding-bottom: 0.5rem;
  color: #556;
}

.catalog__table th,
.catalog__table td {
  border-bottom: 1px solid #dde;
  padding: 0.5rem;
  text-align: left;
}

.catalog__dialog {
  border: 1px solid #ccd;
  border-radius: 8px;
  padding: 1rem;
}

.catalog__dialog form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.catalog__dialog-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.catalog__kiosk-note {
  color: #556;
}
</style>
