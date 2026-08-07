import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { CatalogAuth, CatalogRoleCode } from '@/api/catalog'

/**
 * 메뉴 운영 화면이 사용하는 Actor Context.
 *
 * 02 계정·역할·기기 인증의 직원 Session이 아직 구현되지 않아 Edge가 붙일 Context를 화면에서 선택한다.
 * 화면에서 버튼을 숨기는 것은 편의일 뿐이며 최종 권한 검증은 Commerce Backend가 수행한다.
 */
export const useCatalogSessionStore = defineStore('catalogSession', () => {
  const apiBaseUrl = ref(import.meta.env.VITE_API_BASE_URL ?? '')
  const tenantId = ref(import.meta.env.VITE_TENANT_ID ?? '11111111-1111-1111-1111-111111111111')
  const storeId = ref(import.meta.env.VITE_STORE_ID ?? 'aaaaaaaa-1111-1111-1111-111111111111')
  const actorId = ref(import.meta.env.VITE_ACTOR_ID ?? '33333333-3333-3333-3333-333333333333')
  const roleCode = ref<CatalogRoleCode>('MANAGER')

  const auth = computed<CatalogAuth>(() => ({
    apiBaseUrl: apiBaseUrl.value,
    tenantId: tenantId.value,
    storeId: storeId.value,
    actorId: actorId.value,
    roleCode: roleCode.value,
  }))

  /** Category·상품·가격·판매 상태 관리 (OWNER, MANAGER) */
  const canManageCatalog = computed(() => ['OWNER', 'MANAGER'].includes(roleCode.value))
  /** 품절 변경 (OWNER, MANAGER, STAFF) */
  const canChangeSoldOut = computed(() => ['OWNER', 'MANAGER', 'STAFF'].includes(roleCode.value))
  /** 메뉴 조회 (전 Role) */
  const canReadMenu = computed(() => true)

  return {
    apiBaseUrl,
    tenantId,
    storeId,
    actorId,
    roleCode,
    auth,
    canManageCatalog,
    canChangeSoldOut,
    canReadMenu,
  }
})
