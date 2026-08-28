import { ref } from 'vue'
import { getStore } from '@/api/administration'

export function isBusinessDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year!, month! - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month! - 1 && parsed.getUTCDate() === day
}

export interface BusinessDateApi {
  get(): Promise<{ businessDate: string }>
}

export function useCurrentBusinessDate(api: BusinessDateApi = { get: getStore }) {
  const businessDate = ref('')
  const loadingBusinessDate = ref(false)
  const businessDateError = ref('')

  async function resolveBusinessDate() {
    if (loadingBusinessDate.value) return
    loadingBusinessDate.value = true
    businessDateError.value = ''
    try {
      const store = await api.get()
      if (!isBusinessDate(store.businessDate)) throw new Error('Invalid business date')
      businessDate.value = store.businessDate
    } catch {
      businessDateError.value = '현재 영업일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
    } finally {
      loadingBusinessDate.value = false
    }
  }

  return { businessDate, loadingBusinessDate, businessDateError, resolveBusinessDate }
}
