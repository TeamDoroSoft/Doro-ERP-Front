import { ref } from 'vue'
import { ApiError } from '@/api/http'
import { getFulfillments, markFulfillmentReady, type FulfillmentQueueView } from '@/api/queue'
import { queueErrorMessage } from './useEntryQueue'
import { useBoundedPolling } from './useBoundedPolling'

const FULFILLMENT_UNAVAILABLE = '조리 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'

export interface FulfillmentQueueApi {
  list(date: string): Promise<FulfillmentQueueView[]>
  ready(id: string): Promise<FulfillmentQueueView>
}

export function useFulfillmentQueue(api: FulfillmentQueueApi = defaultApi) {
  const fulfillments = ref<FulfillmentQueueView[]>([])
  const businessDate = ref('')
  const loading = ref(false)
  const actingId = ref('')
  const errorMessage = ref('')
  const polling = useBoundedPolling(() => load(false))
  let loadSequence = 0

  async function load(showLoading = true) {
    if (!businessDate.value) {
      loadSequence += 1
      fulfillments.value = []
      errorMessage.value = ''
      loading.value = false
      return
    }
    const sequence = ++loadSequence
    const requestedDate = businessDate.value
    if (showLoading) loading.value = true
    errorMessage.value = ''
    try {
      const response = await api.list(requestedDate)
      if (sequence === loadSequence && requestedDate === businessDate.value)
        fulfillments.value = response
    } catch (error) {
      if (sequence === loadSequence)
        errorMessage.value = queueErrorMessage(error, '조리 현황을 불러오지 못했습니다.', FULFILLMENT_UNAVAILABLE)
    } finally {
      if (showLoading && sequence === loadSequence) loading.value = false
    }
  }

  async function ready(item: FulfillmentQueueView) {
    if (item.status !== 'PREPARING' || actingId.value) return
    actingId.value = item.fulfillmentId
    errorMessage.value = ''
    try {
      await api.ready(item.fulfillmentId)
      await load(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) await load(false)
      errorMessage.value = queueErrorMessage(error, '준비 완료를 처리하지 못했습니다.', FULFILLMENT_UNAVAILABLE)
    } finally {
      actingId.value = ''
    }
  }

  return { fulfillments, businessDate, loading, actingId, errorMessage, load, ready, polling }
}

const defaultApi: FulfillmentQueueApi = { list: getFulfillments, ready: markFulfillmentReady }
