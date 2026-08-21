/**
 * Provider Admin UI preview fixtures.
 *
 * These values deliberately do not mirror an HTTP request or response contract. They exist only
 * to demonstrate the UI while HTTP-EDGE-ADMIN-001 and HTTP-SA-ADMIN-001 remain unapproved.
 */
export type TenantStatus = 'ACTIVE' | 'INACTIVE'
export type OwnerProvisioningState = 'COMPLETED' | 'REQUIRED' | 'FAILED'

export interface PreviewTenant {
  id: string
  name: string
  code: string
  status: TenantStatus
  firstStore: { name: string; status: TenantStatus } | null
  owner: { state: OwnerProvisioningState; message?: string }
  createdLabel: string
}

export const PREVIEW_FIXTURE_NOTICE =
  '개발용 미리보기'

export function createPreviewTenants(): PreviewTenant[] {
  return [
    { id: 'preview-tenant-001', name: '도로운영 강남점', code: 'doro-gangnam', status: 'ACTIVE', firstStore: { name: '강남 본점', status: 'ACTIVE' }, owner: { state: 'COMPLETED' }, createdLabel: '2026-08-20' },
    { id: 'preview-tenant-002', name: '스푼키친 성수', code: 'spoon-seongsu', status: 'ACTIVE', firstStore: { name: '성수 1호점', status: 'ACTIVE' }, owner: { state: 'FAILED', message: '관리자 계정을 등록하지 못했습니다. 업체와 매장 정보는 정상적으로 저장되어 있습니다.' }, createdLabel: '2026-08-21' },
    { id: 'preview-tenant-003', name: '오후식당 연남', code: 'pm-yeonnam', status: 'ACTIVE', firstStore: { name: '연남점', status: 'ACTIVE' }, owner: { state: 'REQUIRED' }, createdLabel: '2026-08-21' },
    { id: 'preview-tenant-004', name: '브릭 베이커리', code: 'brick-bakery', status: 'INACTIVE', firstStore: { name: '서촌점', status: 'ACTIVE' }, owner: { state: 'COMPLETED' }, createdLabel: '2026-08-19' },
    { id: 'preview-tenant-005', name: '해밀 카페', code: 'haemil-cafe', status: 'ACTIVE', firstStore: { name: '판교점', status: 'INACTIVE' }, owner: { state: 'COMPLETED' }, createdLabel: '2026-08-18' },
    { id: 'preview-tenant-006', name: '모노 다이닝', code: 'mono-dining', status: 'ACTIVE', firstStore: { name: '여의도점', status: 'ACTIVE' }, owner: { state: 'REQUIRED' }, createdLabel: '2026-08-17' },
  ]
}
