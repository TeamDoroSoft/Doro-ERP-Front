<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useKioskSessionStore } from '@/stores/kioskSession'
const session = useKioskSessionStore(),
  router = useRouter(),
  form = reactive({ tenantCode: '', deviceCode: '', secret: '' }),
  message = ref(
    session.deviceState === 'AUTH_FAILED'
      ? '기기 인증을 다시 확인해 주세요.'
      : '',
  )
async function activate() {
  message.value = ''
  try {
    await session.activate(form.tenantCode, form.deviceCode, form.secret)
    form.secret = ''
    await router.replace('/kiosk')
  } catch {
    form.secret = ''
    message.value =
      session.deviceState === 'REVOKED'
        ? '폐기된 장치입니다. 관리자에게 문의해주세요.'
        : session.deviceState === 'INACTIVE'
          ? '비활성 장치입니다. 관리자에게 문의해주세요.'
          : '기기 인증에 실패했습니다. 입력 내용을 확인해주세요.'
  }
}
</script>
<template>
  <section class="activate">
    <div>
      <p>Doro Kiosk</p>
      <h1>키오스크 활성화</h1>
      <span>관리자에게 발급받은 기기 정보는 최초 활성화에만 사용됩니다.</span>
      <form @submit.prevent="activate">
        <label>업체 코드<input v-model.trim="form.tenantCode" required /></label
        ><label>기기 코드<input v-model.trim="form.deviceCode" required /></label
        ><label
          >일회성 Secret<input v-model="form.secret" type="password" autocomplete="off" required
        /></label>
        <p v-if="message" role="alert">{{ message }}</p>
        <button :disabled="session.activating">
          {{ session.activating ? '인증 중…' : '기기 활성화' }}
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
.activate > div {
  width: min(560px, 100%);
  border-radius: 32px;
  background: #fff;
  padding: 44px;
}
.activate h1 {
  font-size: 36px;
}
.activate span {
  color: #68766f;
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
  min-height: 54px;
  border: 2px solid #ddd6ca;
  border-radius: 16px;
  padding: 0 16px;
  font-size: 17px;
}
.activate button {
  min-height: 62px;
  border: 0;
  border-radius: 18px;
  background: #126a5a;
  color: #fff;
  font-size: 18px;
  font-weight: 900;
}
.activate form p {
  color: #b42318;
}
</style>
