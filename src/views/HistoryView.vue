<script setup lang="ts">
import { ref } from 'vue'
import AuditLogView from './AuditLogView.vue'
import SecurityHistoryView from './SecurityHistoryView.vue'
const tab = ref<'audit' | 'security'>('audit')
</script>
<template>
  <section class="history">
    <nav>
      <button :class="{ active: tab === 'audit' }" @click="tab = 'audit'">감사 이력</button
      ><button :class="{ active: tab === 'security' }" @click="tab = 'security'">보안 이력</button>
    </nav>
    <AuditLogView v-if="tab === 'audit'" /><template v-else
      ><header>
        <p>보안·인증 기록</p>
        <h1>보안 이력</h1>
        <span>로그인과 권한 관련 이벤트를 확인합니다.</span>
      </header>
      <SecurityHistoryView
    /></template>
  </section>
</template>
<style scoped>
.history {
  display: grid;
  gap: 18px;
}
.history > nav {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--color-border);
}
nav button {
  border: 0;
  border-bottom: 3px solid transparent;
  background: none;
  padding: 12px 16px;
}
.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 750;
}
header p {
  margin: 0;
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 800;
}
header h1 {
  margin: 5px 0;
  color: var(--color-heading);
  font-size: 25px;
}
header span {
  color: var(--color-muted);
  font-size: 13px;
}
</style>
