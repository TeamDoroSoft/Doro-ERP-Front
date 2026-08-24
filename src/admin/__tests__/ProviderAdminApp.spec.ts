import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProviderAdminApp from '../ProviderAdminApp.vue'

const adminApi = vi.hoisted(() => ({
  changeStatus: vi.fn<() => Promise<unknown>>(),
  createOwner: vi.fn<() => Promise<unknown>>(),
  getSession: vi.fn<() => Promise<unknown>>(),
  getTenant: vi.fn<() => Promise<unknown>>(),
  getTenants: vi.fn<() => Promise<unknown>>(),
  logout: vi.fn<() => Promise<unknown>>(),
  provision: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('@/api/providerAdmin', () => ({
  changeProviderAdminTenantStatus: adminApi.changeStatus,
  createProviderAdminInitialOwner: adminApi.createOwner,
  getProviderAdminSession: adminApi.getSession,
  getProviderAdminTenant: adminApi.getTenant,
  getProviderAdminTenants: adminApi.getTenants,
  logoutProviderAdmin: adminApi.logout,
  provisionProviderAdminTenant: adminApi.provision,
  providerAdminLoginUrl: () => '/api/v1/provider/auth/login',
  providerAdminErrorMessage: () => '안전한 관리자 오류',
  isProviderAdminUnauthenticated: (error: unknown) =>
    typeof error === 'object' && error !== null && 'status' in error && error.status === 401,
}))

describe('ProviderAdminApp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminApi.getSession.mockResolvedValue({
      adminId: '90000000-0000-0000-0000-000000000009',
      expiresAt: '2026-08-21T10:00:00Z',
    })
    adminApi.getTenants.mockResolvedValue(tenantPage())
    adminApi.getTenant.mockResolvedValue(tenantDetail())
    adminApi.provision.mockResolvedValue({ tenantId: tenantDetail().tenantId })
    adminApi.createOwner.mockResolvedValue({ employeeId: 'employee-1' })
    adminApi.changeStatus.mockResolvedValue({
      tenantId: tenantDetail().tenantId,
      status: 'INACTIVE',
    })
    adminApi.logout.mockResolvedValue(undefined)
  })

  it('authenticates and loads the server-backed tenant page', async () => {
    const wrapper = mount(ProviderAdminApp)
    await flushPromises()

    expect(adminApi.getSession).toHaveBeenCalledOnce()
    expect(adminApi.getTenants).toHaveBeenCalledWith({
      code: '',
      name: '',
      status: undefined,
      page: 0,
      size: 20,
    })
    expect(wrapper.text()).toContain('도로 운영')
    expect(wrapper.text()).not.toContain('개발용 미리보기')
  })

  it('shows a full-page Admin Edge login link when the session is absent', async () => {
    adminApi.getSession.mockRejectedValue({ status: 401, code: 'UNAUTHENTICATED' })

    const wrapper = mount(ProviderAdminApp)
    await flushPromises()

    expect(wrapper.get('a').attributes('href')).toBe('/api/v1/provider/auth/login')
    expect(adminApi.getTenants).not.toHaveBeenCalled()
  })

  it('provisions a tenant with every required Service API field', async () => {
    const wrapper = mount(ProviderAdminApp)
    await flushPromises()
    await wrapper.get('[data-test="new-tenant"]').trigger('click')
    await wrapper.get('input[name="tenant-code"]').setValue('doro-new')
    await wrapper.get('input[name="tenant-name"]').setValue('도로 신규')
    await wrapper.get('input[name="store-name"]').setValue('서울 본점')
    await wrapper.get('input[name="timezone"]').setValue('Asia/Seoul')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(adminApi.provision).toHaveBeenCalledWith({
      tenantCode: 'doro-new',
      tenantName: '도로 신규',
      storeName: '서울 본점',
      timezone: 'Asia/Seoul',
    })
    expect(adminApi.getTenant).toHaveBeenCalledWith(tenantDetail().tenantId)
  })

  it('creates the initial OWNER using a password input and never renders its value', async () => {
    const wrapper = mount(ProviderAdminApp)
    await flushPromises()
    await wrapper.get('.text-button').trigger('click')
    await flushPromises()
    await wrapper.get('input[name="owner-login-id"]').setValue('owner')
    await wrapper.get('input[name="owner-temporary-password"]').setValue('temporary-secret')
    const forms = wrapper.findAll('form')
    await forms[forms.length - 1]!.trigger('submit')
    await flushPromises()

    expect(adminApi.createOwner).toHaveBeenCalledWith(tenantDetail().tenantId, {
      loginId: 'owner',
      temporaryPassword: 'temporary-secret',
    })
    expect(wrapper.text()).not.toContain('temporary-secret')
  })
})

function tenantPage() {
  return {
    items: [
      {
        tenantId: tenantDetailId,
        tenantCode: 'doro',
        name: '도로 운영',
        status: 'ACTIVE',
        createdAt: '2026-08-21T00:00:00Z',
        store: {
          storeId: '22222222-2222-4222-8222-222222222222',
          name: '서울 본점',
          status: 'ACTIVE',
        },
        firstOwnerRequired: true,
      },
    ],
    page: 0,
    size: 20,
    totalCount: '1',
    totalPages: '1',
  }
}

const tenantDetailId = '11111111-1111-4111-8111-111111111111'

function tenantDetail() {
  return {
    ...tenantPage().items[0]!,
    updatedAt: '2026-08-21T00:00:00Z',
  }
}
