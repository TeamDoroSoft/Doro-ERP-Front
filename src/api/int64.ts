export type Int64String = string

const INTEGER = /^-?\d+$/

/**
 * Parses selected JSON integer fields as decimal strings before JSON.parse can round them.
 * The scanner understands JSON string boundaries, so matching text inside string values is untouched.
 */
export function parseJsonWithInt64<T>(text: string, fields: readonly string[]): T {
  const exactFields = new Set(fields)
  let output = ''
  let index = 0

  while (index < text.length) {
    if (text[index] !== '"') {
      output += text[index++]
      continue
    }

    const stringEnd = findStringEnd(text, index)
    const literal = text.slice(index, stringEnd + 1)
    output += literal

    const key = JSON.parse(literal) as unknown
    let cursor = skipWhitespace(text, stringEnd + 1)
    if (typeof key !== 'string' || text[cursor] !== ':' || !exactFields.has(key)) {
      index = stringEnd + 1
      continue
    }

    cursor = skipWhitespace(text, cursor + 1)
    const integer = /^-?\d+/.exec(text.slice(cursor))?.[0]
    if (!integer || !isJsonValueBoundary(text[cursor + integer.length])) {
      index = stringEnd + 1
      continue
    }

    output += text.slice(stringEnd + 1, cursor)
    output += JSON.stringify(integer)
    index = cursor + integer.length
  }

  return JSON.parse(output) as T
}

/** Returns the value unchanged when it is an exact decimal int64 literal, otherwise throws. */
export function assertInt64(value: Int64String): Int64String {
  if (!INTEGER.test(value)) throw new InvalidInt64Error()
  return value
}

/**
 * Serialises a command body whose listed fields must stay exact int64 JSON numbers.
 * The literal digits are emitted directly, so no value ever passes through a JavaScript number.
 */
export function stringifyWithInt64(
  body: Record<string, string | number | boolean | null>,
  int64Fields: Readonly<Record<string, Int64String>>,
): string {
  const parts = Object.entries(body).map(
    ([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`,
  )
  for (const [key, value] of Object.entries(int64Fields)) {
    parts.push(`${JSON.stringify(key)}:${assertInt64(value)}`)
  }
  return `{${parts.join(',')}}`
}

const UNKNOWN_AMOUNT = '금액 확인 필요'

/**
 * `Intl.NumberFormat` formats a `bigint` exactly, so the digits are never routed through a
 * JavaScript number on their way to the screen.
 */
export function formatInt64(value: Int64String): string {
  return INTEGER.test(value) ? new Intl.NumberFormat('ko-KR').format(BigInt(value)) : UNKNOWN_AMOUNT
}

export function formatCurrencyInt64(value: Int64String, currency: string): string {
  if (!INTEGER.test(value)) return UNKNOWN_AMOUNT
  try {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(BigInt(value))
  } catch {
    return UNKNOWN_AMOUNT
  }
}

export function formatKrw(value: Int64String): string {
  const formatted = formatInt64(value)
  return formatted === UNKNOWN_AMOUNT ? formatted : `${formatted}원`
}

export function multiplyInt64(value: Int64String, multiplier: number): Int64String {
  if (!INTEGER.test(value) || !Number.isSafeInteger(multiplier)) throw new InvalidInt64Error()
  return (BigInt(value) * BigInt(multiplier)).toString()
}

export function sumInt64(values: Iterable<Int64String>): Int64String {
  let total = 0n
  for (const value of values) {
    if (!INTEGER.test(value)) throw new InvalidInt64Error()
    total += BigInt(value)
  }
  return total.toString()
}

export function toSafeInteger(value: Int64String): number {
  if (!INTEGER.test(value)) throw new InvalidInt64Error()
  const parsed = BigInt(value)
  if (parsed < BigInt(Number.MIN_SAFE_INTEGER) || parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new UnsafeInt64Error()
  }
  return Number(parsed)
}

export function isPositiveInt64(value: Int64String): boolean {
  return INTEGER.test(value) && BigInt(value) > 0n
}

export class InvalidInt64Error extends Error {
  constructor() {
    super('정수 금액 형식이 올바르지 않습니다.')
    this.name = 'InvalidInt64Error'
  }
}

export class UnsafeInt64Error extends Error {
  constructor() {
    super('결제 가능한 금액 범위를 초과했습니다.')
    this.name = 'UnsafeInt64Error'
  }
}

function findStringEnd(text: string, start: number): number {
  let escaped = false
  for (let index = start + 1; index < text.length; index += 1) {
    const character = text[index]
    if (escaped) escaped = false
    else if (character === '\\') escaped = true
    else if (character === '"') return index
  }
  throw new SyntaxError('Unterminated JSON string')
}

function skipWhitespace(text: string, start: number): number {
  let index = start
  while (/\s/.test(text[index] ?? '')) index += 1
  return index
}

function isJsonValueBoundary(character: string | undefined): boolean {
  return character === undefined || /[\s,}\]]/.test(character)
}
