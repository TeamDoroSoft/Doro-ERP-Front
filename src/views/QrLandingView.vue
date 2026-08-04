<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ApiError, problemMessage, verifyQrTableAccess, type QrTableAccessResponse } from '@/api/table'

type LandingState =
  | 'verifying'
  | 'ready'
  | 'missing-token'
  | 'denied'
  | 'rate-limited'
  | 'host-denied'
  | 'network-error'

const state = ref<LandingState>('verifying')
const response = ref<QrTableAccessResponse | null>(null)
const message = ref('QR을 확인하고 있습니다.')
const pendingToken = ref('')

onMounted(() => {
  void verifyFromFragment()
})

async function verifyFromFragment() {
  const token = pendingToken.value || readTokenFromFragment()
  pendingToken.value = token
  removeFragment()
  if (!token) {
    state.value = 'missing-token'
    message.value = 'QR 정보를 찾을 수 없습니다.'
    return
  }

  try {
    const result = await verifyQrTableAccess(token)
    response.value = result
    state.value = result.accessible ? 'ready' : 'denied'
    message.value = result.accessible
      ? '테이블 접근이 확인됐습니다.'
      : '현재 이용할 수 없는 QR입니다.'
    pendingToken.value = ''
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 'QR_RATE_LIMITED') {
        state.value = 'rate-limited'
      } else if (error.code === 'QR_HOST_FORBIDDEN') {
        state.value = 'host-denied'
        pendingToken.value = ''
      } else {
        state.value = 'denied'
        pendingToken.value = ''
      }
      message.value = problemMessage(error)
      return
    }
    state.value = 'network-error'
    message.value = '네트워크 상태를 확인한 뒤 다시 시도하세요.'
  }
}

function readTokenFromFragment() {
  const fragment = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  const params = new URLSearchParams(fragment)
  return params.get('token')?.trim() ?? ''
}

function removeFragment() {
  if (window.location.hash) {
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search)
  }
}
</script>

<template>
  <main class="qr-landing" :data-state="state">
    <section class="qr-landing__panel" aria-labelledby="qr-title">
      <p class="eyebrow">Doro ERP</p>
      <h1 id="qr-title">테이블 QR</h1>
      <p class="landing-message" role="status">{{ message }}</p>

      <dl v-if="response && state === 'ready'" class="landing-facts">
        <div>
          <dt>매장</dt>
          <dd>{{ response.store.tenantId }}</dd>
        </div>
        <div>
          <dt>테이블</dt>
          <dd>{{ response.table.displayName }} · {{ response.table.tableNumber }}</dd>
        </div>
        <div>
          <dt>Session</dt>
          <dd>{{ response.session.sessionId }}</dd>
        </div>
      </dl>

      <button
        v-if="state === 'network-error' || state === 'rate-limited'"
        type="button"
        class="button button--primary"
        @click="verifyFromFragment"
      >
        다시 시도
      </button>
    </section>
  </main>
</template>

<style scoped>
.qr-landing {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 1rem;
  background: #eef4f1;
  color: var(--color-text);
}

.qr-landing__panel {
  display: grid;
  width: min(28rem, 100%);
  gap: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.25rem;
  background: #ffffff;
}

.qr-landing h1,
.qr-landing p {
  margin: 0;
}

.landing-message {
  color: var(--color-heading);
  font-size: 1.05rem;
}

.landing-facts {
  display: grid;
  gap: 0.65rem;
  margin: 0;
}

.landing-facts div {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: 0.75rem;
}

.landing-facts dt {
  color: var(--color-text-soft);
}

.landing-facts dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--color-heading);
}
</style>
