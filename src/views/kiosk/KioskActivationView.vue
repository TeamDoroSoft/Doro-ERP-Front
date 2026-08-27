<script setup lang="ts">
import { onBeforeMount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useKioskSessionStore } from '@/stores/kioskSession'
import { useKioskFlowStore } from '@/stores/kioskFlow'
import { activationSecret } from '@/security/kioskCredential'
const session = useKioskSessionStore(),
  flow = useKioskFlowStore(),
  router = useRouter(),
  form = reactive({ tenantCode: '', deviceCode: '', secret: '' }),
  message = ref(
    session.deviceState === 'AUTH_FAILED'
      ? '기기 정보를 다시 확인해 주세요.'
      : '',
  )
onBeforeMount(() => flow.resetCustomer())
async function activate() {
  message.value = ''
  const secret = activationSecret(form.secret)
  if (!secret) {
    form.secret = ''
    message.value = '활성화 코드 형식을 확인해 주세요.'
    return
  }
  try {
    await session.activate(form.tenantCode.trim(), form.deviceCode.trim(), secret)
    form.secret = ''
    await router.replace('/kiosk')
  } catch {
    form.secret = ''
    message.value =
      session.deviceState === 'REVOKED'
        ? '사용할 수 없는 기기입니다. 직원에게 문의해 주세요.'
        : session.deviceState === 'INACTIVE'
          ? '현재 사용할 수 없는 기기입니다. 직원에게 문의해 주세요.'
          : '기기를 연결하지 못했습니다. 입력 내용을 확인해 주세요.'
  }
}
</script>
<template>
  <section class="activate">
    <div class="activation-panel">
      <p class="eyebrow">키오스크 연결</p>
      <h1>키오스크 연결</h1>
      <span>관리자에게 받은 기기 정보로 키오스크를 연결해 주세요.</span>
      <form @submit.prevent="activate">
        <label>업체 코드<input v-model.trim="form.tenantCode" required /></label
        ><label>기기 코드<input v-model.trim="form.deviceCode" required /></label
        ><label
          >활성화 코드<input v-model="form.secret" type="password" autocomplete="off" required
        /></label>
        <p v-if="message" role="alert">{{ message }}</p>
        <button :disabled="session.activating">
          {{ session.activating ? '연결 중…' : '기기 연결' }}
        </button>
      </form>
    </div>
  </section>
</template>
<style scoped>
.activate {
  display: grid;
  min-height: calc(100dvh - 190px);
  place-items: center;
}
.activation-panel {
  width: min(560px, 100%);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: #fff;
  padding: 36px;
}
.activate h1 { margin: 0 0 8px; font-size:30px; letter-spacing: -1px; }.eyebrow { margin: 0 0 7px; color: #087f5b; font-size: 13px; font-weight: 800; }
.activate span {
  color: #6b7280;
}
.activate form {
  display: grid;
  gap: 16px;
  margin-top: 28px;
}
.activate label {
  display: grid;
  gap: 7px;
  font-weight: 800;
}
.activate input {
  min-height: 44px;
  border: 1px solid #cbd3ce;
  border-radius: 4px;
  padding: 0 16px;
  font-size: 17px;
}
.activate button {
  min-height: 44px;
  border: 0;
  border-radius: 4px;
  background: #087f5b;
  color: #fff;
  font-size: 15px;
  font-weight: 900;
}
.activate form p {
  color: #b42318;
}
</style>
