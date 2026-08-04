<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{
  accessUrl: string
  tableNumber: string
}>()

const emit = defineEmits<{
  printed: []
}>()

const qrDataUrl = ref('')

async function renderQr() {
  if (!props.accessUrl) {
    qrDataUrl.value = ''
    return
  }
  qrDataUrl.value = await QRCode.toDataURL(props.accessUrl, {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 384,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })
}

function printQr() {
  window.print()
  emit('printed')
}

onMounted(renderQr)
watch(() => props.accessUrl, renderQr)
</script>

<template>
  <section class="qr-print-panel" aria-labelledby="qr-print-title">
    <div class="qr-print-panel__body">
      <h2 id="qr-print-title">QR 인쇄</h2>
      <p>테이블 {{ tableNumber }}</p>
      <img
        v-if="qrDataUrl"
        class="qr-print-panel__image"
        :src="qrDataUrl"
        alt="테이블 접속 QR 코드"
        data-qr-error-correction="M"
        data-minimum-print-size="32mm"
      />
      <p class="qr-print-panel__caption">주문을 시작하려면 QR을 스캔하세요.</p>
    </div>
    <div class="qr-print-panel__actions no-print">
      <button type="button" class="button button--primary" @click="printQr">인쇄</button>
    </div>
  </section>
</template>

<style scoped>
.qr-print-panel {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem;
  background: var(--color-surface);
}

.qr-print-panel__body {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  color: var(--color-heading);
}

.qr-print-panel__body h2,
.qr-print-panel__body p {
  margin: 0;
}

.qr-print-panel__image {
  width: 40mm;
  height: 40mm;
  min-width: 32mm;
  min-height: 32mm;
  background: #ffffff;
  image-rendering: pixelated;
}

.qr-print-panel__caption {
  font-size: 0.9rem;
  color: var(--color-text-soft);
}

.qr-print-panel__actions {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

@media print {
  body * {
    visibility: hidden;
  }

  .qr-print-panel,
  .qr-print-panel * {
    visibility: visible;
  }

  .qr-print-panel {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    border: 0;
    padding: 0;
    background: #ffffff;
  }

  .qr-print-panel__image {
    width: 40mm;
    height: 40mm;
  }

  .no-print {
    display: none !important;
  }
}
</style>
