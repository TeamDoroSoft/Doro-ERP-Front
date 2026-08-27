import { computed, ref } from 'vue'
import { safeApiErrorMessage } from '@/api/http'
import { registerKioskEntryQueue } from '@/api/kioskQueue'

export function useKioskEntryRegistration() {
  const partySize = ref<number | null>(null)
  const registeredPartySize = ref<number | null>(null)
  const submitting = ref(false)
  const errorMessage = ref('')
  let idempotencyKey = crypto.randomUUID()

  const valid = computed(
    () => Number.isSafeInteger(partySize.value) && (partySize.value ?? 0) > 0,
  )

  async function submit() {
    if (!valid.value || partySize.value === null || submitting.value || registeredPartySize.value)
      return
    submitting.value = true
    errorMessage.value = ''
    try {
      await registerKioskEntryQueue({ partySize: partySize.value }, idempotencyKey)
      registeredPartySize.value = partySize.value
    } catch (error) {
      // Keep the key on failure: a lost response must be recovered as the same registration.
      errorMessage.value = safeApiErrorMessage(
        error,
        '대기 등록을 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.',
      )
    } finally {
      submitting.value = false
    }
  }

  function beginAnother() {
    partySize.value = null
    registeredPartySize.value = null
    errorMessage.value = ''
    idempotencyKey = crypto.randomUUID()
  }

  return { partySize, registeredPartySize, submitting, errorMessage, valid, submit, beginAnother }
}
