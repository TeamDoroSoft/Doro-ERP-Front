import { describe, expect, it } from 'vitest'
import {
  InvalidInt64Error,
  UnsafeInt64Error,
  assertInt64,
  formatCurrencyInt64,
  formatInt64,
  formatKrw,
  isPositiveInt64,
  multiplyInt64,
  parseJsonPreservingInt64,
  parseJsonWithInt64,
  stringifyWithInt64,
  sumInt64,
  toSafeInteger,
} from '@/api/int64'

const BOUNDARY = ['9007199254740991', '9007199254740992', '9007199254740993'] as const

describe('int64 wire values', () => {
  it.each(BOUNDARY)('parses %s from the wire without a JavaScript number round trip', (value) => {
    expect(parseJsonWithInt64<{ amount: string }>(`{"amount":${value}}`, ['amount']).amount).toBe(
      value,
    )
  })

  it('keeps 9007199254740993 exact where JSON.parse would round it down', () => {
    const text = '{"totalAmount":9007199254740993}'
    expect(JSON.parse(text).totalAmount).toBe(9007199254740992)
    expect(parseJsonWithInt64<{ totalAmount: string }>(text, ['totalAmount']).totalAmount).toBe(
      '9007199254740993',
    )
  })

  it('converts only the listed fields and never digits inside strings', () => {
    const text =
      '{"price":9007199254740993,"description":"price 9007199254740993","displayOrder":1,' +
      '"nested":{"price":12000},"note":"\\"price\\":1"}'
    const parsed = parseJsonWithInt64<{
      price: string
      description: string
      displayOrder: number
      nested: { price: string }
      note: string
    }>(text, ['price'])

    expect(parsed.price).toBe('9007199254740993')
    expect(parsed.description).toBe('price 9007199254740993')
    expect(parsed.displayOrder).toBe(1)
    expect(parsed.nested.price).toBe('12000')
    expect(parsed.note).toBe('"price":1')
  })

  it('leaves a non-integer value of a listed field untouched', () => {
    expect(parseJsonWithInt64<{ price: null }>('{"price":null}', ['price']).price).toBeNull()
    expect(parseJsonWithInt64<{ price: string }>('{"price":"12000"}', ['price']).price).toBe('12000')
  })

  it('formats large KRW amounts with exact digits and grouping', () => {
    expect(formatInt64('9007199254740993')).toBe('9,007,199,254,740,993')
    expect(formatKrw('9007199254740993')).toBe('9,007,199,254,740,993원')
    expect(formatKrw('12000')).toBe('12,000원')
    expect(formatKrw('12000.5')).toBe('금액 확인 필요')
    expect(formatKrw('')).toBe('금액 확인 필요')
    expect(formatCurrencyInt64('9007199254740993', 'KRW')).toBe('₩9,007,199,254,740,993')
    expect(formatCurrencyInt64('4500', 'KRW')).toBe('₩4,500')
    expect(formatCurrencyInt64('4500', 'not-a-currency')).toBe('금액 확인 필요')
    expect(formatCurrencyInt64('4500.5', 'KRW')).toBe('금액 확인 필요')
  })

  it('adds and multiplies estimates with integer arithmetic only', () => {
    expect(multiplyInt64('9007199254740993', 3)).toBe('27021597764222979')
    expect(sumInt64(['9007199254740993', '1'])).toBe('9007199254740994')
    expect(sumInt64([])).toBe('0')
    expect(() => multiplyInt64('1.5', 2)).toThrow(InvalidInt64Error)
    expect(() => sumInt64(['abc'])).toThrow(InvalidInt64Error)
  })

  it('converts to a JavaScript number only inside the safe range', () => {
    expect(toSafeInteger('9007199254740991')).toBe(9007199254740991)
    expect(() => toSafeInteger('9007199254740992')).toThrow(UnsafeInt64Error)
    expect(() => toSafeInteger('9007199254740993')).toThrow(UnsafeInt64Error)
    expect(() => toSafeInteger('not-a-number')).toThrow(InvalidInt64Error)
  })

  it('serialises a command body keeping the int64 field an exact JSON number', () => {
    expect(stringifyWithInt64({ paymentKey: 'key' }, { amount: '9007199254740993' })).toBe(
      '{"paymentKey":"key","amount":9007199254740993}',
    )
    expect(() => stringifyWithInt64({}, { amount: '12000.5' })).toThrow(InvalidInt64Error)
  })

  it('preserves every integer inside a free-form map without changing other value types', () => {
    const text =
      '{"id":"audit-1","metadata":{"totalAmount":9007199254740993,"version":9007199254740993,' +
      '"currency":"KRW","displayNumber":7,"ratio":1.5,"replayed":true,"reasonCode":null,' +
      '"note":"amount 9007199254740993"},"traceId":"trace-1"}'

    const parsed = parseJsonPreservingInt64<{
      id: string
      metadata: Record<string, unknown>
      traceId: string
    }>(text, { maps: ['metadata'] })

    expect(parsed.metadata).toEqual({
      totalAmount: '9007199254740993',
      version: '9007199254740993',
      currency: 'KRW',
      displayNumber: '7',
      ratio: 1.5,
      replayed: true,
      reasonCode: null,
      note: 'amount 9007199254740993',
    })
    expect(parsed.id).toBe('audit-1')
    expect(parsed.traceId).toBe('trace-1')
  })

  it('leaves integers outside the named map alone', () => {
    const parsed = parseJsonPreservingInt64<{
      size: number
      items: { metadata: { amount: string } }[]
    }>('{"size":20,"items":[{"metadata":{"amount":9007199254740993}}]}', { maps: ['metadata'] })

    expect(parsed.size).toBe(20)
    expect(parsed.items[0]?.metadata.amount).toBe('9007199254740993')
  })

  it('keeps arrays, nesting and escaped strings intact while rewriting', () => {
    const text = '{"items":[{"version":9007199254740993,"name":"a \\"b\\" c"},{"version":1}],"next":null}'
    const parsed = parseJsonPreservingInt64<{
      items: { version: string; name?: string }[]
      next: null
    }>(text, { fields: ['version'] })

    expect(parsed.items).toEqual([
      { version: '9007199254740993', name: 'a "b" c' },
      { version: '1' },
    ])
    expect(parsed.next).toBeNull()
  })

  it('validates positive and well-formed values', () => {
    expect(isPositiveInt64('1')).toBe(true)
    expect(isPositiveInt64('0')).toBe(false)
    expect(isPositiveInt64('-1')).toBe(false)
    expect(isPositiveInt64('1e3')).toBe(false)
    expect(assertInt64('-12000')).toBe('-12000')
    expect(() => assertInt64('12,000')).toThrow(InvalidInt64Error)
  })
})
