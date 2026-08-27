<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '@/api/http'
import { formatInt64 } from '@/api/int64'
import { getKiosks, type KioskDeviceView } from '@/api/administration'
import { getSalesMenu, type SalesMenuResponse } from '@/api/catalog'
import { getTables, type TableResponse } from '@/api/table'
import OrderDraftSummary from '@/components/orders/OrderDraftSummary.vue'
import OrderMenu, {
  type SalesMenuCategory,
  type SalesMenuProduct,
} from '@/components/orders/OrderMenu.vue'
import OrderServiceTypeSelector from '@/components/orders/OrderServiceTypeSelector.vue'
import PosTableSessionPanel from '@/components/tables/PosTableSessionPanel.vue'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { useOrderDraft } from '@/composables/useOrderDraft'
import { usePosOrderSubmission, type PayNowTarget } from '@/composables/usePosOrderSubmission'
import type { TableSession } from '@/api/tableSessions'
import { useOperatorSessionStore } from '@/stores/operatorSession'

const router = useRouter()
const operatorSession = useOperatorSessionStore()
const draft = useOrderDraft()
const submission = usePosOrderSubmission()
const menu = ref<SalesMenuResponse>()
const tables = ref<TableResponse[]>([])
const kiosks = ref<KioskDeviceView[]>([])
const loading = ref(true)
const loadError = ref<ApiError>()
const tableLoading = ref(false)
const tableError = ref<ApiError>()
const kioskError = ref<ApiError>()
const createError = ref('')
const creating = ref(false)
const submitted = ref(false)
const payNowTarget = ref<PayNowTarget>('DIRECT')
const targetPaymentDeviceId = ref('')
const activeTableSession = ref<TableSession | null>(null)
const validationErrors = ref(draft.validate())

const categories = computed<SalesMenuCategory[]>(() =>
  (menu.value?.categories ?? []).map((category) => ({
    categoryId: category.categoryId,
    name: category.name,
    products: category.products.map(toMenuProduct),
  })),
)
const safeTables = computed(() => tables.value.filter((table) => table.status === 'ACTIVE'))
const paymentDevices = computed(() =>
  kiosks.value.filter((kiosk) => kiosk.status === 'ACTIVE' && kiosk.mode === 'PAYMENT'),
)
const canDiscoverPaymentKiosks = computed(
  () => operatorSession.role === 'OWNER' || operatorSession.role === 'MANAGER',
)
const estimatedTotal = computed(() => formatInt64(draft.estimatedTotal.value))
const loadErrorMessage = computed(() => {
  if (!loadError.value) return ''
  if (loadError.value.status === 403) return '판매 메뉴를 조회할 권한이 없습니다.'
  if (loadError.value.status === 503)
    return '판매 메뉴를 지금 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.'
  return '판매 메뉴를 불러오지 못했습니다.'
})

onMounted(load)

async function load() {
  loading.value = true
  loadError.value = undefined
  try {
    menu.value = await getSalesMenu()
  } catch (error) {
    loadError.value = error instanceof ApiError ? error : new ApiError(0)
  } finally {
    loading.value = false
  }
}

async function loadTables() {
  if (tableLoading.value || tables.value.length > 0) return
  tableLoading.value = true
  tableError.value = undefined
  try {
    tables.value = await getTables()
  } catch (error) {
    tableError.value = error instanceof ApiError ? error : new ApiError(0)
  } finally {
    tableLoading.value = false
  }
}

async function loadPaymentDevices() {
  if (!canDiscoverPaymentKiosks.value) return
  if (kiosks.value.length > 0) return
  kioskError.value = undefined
  try {
    kiosks.value = await getKiosks()
  } catch (error) {
    kioskError.value = error instanceof ApiError ? error : new ApiError(0)
  }
}

function toMenuProduct(
  product: SalesMenuResponse['categories'][number]['products'][number],
): SalesMenuProduct {
  return {
    productId: product.productId,
    name: product.name,
    description: product.description,
    price: product.price,
  }
}

function addProduct(product: SalesMenuProduct) {
  if (!/^\d+$/.test(product.price)) return
  changedDraft(() => draft.addProduct(product))
}

function changedDraft(change: () => void) {
  const previousPayload = JSON.stringify(draft.payload())
  change()
  if (JSON.stringify(draft.payload()) !== previousPayload) draft.replaceAfterPayloadChange()
  validationErrors.value = draft.validate()
  createError.value = ''
  submitted.value = false
}

