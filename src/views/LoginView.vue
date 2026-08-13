<script setup lang="ts">
import { computed, defineAsyncComponent, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '@/api/auth'
import { ApiError } from '@/api/http'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useOperatorSessionStore } from '@/stores/operatorSession'

const route = useRoute()
const router = useRouter()
const session = useOperatorSessionStore()
const form = reactive({ tenantCode: '', loginId: '', password: '' })
const errors = ref<Record<string, string>>({})
const submitError = ref('')
const busy = ref(false)
const showPassword = ref(false)
const DevAdminPreviewEntry = import.meta.env.DEV
  ? defineAsyncComponent(() => import('@/components/dev/DevAdminPreviewEntry.vue'))
  : null
const sessionExpired = computed(() => route.query.reason === 'session-expired')

async function submit() {
  errors.value = validate()
  if (Object.keys(errors.value).length > 0 || busy.value) return
  busy.value = true
  submitError.value = ''
  try {
    const result = await login({
      tenantCode: form.tenantCode.trim(),
      loginId: form.loginId.trim(),
      password: form.password,
    })
    session.applyLogin(result, form.tenantCode.trim())
    if (result.passwordChangeRequired) {
      await router.push('/account/change-password')
    } else {
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/admin/dashboard'
      await router.push(redirect.startsWith('/admin') ? redirect : '/admin/dashboard')
    }
  } catch (error) {
    submitError.value = loginErrorMessage(error)
  } finally {
    busy.value = false
  }
}

async function enterPreview() {
  session.applyPreview()
  await router.push('/admin/dashboard')
}

function validate() {
  const next: Record<string, string> = {}
  if (!form.tenantCode.trim()) next.tenantCode = '업체 코드를 입력해 주세요.'
  if (!form.loginId.trim()) next.loginId = '로그인 ID를 입력해 주세요.'
  if (!form.password) next.password = '비밀번호를 입력해 주세요.'
  return next
}

function loginErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return '로그인 요청을 처리하지 못했습니다.'
  if (error.code === 'AUTHENTICATION_FAILED') return '업체 코드, 로그인 ID 또는 비밀번호를 확인해 주세요.'
  if (error.code === 'AUTH_RATE_LIMITED') return '로그인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  if (error.code === 'NETWORK_ERROR') return '인증 서버에 연결할 수 없습니다.'
  if (error.code === 'EDGE_ROUTE_NOT_REGISTERED') return '직원 로그인을 아직 사용할 수 없습니다.'
  return error.message
}
</script>

