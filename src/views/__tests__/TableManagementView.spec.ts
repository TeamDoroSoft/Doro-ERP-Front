import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/api/http'
import type { TableDetailsRequest, TableResponse, TableStatus } from '@/api/table'
import { useOperatorSessionStore, type EmployeeRole } from '@/stores/operatorSession'
import TableManagementView from '@/views/TableManagementView.vue'

const tableApi = vi.hoisted(() => ({
  getTables: vi.fn<() => Promise<TableResponse[]>>(),
  createTable: vi.fn<(request: TableDetailsRequest) => Promise<TableResponse>>(),
  updateTable: vi.fn<(id: string, request: TableDetailsRequest) => Promise<TableResponse>>(),
  changeTableStatus: vi.fn<(id: string, status: TableStatus) => Promise<TableResponse>>(),
}))

vi.mock('@/api/table', () => tableApi)

const activeTable = {
  id: 'table-1',
  tableNumber: 'A-1',
  displayName: '창가',
  status: 'ACTIVE' as const,
  version: 0,
}

describe('TableManagementView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    setActivePinia(createPinia())
    tableApi.getTables.mockResolvedValue([activeTable])
    tableApi.createTable.mockResolvedValue(activeTable)
    tableApi.updateTable.mockResolvedValue(activeTable)
    tableApi.changeTableStatus.mockResolvedValue({ ...activeTable, status: 'INACTIVE' })
  })

  it('shows loading and then the active table list', async () => {
    let resolveTables!: (tables: typeof activeTable[]) => void
    tableApi.getTables.mockReturnValue(
      new Promise((resolve) => {
        resolveTables = resolve
      }),
    )
    const wrapper = mountView('STAFF')

    expect(wrapper.text()).toContain('테이블 목록을 불러오는 중입니다')
    resolveTables([activeTable])
    await flushPromises()

    expect(wrapper.text()).toContain('A-1')
    expect(wrapper.text()).toContain('창가')
  })

  it('shows the empty-list state', async () => {
    tableApi.getTables.mockResolvedValue([])
    const wrapper = mountView('STAFF')
    await flushPromises()

    expect(wrapper.text()).toContain('등록된 활성 테이블이 없습니다.')
  })

  it('shows a list failure and retry action', async () => {
    tableApi.getTables.mockRejectedValue(
      new ApiError(500, { status: 500, code: 'INTERNAL_SERVER_ERROR', detail: '목록 조회 실패' }),
    )
    const wrapper = mountView('STAFF')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('목록 조회 실패')
    expect(wrapper.text()).toContain('다시 시도')
  })

  it.each<EmployeeRole>(['OWNER', 'MANAGER'])(
    '%s can see create, edit, and deactivate controls',
    async (role) => {
      const wrapper = mountView(role)
      await flushPromises()

      expect(wrapper.text()).toContain('테이블 등록')
      expect(wrapper.text()).toContain('수정')
      expect(wrapper.text()).toContain('비활성화')
    },
  )

  it('keeps STAFF read-only while showing the active list', async () => {
    const wrapper = mountView('STAFF')
    await flushPromises()

    expect(wrapper.text()).toContain('A-1')
    expect(wrapper.text()).not.toContain('테이블 등록')
    expect(wrapper.text()).not.toContain('수정')
    expect(wrapper.text()).not.toContain('비활성화')
  })

  it('creates a table and refreshes the backend list', async () => {
    const wrapper = mountView('OWNER')
    await flushPromises()
    await wrapper.get('button.primary').trigger('click')
    await wrapper.get('input[name="tableNumber"]').setValue('  B-2  ')
    await wrapper.get('input[name="displayName"]').setValue('  홀  ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(tableApi.createTable).toHaveBeenCalledWith({ tableNumber: 'B-2', displayName: '홀' })
    expect(tableApi.getTables).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('테이블을 등록했습니다.')
  })

  it('updates a table and refreshes the backend list', async () => {
    const wrapper = mountView('MANAGER')
    await flushPromises()
    await findButton(wrapper, '수정').trigger('click')
    await wrapper.get('input[name="displayName"]').setValue('중앙 홀')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(tableApi.updateTable).toHaveBeenCalledWith('table-1', {
      tableNumber: 'A-1',
      displayName: '중앙 홀',
    })
    expect(tableApi.getTables).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('테이블 정보를 수정했습니다.')
  })

  it('deactivates a table and refreshes the active list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mountView('OWNER')
    await flushPromises()
    await findButton(wrapper, '비활성화').trigger('click')
    await flushPromises()

    expect(tableApi.changeTableStatus).toHaveBeenCalledWith('table-1', 'INACTIVE')
    expect(tableApi.getTables).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('테이블을 비활성화했습니다.')
  })

  it('connects a duplicate number problem to the table-number field', async () => {
    tableApi.createTable.mockRejectedValue(
      problem(409, 'TABLE_NUMBER_DUPLICATED', '중복 번호'),
    )
    const wrapper = mountView('OWNER')
    await flushPromises()
    await wrapper.get('button.primary').trigger('click')
    await fillAndSubmit(wrapper)

    expect(wrapper.text()).toContain('이미 사용 중인 테이블 번호입니다.')
  })

  it('shows a permission problem without exposing raw JSON', async () => {
    tableApi.createTable.mockRejectedValue(
      problem(403, 'TABLE_MANAGEMENT_FORBIDDEN', '{ raw: forbidden }'),
    )
    const wrapper = mountView('OWNER')
    await flushPromises()
    await wrapper.get('button.primary').trigger('click')
    await fillAndSubmit(wrapper)

    expect(wrapper.get('[role="alert"]').text()).toBe('테이블 관리 권한이 없습니다.')
    expect(wrapper.text()).not.toContain('raw: forbidden')
  })

  it('shows a concurrent-update message and reloads the list', async () => {
    tableApi.updateTable.mockRejectedValue(
      problem(409, 'TABLE_CONCURRENT_MODIFICATION', 'optimistic lock'),
    )
    const wrapper = mountView('MANAGER')
    await flushPromises()
    await findButton(wrapper, '수정').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('다른 사용자가 먼저 수정했습니다.')
    expect(tableApi.getTables).toHaveBeenCalledTimes(2)
  })

  it('shows a not-found message and reloads the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    tableApi.changeTableStatus.mockRejectedValue(problem(404, 'TABLE_NOT_FOUND', 'tenant detail'))
    const wrapper = mountView('OWNER')
    await flushPromises()
    await findButton(wrapper, '비활성화').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('테이블 정보를 찾을 수 없습니다.')
    expect(wrapper.text()).not.toContain('tenant detail')
    expect(tableApi.getTables).toHaveBeenCalledTimes(2)
  })

  function mountView(role: EmployeeRole) {
    useOperatorSessionStore().setRole(role)
    return mount(TableManagementView)
  }

  function findButton(wrapper: ReturnType<typeof mount>, label: string) {
    const button = wrapper.findAll('button').find((candidate) => candidate.text() === label)
    if (!button) throw new Error(`button not found: ${label}`)
    return button
  }

  async function fillAndSubmit(wrapper: ReturnType<typeof mount>) {
    await wrapper.get('input[name="tableNumber"]').setValue('A-1')
    await wrapper.get('input[name="displayName"]').setValue('창가')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
  }

  function problem(status: number, code: string, detail: string) {
    return new ApiError(status, { status, code, detail, fieldErrors: [], requestId: 'req-1' })
  }
})