function setServiceType(serviceType: 'DINE_IN' | 'TAKEOUT') {
  changedDraft(() => draft.setServiceType(serviceType))
  if (serviceType === 'DINE_IN') {
    void loadTables()
  } else {
    tableError.value = undefined
  }
}
function setPaymentPolicy(paymentPolicy: 'PAY_NOW' | 'PAY_LATER') {
  changedDraft(() => draft.setPaymentPolicy(paymentPolicy))
  if (paymentPolicy === 'PAY_LATER' && canDiscoverPaymentKiosks.value) void loadPaymentDevices()
}
function setPayNowTarget(target: PayNowTarget) {
  payNowTarget.value = target
  targetPaymentDeviceId.value = ''
  createError.value = ''
  if (target === 'PAYMENT_KIOSK') void loadPaymentDevices()
}
function setTable(event: Event) {
  changedDraft(() => {
    draft.tableId.value = (event.target as HTMLSelectElement).value || undefined
  })
}

function startNewDraft() {
  draft.startNewDraft()
  validationErrors.value = draft.validate()
  createError.value = ''
  submitted.value = false
  payNowTarget.value = 'DIRECT'
  targetPaymentDeviceId.value = ''
  activeTableSession.value = null
}

async function submit() {
  validationErrors.value = draft.validate()
  const payload = draft.payload()
  if (!payload || creating.value) return
  if (
    draft.paymentPolicy.value === 'PAY_NOW' &&
    payNowTarget.value === 'PAYMENT_KIOSK' &&
    !targetPaymentDeviceId.value
  ) {
    createError.value = '결제를 표시할 Kiosk를 선택해 주세요.'
    return
  }
  creating.value = true
  createError.value = ''
  submitted.value = true
  try {
    const completed = await submission.submit({
      request: payload,
      orderIdempotencyKey: draft.idempotencyKey.value,
      payNowTarget: payNowTarget.value,
      targetPaymentDeviceId: targetPaymentDeviceId.value || undefined,
    })
    if (!completed) return
    if (completed.tableSession) {
      activeTableSession.value = completed.tableSession
      draft.clearLinesForAdditionalOrder()
      validationErrors.value = draft.validate()
      submitted.value = false
      return
    }
    if (completed.handoff) {
      draft.startNewDraft()
      validationErrors.value = draft.validate()
      return
    }
    draft.startNewDraft()
    await router.push({ name: 'pos-orders-detail', params: { orderId: completed.order.orderId } })
  } catch (error) {
    createError.value = createErrorMessage(error)
  } finally {
    creating.value = false
  }
}

