<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { changeOwnPassword } from '@/api/auth'
import { ApiError, safeApiErrorMessage } from '@/api/http'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useOperatorSessionStore } from '@/stores/operatorSession'

const router = useRouter()
const session = useOperatorSessionStore()
const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const errorMessage = ref('')
const busy = ref(false)
const required = computed(() => session.passwordChangeRequired)

async function submit() {
  errorMessage.value = validate()
  if (errorMessage.value || busy.value) return
  busy.value = true
  try {
    await changeOwnPassword({ currentPassword: form.currentPassword, newPassword: form.newPassword })
    session.clearSession()
    await router.push({ path: '/pos/login', query: { reason: 'password-changed' } })
  } catch (error) {
    if (isSessionExpired(error)) {
      session.clearSession()
      await router.push({ path: '/pos/login', query: { reason: 'session-expired' } })
      return
    }
    errorMessage.value = passwordErrorMessage(error)
  } finally {
    busy.value = false
  }
}

/**
 * `changeOwnPassword` opts out of the shared 401 boundary because Edge answers `401
 * CURRENT_PASSWORD_INCORRECT` for a wrong current password. Only the session-scoped 401 codes
 * mean the session itself is gone.
 */
function isSessionExpired(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    (error.code === 'UNAUTHENTICATED' || error.code === 'SESSION_ABSOLUTE_EXPIRED')
  )
}

function validate() {
  if (!form.currentPassword || !form.newPassword || !form.confirmPassword) return '모든 비밀번호 항목을 입력해 주세요.'
  if (form.newPassword !== form.confirmPassword) return '새 비밀번호 확인이 일치하지 않습니다.'
  if (form.currentPassword === form.newPassword) return '현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.'
  return ''
}

// Edge relays Store Access `400 VALIDATION_FAILED | WEAK_PASSWORD |
// PASSWORD_REUSE_NOT_ALLOWED`, `401 CURRENT_PASSWORD_INCORRECT`, `403 ACCESS_DENIED` and `404
// EMPLOYEE_NOT_FOUND` verbatim; every other upstream outcome becomes `503
// PASSWORD_CHANGE_UNAVAILABLE`, and Edge itself adds `403 CSRF_VALIDATION_FAILED`.
function passwordErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return '비밀번호를 변경하지 못했습니다.'
  if (error.code === 'CURRENT_PASSWORD_INCORRECT') return '현재 비밀번호가 올바르지 않습니다.'
  if (error.code === 'WEAK_PASSWORD')
    return '새 비밀번호가 정책에 맞지 않습니다. 15자 이상으로, 계정 정보나 서비스 이름이 포함되지 않게 입력해 주세요.'
  if (error.code === 'PASSWORD_REUSE_NOT_ALLOWED')
    return '이전에 사용한 비밀번호는 다시 사용할 수 없습니다.'
  if (error.code === 'VALIDATION_FAILED') return '입력한 비밀번호를 확인해 주세요.'
  if (error.code === 'CSRF_VALIDATION_FAILED')
    return '보안 토큰을 확인할 수 없습니다. 다시 로그인한 뒤 시도해 주세요.'
  if (error.status === 403 && error.code === 'ACCESS_DENIED') return '비밀번호 변경 권한을 확인할 수 없습니다.'
  if (error.code === 'EMPLOYEE_NOT_FOUND') return '직원 계정을 찾을 수 없습니다.'
  if (error.code === 'PASSWORD_CHANGE_UNAVAILABLE' || error.code === 'SESSION_VALIDATION_UNAVAILABLE')
    return '비밀번호 변경 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  if (error.code === 'NETWORK_ERROR') return '인증 서버에 연결할 수 없습니다.'
  return safeApiErrorMessage(error, '비밀번호를 변경하지 못했습니다.')
}
</script>

<template>
  <main class="password-page">
    <section class="password-card">
      <div class="icon"><AppIcon name="audit" :size="24" /></div>
      <p class="eyebrow">계정 보안</p>
      <h1>{{ required ? '비밀번호를 먼저 변경해 주세요' : '비밀번호 변경' }}</h1>
      <p class="description">{{ required ? '임시 비밀번호를 변경한 뒤 POS 화면을 이용할 수 있습니다.' : '변경이 완료되면 다시 로그인해야 합니다.' }}</p>
      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
      <form @submit.prevent="submit">
        <label>현재 비밀번호<input v-model="form.currentPassword" name="currentPassword" type="password" autocomplete="current-password" /></label>
        <label>새 비밀번호<input v-model="form.newPassword" name="newPassword" type="password" autocomplete="new-password" /></label>
        <label>새 비밀번호 확인<input v-model="form.confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" /></label>
        <button type="submit" :disabled="busy">{{ busy ? '변경 중…' : '비밀번호 변경' }}</button>
      </form>
      <button v-if="!required" class="back" type="button" @click="router.push('/pos/orders')">POS 화면으로 돌아가기</button>
    </section>
  </main>
</template>

<style scoped>
.password-page { display: grid; min-height: 100vh; place-items: center; background: var(--color-background); padding: 24px; }.password-card { width: min(100%, 480px); border: 1px solid var(--color-border); border-radius: 18px; background: white; padding: 38px; box-shadow: 0 18px 50px rgb(15 23 42 / 6%); }.icon { display: grid; width: 50px; height: 50px; place-items: center; border-radius: 13px; background: var(--color-primary-soft); color: var(--color-primary); }.eyebrow { margin: 22px 0 7px; color: var(--color-primary); font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }h1 { margin-bottom: 10px; color: var(--color-heading); font-size: 26px; font-weight: 800; letter-spacing: -.03em; }.description { margin-bottom: 25px; color: var(--color-muted); line-height: 1.7; }.error { border: 1px solid #fecaca; border-radius: 9px; background: #fef2f2; padding: 11px 13px; color: #991b1b; font-size: 12px; }form { display: grid; gap: 16px; }label { display: grid; gap: 7px; color: var(--color-heading); font-size: 13px; font-weight: 700; }input { min-height: 46px; border: 1px solid #cbd5e1; border-radius: 9px; padding: 0 13px; }input:focus-visible { border-color: var(--color-primary); outline: 3px solid rgb(79 70 229 / 13%); }form button { min-height: 47px; margin-top: 5px; border: 0; border-radius: 9px; background: var(--color-primary); color: white; font-weight: 750; }.back { display: block; margin: 17px auto 0; border: 0; background: transparent; color: var(--color-muted); font-size: 12px; }
@media (max-width: 520px) { .password-page { align-items: start; padding: 24px 16px; }.password-card { padding: 28px 22px; box-shadow: none; } }
</style>
