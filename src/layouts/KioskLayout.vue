<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { ApiError, safeApiErrorMessage } from '@/api/http'
import { activationSecret } from '@/security/kioskCredential'
import { useKioskFlowStore } from '@/stores/kioskFlow'
import { useKioskRuntimeStore } from '@/stores/kioskRuntime'
import { useKioskSessionStore } from '@/stores/kioskSession'

const route = useRoute(),
  router = useRouter(),
  session = useKioskSessionStore(),
  runtime = useKioskRuntimeStore(),
  flow = useKioskFlowStore(),
  open = ref(false),
  busy = ref(false),
  code = ref(''),
  message = ref(''),
  openButton = ref<HTMLButtonElement>(),
  dialog = ref<HTMLElement>(),
  codeInput = ref<HTMLInputElement>()
const showLogout = computed(
  () => !route.matched.some((record) => record.meta.kioskActivation),
)

async function showDialog() {
  message.value = ''
  code.value = ''
  open.value = true
  await nextTick()
  codeInput.value?.focus()
}
async function closeDialog() {
  if (busy.value) return
  code.value = ''
  message.value = ''
  open.value = false
  await nextTick()
  openButton.value?.focus()
}
function handleDialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    void closeDialog()
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return
  const controls = [...dialog.value.querySelectorAll<HTMLElement>('input, button:not([disabled])')]
  const first = controls[0], last = controls[controls.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
async function logout() {
  if (busy.value) return
  message.value = ''
  const secret = activationSecret(code.value)
  code.value = ''
  if (!secret) {
    message.value = '활성화 코드 형식을 확인해 주세요.'
    await nextTick()
    codeInput.value?.focus()
    return
  }
  busy.value = true
  try {
    await session.logout(secret)
  } catch (error) {
    message.value = logoutErrorMessage(error)
    await nextTick()
    codeInput.value?.focus()
    code.value = ''
    busy.value = false
    return
  }
  code.value = ''
  flow.resetCustomer()
  runtime.clear()
  open.value = false
  busy.value = false
  try {
    await router.replace('/kiosk/activate')
  } catch {
    window.location.assign('/kiosk/activate')
  }
}
function logoutErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401 && error.code === 'KIOSK_AUTHENTICATION_FAILED')
      return '활성화 코드가 올바르지 않습니다. 다시 확인해 주세요.'
    if (error.status === 429 || error.code === 'AUTH_RATE_LIMITED')
      return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  }
  return safeApiErrorMessage(
    error,
    '로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  )
}
</script>

<template>
  <div class="kiosk-shell">
    <header class="kiosk-header">
      <RouterLink class="brand" to="/kiosk" aria-label="Doro 메뉴로 이동"><b>D</b><strong>Doro</strong></RouterLink>
      <button v-if="showLogout" ref="openButton" class="logout-button" type="button" @click="showDialog">
        로그아웃
      </button>
    </header>
    <main><RouterView /></main>
    <div v-if="open" class="modal-backdrop">
      <section
        ref="dialog"
        class="logout-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kiosk-logout-title"
        @keydown="handleDialogKeydown"
      >
        <h2 id="kiosk-logout-title">키오스크 로그아웃</h2>
        <p>기기 활성화 코드를 입력하면 로그아웃됩니다.</p>
        <form @submit.prevent="logout">
          <label for="kiosk-logout-code">활성화 코드</label>
          <input
            id="kiosk-logout-code"
            ref="codeInput"
            v-model="code"
            type="password"
            autocomplete="off"
            required
            :aria-describedby="message ? 'kiosk-logout-error' : undefined"
          />
          <p v-if="message" id="kiosk-logout-error" role="alert">{{ message }}</p>
          <div class="dialog-actions">
            <button type="button" :disabled="busy" @click="closeDialog">취소</button>
            <button class="danger" type="submit" :disabled="busy">
              {{ busy ? '확인 중…' : '로그아웃' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.kiosk-shell { min-height: 100dvh; background: #f4f5f4; color: #171918; }
.kiosk-header { display: flex; min-height: 64px; align-items: center; justify-content: space-between; border-bottom: 1px solid #d8dcda; background: #fff; padding: 10px clamp(20px, 3vw, 44px); }
.brand { display: inline-flex; align-items: center; gap: 10px; color: #171918; }
.brand b { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 4px; background: #087f5b; color: #fff; font-size: 17px; }
.brand strong { font-size: 20px; letter-spacing: -.02em; }
.logout-button, .logout-dialog button { min-height: 44px; border: 1px solid #cbd3ce; border-radius: 4px; background: #fff; padding: 0 18px; color: #303532; font-weight: 800; }
.modal-backdrop { position: fixed; z-index: 100; inset: 0; display: grid; place-items: center; background: rgb(0 0 0 / 48%); padding: 20px; }
.logout-dialog { width: min(460px, 100%); border-radius: 6px; background: #fff; padding: 28px; box-shadow: 0 24px 60px rgb(0 0 0 / 24%); }
.logout-dialog h2 { margin: 0 0 8px; font-size: 24px; }.logout-dialog > p { margin: 0; color: #626a66; }
.logout-dialog form { display: grid; gap: 10px; margin-top: 24px; }.logout-dialog label { font-weight: 800; }
.logout-dialog input { min-height: 44px; border: 1px solid #aeb8b2; border-radius: 4px; padding: 0 14px; font-size: 17px; }
.logout-dialog [role="alert"] { margin: 2px 0; color: #b42318; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; }.logout-dialog .danger { border-color: #b42318; background: #b42318; color: #fff; }
main { width: min(100%, 1600px); margin: auto; padding: 20px clamp(20px, 2.8vw, 44px) 28px; }
@media (max-width: 640px) { .kiosk-header { min-height: 58px; padding: 8px 16px; }.brand b { width: 30px; height: 30px; }.brand strong { font-size: 18px; }main { padding: 14px 14px 20px; } }
</style>
