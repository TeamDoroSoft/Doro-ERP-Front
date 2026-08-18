import { ref } from 'vue'
import { ApiError } from '@/api/http'
import {
  createQueueIdempotencyKey,
  getEntries,
  registerEntry,
  transitionEntry,
  type EntryQueueView,
  type RegisterEntryRequest,
} from '@/api/queue'
import { useBoundedPolling } from './useBoundedPolling'

export interface EntryQueueApi {
  list(date: string): Promise<EntryQueueView[]>
  register(request: RegisterEntryRequest, key: string): Promise<EntryQueueView>
  transition(id: string, action: 'enter' | 'cancel' | 'no-show'): Promise<EntryQueueView>
}

export function useEntryQueue(api: EntryQueueApi = defaultApi) {
  const entries = ref<EntryQueueView[]>([])
  const businessDate = ref('')
  const loading = ref(false)
  const submitting = ref(false)
  const actingId = ref('')
  const errorMessage = ref('')
  const validationMessage = ref('')
  let operation: { fingerprint: string; key: string } | null = null
  const polling = useBoundedPolling(() => load(false))

  async function load(showLoading = true) {
    if (!businessDate.value) return
    if (showLoading) loading.value = true
    errorMessage.value = ''
    try {
      entries.value = await api.list(businessDate.value)
    } catch (error) {
      errorMessage.value = queueErrorMessage(error, '입장 대기 목록을 불러오지 못했습니다.')
    } finally {
      if (showLoading) loading.value = false
    }
  }

  async function register(partySize: number) {
    validationMessage.value = validate(businessDate.value, partySize)
    if (validationMessage.value || submitting.value) return
    const request = { businessDate: businessDate.value, partySize }
    const fingerprint = JSON.stringify(request)
    if (operation?.fingerprint !== fingerprint) {
      operation = { fingerprint, key: createQueueIdempotencyKey() }
    }
    submitting.value = true
    errorMessage.value = ''
    try {
      await api.register(request, operation.key)
      operation = null
      await load(false)
      polling.start()
    } catch (error) {
      errorMessage.value = queueErrorMessage(error, '입장 대기를 등록하지 못했습니다.')
    } finally {
      submitting.value = false
    }
  }

  async function act(entry: EntryQueueView, action: 'enter' | 'cancel' | 'no-show') {
    if (entry.status !== 'WAITING' || actingId.value) return
    actingId.value = entry.entryId
    errorMessage.value = ''
    try {
      await api.transition(entry.entryId, action)
      await load(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) await load(false)
      errorMessage.value = queueErrorMessage(error, '입장 대기 상태를 변경하지 못했습니다.')
    } finally {
      actingId.value = ''
    }
  }

  return { entries, businessDate, loading, submitting, actingId, errorMessage, validationMessage, load, register, act, polling }
}

function validate(date: string, partySize: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '영업일을 선택해 주세요.'
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 100) return '인원수는 1명부터 100명까지 입력해 주세요.'
  return ''
}

export function queueErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback
  if (error.status === 401) return '직원 세션이 만료되었습니다.'
  if (error.status === 403) return '대기열을 관리할 권한이 없습니다.'
  if (error.status === 404) return '대기열 항목을 찾을 수 없습니다. 최신 목록을 확인해 주세요.'
  if (error.status === 409) return '상태가 이미 변경되었습니다. 최신 목록을 다시 불러왔습니다.'
  if (error.status === 503) return '대기열 서비스를 일시적으로 사용할 수 없습니다.'
  if (error.status === 0) return '네트워크 연결을 확인한 뒤 다시 시도하세요.'
  return fallback
}

const defaultApi: EntryQueueApi = { list: getEntries, register: registerEntry, transition: transitionEntry }
