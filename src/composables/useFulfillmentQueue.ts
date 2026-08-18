import { ref } from 'vue'
import { ApiError } from '@/api/http'
import { getFulfillments, markFulfillmentReady, type FulfillmentQueueView } from '@/api/queue'
import { queueErrorMessage } from './useEntryQueue'
import { useBoundedPolling } from './useBoundedPolling'

export interface FulfillmentQueueApi {
  list(): Promise<FulfillmentQueueView[]>
  ready(id: string): Promise<FulfillmentQueueView>
}

export function useFulfillmentQueue(api: FulfillmentQueueApi = defaultApi) {
  const fulfillments = ref<FulfillmentQueueView[]>([])
  const loading = ref(false)
  const actingId = ref('')
  const errorMessage = ref('')
  const polling = useBoundedPolling(() => load(false))

  async function load(showLoading = true) {
    if (showLoading) loading.value = true
    errorMessage.value = ''
    try {
      fulfillments.value = await api.list()
    } catch (error) {
      errorMessage.value = queueErrorMessage(error, '조리 현황을 불러오지 못했습니다.')
    } finally {
      if (showLoading) loading.value = false
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
      errorMessage.value = queueErrorMessage(error, '준비 완료를 처리하지 못했습니다.')
    } finally {
      actingId.value = ''
    }
  }

  return { fulfillments, loading, actingId, errorMessage, load, ready, polling }
}

const defaultApi: FulfillmentQueueApi = { list: getFulfillments, ready: markFulfillmentReady }