<template>
  <main class="login-page">
    <section class="brand-panel">
      <div class="brand"><span>D</span>Doro ERP</div>
      <div class="brand-copy"><p>매장 운영</p><h1>매장 운영을 위한<br />하나의 관리자 공간</h1><span>주문부터 결제, 대기와 마감까지 한곳에서 관리하세요.</span></div>
      <div class="security-note"><AppIcon name="audit" :size="20" /><div><strong>안전한 직원 로그인</strong><span>로그인 정보는 안전하게 보호됩니다.</span></div></div>
    </section>
    <section class="form-panel">
      <div class="login-card">
        <div class="mobile-brand"><span>D</span>Doro ERP</div>
        <p class="eyebrow">직원 로그인</p>
        <h2>관리자 로그인</h2>
        <p class="intro">업체 코드와 직원 계정으로 로그인해 주세요.</p>
        <p v-if="sessionExpired" class="session-notice" role="status">로그인 시간이 만료되었습니다. 다시 로그인해 주세요.</p>
        <p v-if="submitError" class="form-error" role="alert">{{ submitError }}</p>
        <form @submit.prevent="submit">
          <label>업체 코드<input v-model="form.tenantCode" name="tenantCode" autocomplete="organization" placeholder="예: doro-store" :aria-invalid="Boolean(errors.tenantCode)" /><small v-if="errors.tenantCode">{{ errors.tenantCode }}</small></label>
          <label>로그인 ID<input v-model="form.loginId" name="loginId" autocomplete="username" placeholder="직원 로그인 ID" :aria-invalid="Boolean(errors.loginId)" /><small v-if="errors.loginId">{{ errors.loginId }}</small></label>
          <label>비밀번호<span class="password-field"><input v-model="form.password" name="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="비밀번호" :aria-invalid="Boolean(errors.password)" /><button type="button" :aria-label="showPassword ? '비밀번호 숨기기' : '비밀번호 보기'" @click="showPassword = !showPassword">{{ showPassword ? '숨김' : '보기' }}</button></span><small v-if="errors.password">{{ errors.password }}</small></label>
          <button class="submit-button" type="submit" :disabled="busy">{{ busy ? '로그인 확인 중…' : '로그인' }}</button>
        </form>
        <component :is="DevAdminPreviewEntry" v-if="DevAdminPreviewEntry" @preview="enterPreview" />
        <p class="support">계정 문제가 있으면 매장 관리자에게 문의하세요.</p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-page { display: grid; min-height: 100vh; grid-template-columns: minmax(380px, .85fr) minmax(520px, 1.15fr); background: white; }.brand-panel { position: relative; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; background: #111827; padding: 44px 52px; color: white; }.brand-panel::after { position: absolute; right: -160px; bottom: -180px; width: 440px; height: 440px; border: 1px solid rgb(129 140 248 / 22%); border-radius: 50%; box-shadow: 0 0 0 70px rgb(99 102 241 / 4%), 0 0 0 140px rgb(99 102 241 / 3%); content: ''; }.brand, .mobile-brand { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 800; }.brand > span, .mobile-brand > span { display: grid; width: 36px; height: 36px; place-items: center; border-radius: 10px; background: var(--color-primary); color: white; font-weight: 800; }.brand-copy { position: relative; z-index: 1; max-width: 480px; }.brand-copy p, .eyebrow { margin-bottom: 12px; color: #a5b4fc; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }.brand-copy h1 { margin-bottom: 18px; font-size: clamp(34px, 4vw, 52px); font-weight: 800; letter-spacing: -.045em; line-height: 1.15; }.brand-copy > span { color: #cbd5e1; font-size: 15px; line-height: 1.8; }.security-note { position: relative; z-index: 1; display: flex; max-width: 380px; gap: 12px; border: 1px solid rgb(255 255 255 / 12%); border-radius: 12px; background: rgb(255 255 255 / 5%); padding: 15px; }.security-note div { display: grid; }.security-note strong { font-size: 13px; }.security-note span { color: #94a3b8; font-size: 11px; }.form-panel { display: grid; place-items: center; background: var(--color-background); padding: 38px; }.login-card { width: min(100%, 430px); border: 1px solid var(--color-border); border-radius: 18px; background: white; padding: 38px; box-shadow: 0 18px 50px rgb(15 23 42 / 6%); }.mobile-brand { display: none; margin-bottom: 32px; color: var(--color-heading); }.eyebrow { color: var(--color-primary); }h2 { margin-bottom: 7px; color: var(--color-heading); font-size: 28px; font-weight: 800; letter-spacing: -.03em; }.intro { margin-bottom: 28px; color: var(--color-muted); }.session-notice, .form-error { border-radius: 9px; padding: 11px 13px; font-size: 12px; }.session-notice { border: 1px solid #fde68a; background: #fffbeb; color: #92400e; }.form-error { border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; }form { display: grid; gap: 18px; }label { display: grid; gap: 7px; color: var(--color-heading); font-size: 13px; font-weight: 700; }input { width: 100%; min-height: 46px; border: 1px solid #cbd5e1; border-radius: 9px; background: white; padding: 0 13px; color: var(--color-heading); }input::placeholder { color: #94a3b8; }input:focus-visible { border-color: var(--color-primary); outline: 3px solid rgb(79 70 229 / 13%); }input[aria-invalid='true'] { border-color: #f87171; }label small { color: var(--color-danger); font-size: 11px; }.password-field { position: relative; }.password-field input { padding-right: 60px; }.password-field button { position: absolute; top: 7px; right: 7px; min-height: 32px; border: 0; border-radius: 7px; background: #f1f5f9; padding: 0 9px; color: var(--color-muted); font-size: 11px; }.submit-button { min-height: 47px; margin-top: 4px; border: 0; border-radius: 9px; background: var(--color-primary); color: white; font-weight: 750; }.submit-button:hover:not(:disabled) { background: #4338ca; }.submit-button:disabled { cursor: wait; opacity: .65; }.support { margin: 22px 0 0; color: #94a3b8; font-size: 11px; text-align: center; }
@media (max-width: 900px) { .login-page { grid-template-columns: 1fr; }.brand-panel { display: none; }.mobile-brand { display: flex; }.form-panel { min-height: 100vh; } }
@media (max-width: 520px) { .form-panel { align-items: start; padding: 22px 16px; }.login-card { margin-top: 24px; border-radius: 14px; padding: 28px 22px; box-shadow: none; } }
</style>
