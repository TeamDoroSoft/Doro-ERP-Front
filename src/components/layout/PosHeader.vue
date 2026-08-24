<script setup lang="ts">
import { useOperatorSessionStore } from '@/stores/operatorSession'
import AppIcon from '@/components/ui/AppIcon.vue'
import { defineAsyncComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import { logout } from '@/api/auth'
import { ApiError } from '@/api/http'

defineEmits<{ 'toggle-menu': [] }>()

const session = useOperatorSessionStore()
const router = useRouter()
const menuOpen = ref(false)
const loggingOut = ref(false)
const logoutError = ref('')

const DevPreviewBadge = import.meta.env.DEV
  ? defineAsyncComponent(() => import('@/components/dev/DevPreviewBadge.vue'))
  : null

async function signOut() {
  if (loggingOut.value) return
  if (session.isPreview) {
    session.clearSession()
    await router.push('/pos/login')
    return
  }
  loggingOut.value = true
  logoutError.value = ''
  try {
    await logout()
    session.clearSession()
    await router.push('/pos/login')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      session.clearSession()
      await router.push('/pos/login')
    } else {
      logoutError.value =
        error instanceof ApiError && error.status === 403
          ? '로그아웃 요청을 확인할 수 없습니다. 다시 로그인해 주세요.'
          : '로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    }
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <header class="header">
    <button class="menu-button" type="button" aria-label="운영 메뉴 열기" @click="$emit('toggle-menu')">
      <AppIcon name="menu" :size="22" />
    </button>
    <div class="store-context">
      <span class="status-dot" aria-hidden="true" />
      <div>
        <strong>{{ session.tenantCode || '매장 미선택' }}</strong>
        <span>현재 로그인한 업체입니다.</span>
      </div>
      <component :is="DevPreviewBadge" v-if="DevPreviewBadge && session.isPreview" />
    </div>
    <div class="header-actions">
      <div class="profile-menu">
        <button
          class="profile"
          type="button"
          aria-label="사용자 메뉴"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <span class="avatar">{{ session.role?.slice(0, 1) ?? 'U' }}</span>
          <div>
            <strong>{{ session.roleLabel }}</strong>
            <span>{{ session.tenantCode || '업체 확인 전' }}</span>
          </div>
          <span class="chevron">⌄</span>
        </button>
        <div v-if="menuOpen" class="profile-popover">
          <div class="identity-summary">
            <strong>{{ session.roleLabel }}</strong>
            <span>직원 계정으로 로그인했습니다.</span>
          </div>
          <RouterLink to="/pos/account/change-password" @click="menuOpen = false">
            비밀번호 변경
          </RouterLink>
          <button type="button" :disabled="loggingOut" @click="signOut">
            {{ loggingOut ? '로그아웃 중…' : '로그아웃' }}
          </button>
        </div>
      </div>
    </div>
  </header>
  <p v-if="logoutError" class="logout-error" role="alert">{{ logoutError }}</p>
</template>

<style scoped>
.header { position:sticky; top:0; z-index:10; display:flex; min-height:60px; align-items:center; justify-content:space-between; gap:20px; border-bottom:1px solid #e7eaf0; background:rgb(255 255 255 / 96%); padding:0 30px; backdrop-filter:blur(14px); }
.menu-button { display: none; border: 0; background: transparent; color: var(--color-heading); font-size: 22px; }
.store-context, .profile, .header-actions { display: flex; align-items: center; gap: 10px; }
.store-context div, .profile div { display: grid; }
.store-context strong, .profile strong { color: var(--color-heading); font-size: 13px; }
.store-context span, .profile span { color: var(--color-muted); font-size: 11px; }
.status-dot { width:7px; height:7px; border-radius:50%; background:#3b82f6; box-shadow:0 0 0 4px #eff6ff; }
.notification { display: grid; width: 38px; height: 38px; place-items: center; border: 1px solid var(--color-border); border-radius: 9px; background: white; color: var(--color-muted); }
.avatar { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 50%; background: var(--color-primary-soft); color: var(--color-primary) !important; font-weight: 800; }
.profile-menu { position: relative; }
.profile { border: 0; border-radius: 6px; background: transparent; padding: 5px 7px; text-align: left; }
.profile:hover { background: #f8fafc; }
.chevron { margin-left: 4px; font-size: 14px !important; }
.profile-popover { position: absolute; top: calc(100% + 8px); right: 0; display: grid; width: 220px; overflow: hidden; border: 1px solid var(--color-border); border-radius: 8px; background: white; padding: 6px; box-shadow: var(--shadow-float); }
.identity-summary { display: grid; border-bottom: 1px solid var(--color-border); padding: 10px; }
.identity-summary strong { color: var(--color-heading); }
.identity-summary span { color: var(--color-muted); font-size: 11px; }
.profile-popover a, .profile-popover button { border: 0; border-radius: 8px; background: white; padding: 10px; color: var(--color-text); text-align: left; }
.profile-popover a:hover, .profile-popover button:hover { background: var(--color-primary-soft); color: var(--color-primary); }
.logout-error { position: fixed; top: 82px; right: 24px; z-index: 15; border: 1px solid #fecaca; border-radius: 9px; background: #fef2f2; padding: 10px 14px; color: #991b1b; font-size: 12px; }
@media (max-width: 900px) { .menu-button { display: block; } .header { padding: 0 18px; } }
@media (max-width: 600px) { .store-context span, .profile div { display: none; } }
</style>