function createErrorMessage(error: unknown) {
  if (!(error instanceof ApiError))
    return '주문을 생성하지 못했습니다. 연결을 확인한 뒤 같은 주문으로 다시 시도해 주세요.'
  if (error.status === 0)
    return '주문을 처리할 수 없습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.'
  if (error.status === 409)
    return error.code === 'IDP_CONFLICT'
      ? '같은 주문 정보가 이미 사용되었습니다. 주문 내용을 확인하거나 새 주문을 시작해 주세요.'
      : '주문이 이미 처리 중이거나 테이블 상태가 변경되었습니다. 잠시 후 주문 상태를 확인해 주세요.'
  if (error.status === 403) return '주문을 등록할 권한이 없습니다.'
  if (error.status === 503) return '주문을 지금 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  if (error.status === 400 || error.code === 'VALIDATION_FAILED')
    return '주문 내용을 확인해 주세요. 판매 상태나 수량이 변경되었을 수 있습니다.'
  return '주문을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
</script>

<template>
  <main class="order-create">
    <header class="order-create-header">
      <p>운영 / 주문</p>
      <h1>새 주문</h1>
      <span>주문할 때 판매 가능 여부와 최종 금액을 확인합니다.</span>
    </header>
    <LoadingState v-if="loading" />
    <ApiErrorNotice
      v-else-if="loadError"
      :message="loadErrorMessage"
      :retryable="true"
      @retry="load"
    />
    <EmptyState
      v-else-if="categories.length === 0"
      title="판매할 메뉴가 없습니다."
      description="판매 메뉴가 준비되면 주문을 만들 수 있습니다."
    />
    <form v-else class="order-form" @submit.prevent="submit">
      <section class="order-settings">
        <OrderServiceTypeSelector
          :model-value="draft.serviceType.value"
          @update:model-value="setServiceType"
        />
        <label v-if="draft.serviceType.value === 'DINE_IN'" for="order-table"
          >테이블<select
            id="order-table"
            :value="draft.tableId.value"
            :disabled="creating || tableLoading"
            @change="setTable"
          >
            <option value="">{{ tableLoading ? '테이블을 불러오는 중…' : '테이블 선택' }}</option>
            <option v-for="table in safeTables" :key="table.id" :value="table.id">
              {{ table.tableNumber }} · {{ table.displayName }}
            </option>
          </select></label
        >
        <p v-if="validationErrors.tableId" class="field-error" role="alert">
          {{ validationErrors.tableId }}
        </p>
        <p
          v-if="draft.serviceType.value === 'DINE_IN' && tableError"
          class="field-error"
          role="alert"
        >
          이용할 수 있는 테이블을 불러오지 못했습니다.
          <button type="button" @click="loadTables">다시 시도</button>
        </p>
        <p
          v-else-if="
            draft.serviceType.value === 'DINE_IN' && !tableLoading && safeTables.length === 0
          "
          class="field-error"
          role="status"
        >
          선택할 수 있는 테이블이 없습니다.
        </p>
        <fieldset v-if="draft.serviceType.value === 'DINE_IN'" class="choice-row">
          <legend>결제 정책</legend>
          <label
            ><input
              type="radio"
              name="paymentPolicy"
              value="PAY_NOW"
              :checked="draft.paymentPolicy.value === 'PAY_NOW'"
              @change="setPaymentPolicy('PAY_NOW')"
            />즉시 결제</label
          >
          <label
            ><input
              type="radio"
              name="paymentPolicy"
              value="PAY_LATER"
              :checked="draft.paymentPolicy.value === 'PAY_LATER'"
              @change="setPaymentPolicy('PAY_LATER')"
            />후불</label
          >
        </fieldset>
        <p v-if="draft.paymentPolicy.value === 'PAY_LATER'" class="unpaid-notice">
          후불 주문은 미결제 상태로 테이블에 누적되며 조리는 바로 진행됩니다.
        </p>
        <p
          v-if="draft.paymentPolicy.value === 'PAY_LATER' && !canDiscoverPaymentKiosks"
          class="unpaid-notice"
        >
          현재 직원 권한으로는 합산 결제 Kiosk 목록을 조회할 수 없습니다. 점주 또는 매니저에게
          결제를 요청해 주세요.
        </p>
        <fieldset v-if="draft.paymentPolicy.value === 'PAY_NOW'" class="choice-row">
          <legend>결제 방식</legend>
          <label
            ><input
              type="radio"
              name="payNowTarget"
              value="DIRECT"
              :disabled="creating || submitted"
              :checked="payNowTarget === 'DIRECT'"
              @change="setPayNowTarget('DIRECT')"
            />직원 직접 결제</label
          >
          <label v-if="canDiscoverPaymentKiosks"
            ><input
              type="radio"
              name="payNowTarget"
              value="PAYMENT_KIOSK"
              :disabled="creating || submitted"
              :checked="payNowTarget === 'PAYMENT_KIOSK'"
              @change="setPayNowTarget('PAYMENT_KIOSK')"
            />결제 Kiosk QR</label
          >
        </fieldset>
        <label
          v-if="draft.paymentPolicy.value === 'PAY_NOW' && payNowTarget === 'PAYMENT_KIOSK'"
          for="payment-device"
          >결제 Kiosk<select
            id="payment-device"
            v-model="targetPaymentDeviceId"
            :disabled="creating || submitted"
          >
            <option value="">결제 Kiosk 선택</option>
            <option v-for="device in paymentDevices" :key="device.id" :value="device.id">
              {{ device.deviceCode }}
            </option>
          </select></label
        >
        <p v-if="kioskError" class="field-error" role="alert">
          활성 결제 Kiosk를 불러오지 못했습니다.
          <button type="button" @click="loadPaymentDevices">다시 시도</button>
        </p>
        <p
          v-else-if="
            (payNowTarget === 'PAYMENT_KIOSK' || draft.paymentPolicy.value === 'PAY_LATER') &&
            paymentDevices.length === 0
          "
          class="field-error"
          role="status"
        >
          사용 가능한 결제 Kiosk가 없습니다.
        </p>
      </section>
      <section v-if="submission.result.value?.handoff" class="handoff-success" role="status">
        <strong>주문 #{{ submission.result.value.order.displayNumber }}</strong>
        <span>{{ submission.result.value.handoff.targetPaymentDeviceName }}</span>
        <b>결제코드 {{ submission.result.value.handoff.displayCode }}</b>
      </section>
      <PosTableSessionPanel
        v-if="
          activeTableSession &&
          draft.serviceType.value === 'DINE_IN' &&
          activeTableSession.tableId === draft.tableId.value
        "
        :session="activeTableSession"
        :payment-devices="paymentDevices"
        @updated="activeTableSession = $event"
      />
      <div class="order-grid">
        <OrderMenu
          :categories="categories"
          :disabled="creating"
          @add="addProduct"
        /><OrderDraftSummary
          :lines="draft.lines.value"
          :estimated-total="estimatedTotal"
          :disabled="creating"
          @increment="
            (id) =>
              changedDraft(() =>
                draft.addProduct(draft.lines.value.find((line) => line.productId === id)!),
              )
          "
          @decrement="(id) => changedDraft(() => draft.decrementProduct(id))"
          @remove="(id) => changedDraft(() => draft.removeProduct(id))"
        />
      </div>
      <p v-if="validationErrors.lines" class="field-error" role="alert">
        {{ validationErrors.lines }}
      </p>
      <p v-if="createError" class="field-error" role="alert">{{ createError }}</p>
      <div class="actions">
        <button type="submit" class="primary" :disabled="creating">
          {{ creating ? '주문 등록 중…' : submitted ? '같은 주문 다시 시도' : '주문 등록' }}</button
        ><button type="button" :disabled="creating" @click="startNewDraft">새 주문</button>
      </div>
    </form>
  </main>
</template>

<style scoped>
.order-create {
  max-width: 1120px;
  margin: 0 auto;
  padding: 1.5rem;
}
.order-create header p {
  margin-bottom: 0.25rem;
  color: var(--color-primary);
  font-weight: 700;
}
.order-create h1 {
  margin-bottom: 0.25rem;
}
.order-create header span {
  color: var(--color-muted);
}
.order-form {
  display: grid;
  gap: 1.25rem;
  margin-top: 1.5rem;
}
.order-settings {
  display: grid;
  gap: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1rem;
}
.order-settings label {
  display: grid;
  gap: 0.4rem;
  max-width: 20rem;
  font-weight: 700;
}
.order-settings select {
  padding: 0.5rem;
}
.choice-row {
  display: flex;
  gap: 1rem;
  margin: 0;
  border: 0;
  padding: 0;
}
.choice-row legend {
  margin-bottom: 0.4rem;
  font-weight: 700;
}
.choice-row label {
  display: flex;
  grid-template-columns: auto 1fr;
  align-items: center;
}
.unpaid-notice {
  margin: 0;
  color: #9a6700;
}
.handoff-success {
  display: flex;
  gap: 1rem;
  align-items: center;
  border: 1px solid #77b998;
  background: #eefbf4;
  padding: 1rem;
}
.handoff-success b {
  font-size: 1.15rem;
  color: #17633b;
}
.order-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.7fr);
  gap: 1rem;
}
.field-error {
  margin: 0;
  color: #b42318;
}
.actions {
  display: flex;
  gap: 0.75rem;
}
.actions button {
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: 0.65rem 1rem;
  background: var(--color-background);
}
.actions .primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: white;
}
.order-create {
  max-width: none;
  margin: 0;
  padding: 0;
}
.order-create-header {
  border-bottom: 1px solid #dedfe3;
  padding: 0 0 15px;
}
.order-create-header p {
  color: #6b7280;
  font-size: 10px;
  letter-spacing: 0.08em;
}
.order-create h1 {
  font-size: 22px;
  letter-spacing: -0.025em;
}
.order-form {
  gap: 14px;
  margin-top: 16px;
}
.order-settings {
  border-radius: 3px;
  background: #fff;
  padding: 14px;
}
.order-grid {
  gap: 14px;
}
.actions {
  border-top: 1px solid #dedfe3;
  padding-top: 14px;
}
.actions button {
  border-radius: 3px;
}
@media (max-width: 760px) {
  .order-grid {
    grid-template-columns: 1fr;
  }
}
</style>
