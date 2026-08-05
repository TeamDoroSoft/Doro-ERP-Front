import { createPinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TableOperationsView from '@/views/TableOperationsView.vue'

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>

const tableA = {
  tableId: 'table-a',
  tableNumber: 'A1',
  displayName: '창가',
  seatCapacity: 4,
  active: true,
  usageStatus: 'VACANT',
  version: 3,
}

describe('TableOperationsView', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('loads table list and submits the accessible create form to the real table API', async () => {
    const fetchMock = vi.fn<FetchMock>((input, init) => {
      const path = String(input)
      const method = init?.method ?? 'GET'
      if (path === '/tables' && method === 'GET') {
        return Promise.resolve(jsonResponse([tableA]))
      }
      if (path.includes('/sessions/current/orders')) {
        return Promise.resolve(jsonResponse({ session: null, items: [], nextCursor: null }))
      }
      if (path.includes('/sessions/history')) {
        return Promise.resolve(jsonResponse({ items: [], nextCursor: null }))
      }
      if (path === '/tables' && method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            ...tableA,
            tableId: 'table-b',
            tableNumber: 'B2',
            displayName: '홀',
            version: 1,
          }),
        )
      }
      return Promise.reject(new Error(`unexpected ${method} ${path}`))
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('창가')
    await clickButton(wrapper, '등록')
    await wrapper.get('#table-number').setValue('')
    await wrapper.get('#display-name').setValue('')
    await wrapper.get('#seat-capacity').setValue(0)
    await submitTableForm(wrapper)

    expect(wrapper.text()).toContain('테이블 번호를 입력하세요.')
    expect(wrapper.get('#table-number').attributes('aria-describedby')).toBe('table-number-error')

    await wrapper.get('#table-number').setValue('B2')
    await wrapper.get('#display-name').setValue('홀')
    await wrapper.get('#seat-capacity').setValue(2)
    await submitTableForm(wrapper)
    await flushPromises()

    const createCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input) === '/tables' && init?.method === 'POST',
    )
    expect(createCall).toBeTruthy()
    const headers = createCall?.[1]?.headers as Headers
    expect(headers.get('Idempotency-Key')).toMatch(/^table-create-/)
    expect(wrapper.text()).toContain('테이블을 등록했습니다.')
    expect(wrapper.text()).toContain('B2')
  })

  it('shows version conflict and keeps refresh action available', async () => {
    const fetchMock = vi.fn<FetchMock>((input, init) => {
      const path = String(input)
      const method = init?.method ?? 'GET'
      if (path === '/tables') {
        return Promise.resolve(jsonResponse([tableA]))
      }
      if (path.includes('/sessions/current/orders')) {
        return Promise.resolve(jsonResponse({ session: null, items: [], nextCursor: null }))
      }
      if (path.includes('/sessions/history')) {
        return Promise.resolve(jsonResponse({ items: [], nextCursor: null }))
      }
      if (path === '/tables/table-a' && method === 'PUT') {
        return Promise.resolve(
          jsonResponse({ code: 'PRECONDITION_FAILED', detail: 'version mismatch' }, false, 412),
        )
      }
      return Promise.reject(new Error(`unexpected ${method} ${path}`))
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mountView()
    await flushPromises()

    await clickButton(wrapper, '수정')
    await wrapper.get('#display-name').setValue('새 이름')
    await submitTableForm(wrapper)
    await flushPromises()

    const updateCall = fetchMock.mock.calls.find(([input]) => String(input) === '/tables/table-a')
    const headers = updateCall?.[1]?.headers as Headers
    expect(headers.get('If-Match')).toBe('3')
    expect(wrapper.text()).toContain('최신 정보가 변경됐습니다.')
    expect(wrapper.text()).toContain('최신 정보 조회')
  })

  it('handles qr issue replay without exposing the access token as text', async () => {
    const fetchMock = vi.fn<FetchMock>((input, init) => {
      const path = String(input)
      const method = init?.method ?? 'GET'
      if (path === '/tables') {
        return Promise.resolve(jsonResponse([tableA]))
      }
      if (path.includes('/sessions/current/orders')) {
        return Promise.resolve(jsonResponse({ session: null, items: [], nextCursor: null }))
      }
      if (path.includes('/sessions/history')) {
        return Promise.resolve(jsonResponse({ items: [], nextCursor: null }))
      }
      if (path === '/tables/table-a/qr-credentials' && method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            credentialId: 'cred-1',
            tableId: 'table-a',
            predecessorCredentialId: null,
            status: 'ACTIVE',
            issuedAt: '2026-08-04T12:00:00Z',
            accessUrl: 'https://store.example/qr#token=secret-token',
          }),
        )
      }
      if (path === '/tables/table-a/qr-credentials/reissue' && method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            credentialId: 'cred-1',
            tableId: 'table-a',
            predecessorCredentialId: null,
            status: 'ACTIVE',
            issuedAt: '2026-08-04T12:00:00Z',
          }),
        )
      }
      return Promise.reject(new Error(`unexpected ${method} ${path}`))
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mountView()
    await flushPromises()

    await clickButton(wrapper, '최초 발급')
    await flushPromises()

    expect(wrapper.find('[data-test="qr-print"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('secret-token')

    await clickButton(wrapper, '재발급')
    await flushPromises()

    expect(wrapper.text()).toContain('보안상 QR URL은 다시 표시되지 않습니다.')
  })

  it('starts and closes sessions while showing close blockers and order history', async () => {
    let closeBlocked = true
    const fetchMock = vi.fn<FetchMock>((input, init) => {
      const path = String(input)
      const method = init?.method ?? 'GET'
      if (path === '/tables') {
        return Promise.resolve(jsonResponse([{ ...tableA, usageStatus: 'OCCUPIED' }]))
      }
      if (path.includes('/sessions/current/orders')) {
        return Promise.resolve(
          jsonResponse({
            session: {
              sessionId: 'session-1',
              tableId: 'table-a',
              openedAt: '2026-08-04T12:00:00Z',
              closedAt: null,
              status: 'OPEN',
            },
            items: [
              {
                orderId: 'order-1',
                orderNumber: 'A-001',
                createdAt: '2026-08-04T12:05:00Z',
                status: 'IN_PROGRESS',
                totalAmount: '12000.00',
                currency: 'KRW',
                paymentStatus: 'UNPAID',
                items: [{ productId: 'p-1', productName: '아메리카노', quantity: 1, lineAmount: '12000.00' }],
              },
            ],
            nextCursor: 'next-current',
          }),
        )
      }
      if (path.includes('/sessions/history')) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                sessionId: 'past-1',
                tableId: 'table-a',
                openedAt: '2026-08-03T12:00:00Z',
                closedAt: '2026-08-03T13:00:00Z',
                status: 'CLOSED',
              },
            ],
            nextCursor: null,
          }),
        )
      }
      if (path.includes('/sessions/past-1/orders')) {
        return Promise.resolve(
          jsonResponse({
            session: {
              sessionId: 'past-1',
              tableId: 'table-a',
              openedAt: '2026-08-03T12:00:00Z',
              closedAt: '2026-08-03T13:00:00Z',
              status: 'CLOSED',
            },
            items: [],
            nextCursor: null,
          }),
        )
      }
      if (path === '/tables/table-a/sessions/session-1/close' && method === 'POST') {
        if (closeBlocked) {
          closeBlocked = false
          return Promise.resolve(
            jsonResponse(
              {
                code: 'TABLE_SESSION_CLOSE_BLOCKED',
                blockers: [{ code: 'IN_PROGRESS_ORDER', message: 'hidden backend text' }],
              },
              false,
              409,
            ),
          )
        }
        return Promise.resolve(
          jsonResponse({
            sessionId: 'session-1',
            tableId: 'table-a',
            openedAt: '2026-08-04T12:00:00Z',
            closedAt: '2026-08-04T13:00:00Z',
            status: 'CLOSED',
          }),
        )
      }
      return Promise.reject(new Error(`unexpected ${method} ${path}`))
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('A-001')
    expect(wrapper.text()).toContain('아메리카노')
    await clickButton(wrapper, '종료')
    await wrapper.get('.modal .button--danger').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('진행 중인 주문이 있습니다.')

    await wrapper.findAll('.history-item')[0]?.trigger('click')
    await flushPromises()
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/sessions/past-1/orders'))).toBe(true)
  })

  it('TABLE-10: does not let a slow response for a previously selected table overwrite the newly selected table', async () => {
    const tableB = { ...tableA, tableId: 'table-b', tableNumber: 'B2', displayName: '홀' }
    let resolveTableBCurrentOrders: ((value: unknown) => void) | undefined
    const tableBCurrentOrders = new Promise((resolve) => {
      resolveTableBCurrentOrders = resolve
    })
    let tableAOrderCalls = 0

    function currentOrdersResponse(orderNumber: string, sessionId: string, tableId: string) {
      return jsonResponse({
        session: { sessionId, tableId, openedAt: '2026-08-04T12:00:00Z', closedAt: null, status: 'OPEN' },
        items: [
          {
            orderId: `order-${orderNumber}`,
            orderNumber,
            createdAt: '2026-08-04T12:05:00Z',
            status: 'IN_PROGRESS',
            totalAmount: '1000.00',
            currency: 'KRW',
            paymentStatus: 'UNPAID',
            items: [{ productId: 'p-1', productName: '상품', quantity: 1, lineAmount: '1000.00' }],
          },
        ],
        nextCursor: null,
      })
    }

    const fetchMock = vi.fn<FetchMock>((input, init) => {
      const path = String(input)
      const method = init?.method ?? 'GET'
      if (path === '/tables' && method === 'GET') {
        return Promise.resolve(jsonResponse([tableA, tableB]))
      }
      if (path.includes('/tables/table-a/sessions/current/orders')) {
        tableAOrderCalls += 1
        // First call happens on mount (auto-selected table A); resolve fast so the
        // table list itself renders. Second call happens after switching back to A
        // from B and must resolve with fresh content.
        const orderNumber = tableAOrderCalls === 1 ? 'A-INITIAL' : 'A-SECOND'
        return Promise.resolve(currentOrdersResponse(orderNumber, 'session-a', 'table-a'))
      }
      if (path.includes('/tables/table-b/sessions/current/orders')) {
        // Table B's response stays pending until the test resolves it explicitly,
        // simulating a slow request that arrives after the operator has already
        // switched back to another table.
        return tableBCurrentOrders.then(() => currentOrdersResponse('B-STALE', 'session-b', 'table-b'))
      }
      if (path.includes('/sessions/history')) {
        return Promise.resolve(jsonResponse({ items: [], nextCursor: null }))
      }
      return Promise.reject(new Error(`unexpected ${method} ${path}`))
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountView()
    await flushPromises()
    // Table A is auto-selected on mount and its orders resolved immediately.
    expect(wrapper.text()).toContain('A-INITIAL')

    const tableCards = wrapper.findAll('.table-card__main')
    expect(tableCards).toHaveLength(2)
    await tableCards[1]!.trigger('click')
    await flushPromises()
    // Switching to table B must clear table A's previous orders immediately, even
    // though table B's own request has not resolved yet.
    expect(wrapper.text()).not.toContain('A-INITIAL')
    expect(wrapper.text()).not.toContain('B-STALE')

    // Operator switches back to table A before B's slow request resolves.
    await tableCards[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('A-SECOND')

    // Table B's slow response now arrives after the operator already switched away.
    resolveTableBCurrentOrders?.(undefined)
    await flushPromises()

    // It must not clobber table A's already-rendered state.
    expect(wrapper.text()).toContain('A-SECOND')
    expect(wrapper.text()).not.toContain('B-STALE')
  })
})

function mountView() {
  return mount(TableOperationsView, {
    global: {
      plugins: [createPinia()],
      stubs: {
        QrPrintPanel: {
          props: ['accessUrl', 'tableNumber'],
          template: '<div data-test="qr-print">{{ tableNumber }}</div>',
        },
      },
    },
  })
}

async function clickButton(wrapper: VueWrapper, text: string) {
  const button = wrapper.findAll('button').find((item) => item.text() === text)
  expect(button, `button ${text}`).toBeTruthy()
  await button!.trigger('click')
}

async function submitTableForm(wrapper: VueWrapper) {
  await wrapper.get('form.table-form').trigger('submit')
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: vi.fn<() => Promise<unknown>>().mockResolvedValue(body),
  }
}
