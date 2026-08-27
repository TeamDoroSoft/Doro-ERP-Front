<script setup lang="ts">
import { useKioskEntryRegistration } from '@/composables/useKioskEntryRegistration'

const registration = useKioskEntryRegistration()
</script>

<template>
  <section class="entry-page">
    <div v-if="registration.registeredPartySize.value" class="entry-panel result" aria-live="polite">
      <p>입장 대기 등록 완료</p>
      <h1>직원의 안내를 기다려 주세요</h1>
      <dl>
        <div><dt>인원수</dt><dd>{{ registration.registeredPartySize.value }}명</dd></div>
      </dl>
      <button type="button" @click="registration.beginAnother">새 대기 등록</button>
    </div>

    <form v-else class="entry-panel" @submit.prevent="registration.submit">
      <p>입장 대기</p>
      <h1>몇 분이 함께 오셨나요?</h1>
      <label for="party-size">인원수</label>
      <div class="party-input">
        <input
          id="party-size"
          v-model.number="registration.partySize.value"
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          autocomplete="off"
          autofocus
          aria-describedby="privacy-note"
        />
        <span>명</span>
      </div>
      <small id="privacy-note">이름이나 전화번호는 입력하지 않습니다.</small>
      <p v-if="registration.errorMessage.value" class="error" role="alert">
        {{ registration.errorMessage.value }}
      </p>
      <button
        type="submit"
        :disabled="!registration.valid.value || registration.submitting.value"
      >
        {{ registration.submitting.value ? '등록 확인 중…' : '대기 등록' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.entry-page { display: grid; min-height: calc(100dvh - 150px); place-items: center; }
.entry-panel { display: grid; width: min(620px, 100%); gap: 18px; border: 1px solid #cfd6d1; border-radius: 8px; background: #fff; padding: clamp(28px, 6vw, 56px); text-align: center; }
.entry-panel > p:first-child { margin: 0; color: #087f5b; font-weight: 800; }
.entry-panel h1 { margin: 0 0 12px; font-size: clamp(30px, 5vw, 42px); letter-spacing: -0.04em; }
.entry-panel label { font-weight: 800; }
.party-input { display: flex; align-items: center; justify-content: center; gap: 12px; }
.party-input input { width: min(260px, 75%); height: 88px; border: 2px solid #8a9690; border-radius: 7px; font-size: 42px; font-weight: 800; text-align: center; }
.party-input span { font-size: 24px; font-weight: 800; }
.entry-panel small { color: #657068; }
.entry-panel button { min-height: 64px; border: 0; border-radius: 5px; background: #087f5b; color: #fff; font-size: 19px; font-weight: 900; }
.entry-panel button:disabled { opacity: 0.45; }
.error { margin: 0; border: 1px solid #f1c4bd; border-radius: 4px; background: #fff6f4; padding: 13px; color: #a13b32; }
.result dl { display: grid; gap: 12px; margin: 0; }
.result dl div { display: flex; justify-content: space-between; border-bottom: 1px solid #e4e8e5; padding: 13px 0; }
.result dt { color: #657068; }.result dd { margin: 0; font-weight: 800; }
</style>
