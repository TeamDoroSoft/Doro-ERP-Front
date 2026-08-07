import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  createProduct,
  errorKind,
  fieldErrorMap,
  getSalesMenu,
  problemMessage,
  updateProductSoldOut,
  type CatalogAuth,
} from '@/api/catalog'

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>

const auth: CatalogAuth = {
  apiBaseUrl: 'https://api.example.test',
  tenantId: '11111111-1111-1111-1111-111111111111',
  storeId: 'aaaaaaaa-1111-1111-1111-111111111111',
  actorId: '33333333-3333-3333-3333-333333333333',
  roleCode: 'MANAGER',
}

describe('catalog api client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('calls the sales menu contract with the actor context headers', async () => {
    const fetchMock = vi
      .fn<FetchMock>()
      .mockResolvedValue(jsonResponse({ currency: 'KRW', categories: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await getSalesMenu(auth)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/catalog/menu',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(headers.get('X-Doro-Tenant-Id')).toBe(auth.tenantId)
    expect(headers.get('X-Doro-Actor-Role')).toBe('MANAGER')
    expect(headers.get('X-Doro-Actor-Type')).toBe('EMPLOYEE')
  })

  it('marks a kiosk actor as a device', async () => {
    const fetchMock = vi
      .fn<FetchMock>()
      .mockResolvedValue(jsonResponse({ currency: 'KRW', categories: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await getSalesMenu({ ...auth, roleCode: 'KIOSK_DEVICE' })

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(headers.get('X-Doro-Actor-Type')).toBe('DEVICE')
  })

  it('sends the current version as If-Match when changing sold out', async () => {
    const fetchMock = vi.fn<FetchMock>().mockResolvedValue(jsonResponse({ productId: 'p-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await updateProductSoldOut(auth, 'p-1', true, 4)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/catalog/products/p-1/sold-out',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ soldOut: true }) }),
    )
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(headers.get('If-Match')).toBe('4')
  })

  it('sends a null description instead of an empty string', async () => {
    const fetchMock = vi.fn<FetchMock>().mockResolvedValue(jsonResponse({ productId: 'p-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await createProduct(auth, {
      categoryId: 'c-1',
      name: '아메리카노',
      price: 4500,
      displayOrder: 1,
    })

    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        categoryId: 'c-1',
        name: '아메리카노',
        description: null,
        price: 4500,
        displayOrder: 1,
        active: true,
      }),
    )
  })

  it('raises a typed ApiError from the problem response', async () => {
    const fetchMock = vi.fn<FetchMock>().mockResolvedValue(
      jsonResponse(
        {
          code: 'VALIDATION_FAILED',
          detail: '요청 값이 유효하지 않습니다.',
          fieldErrors: [{ field: 'price', code: 'PRICE_NEGATIVE' }],
        },
        400,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createProduct(auth, { categoryId: 'c-1', name: '음수', price: -1, displayOrder: 1 }),
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('classifies every error kind the screen has to display', () => {
    expect(errorKind(new ApiError(400, { code: 'VALIDATION_FAILED' }))).toBe('VALIDATION')
    expect(errorKind(new ApiError(401, { code: 'AUTHENTICATION_REQUIRED' }))).toBe('AUTHENTICATION')
    expect(errorKind(new ApiError(403, { code: 'FORBIDDEN' }))).toBe('FORBIDDEN')
    expect(errorKind(new ApiError(404, { code: 'PRODUCT_NOT_FOUND' }))).toBe('NOT_FOUND')
    expect(errorKind(new ApiError(409, { code: 'CATALOG_VERSION_CONFLICT' }))).toBe('CONFLICT')
    expect(errorKind(new ApiError(428, { code: 'PRECONDITION_REQUIRED' }))).toBe('CONFLICT')
    expect(errorKind(new ApiError(500, { code: 'INTERNAL_SERVER_ERROR' }))).toBe('SERVER')
    expect(errorKind(new TypeError('network request failed'))).toBe('NETWORK')
  })

  it('explains permission and conflict failures in korean', () => {
    expect(problemMessage(new ApiError(403, { code: 'FORBIDDEN' }))).toContain('권한')
    expect(problemMessage(new ApiError(409, { code: 'CATALOG_VERSION_CONFLICT' }))).toContain(
      '다른 사용자가 먼저 변경',
    )
    expect(problemMessage(new TypeError('boom'))).toContain('네트워크')
  })

  it('maps field errors to input guidance', () => {
    const error = new ApiError(400, {
      code: 'VALIDATION_FAILED',
      fieldErrors: [{ field: 'price', code: 'PRICE_NEGATIVE' }],
    })

    expect(fieldErrorMap(error)).toEqual({ price: '가격은 0원 이상의 정수로 입력하세요.' })
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  } as unknown as Response
}
