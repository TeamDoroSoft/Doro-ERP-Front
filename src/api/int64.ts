export type Int64String = string

const INTEGER = /^-?\d+$/

/** Selects which wire values must survive `JSON.parse` as exact decimal strings. */
export interface Int64JsonOptions {
  /** Object keys whose integer value is an int64: `["totalAmount"]`. Matched at any depth. */
  fields?: readonly string[]
  /**
   * Object keys holding a free-form map whose value types are not known from the contract, such as
   * an Audit `metadata`. Every integer literal inside is preserved; strings, booleans, `null`,
   * fractional numbers and the surrounding structure are left exactly as the service sent them.
   */
  maps?: readonly string[]
}

/**
 * Parses JSON while keeping the selected integer values as exact decimal strings.
 *
 * The rewriter walks the document with a real JSON reader rather than a text replacement, so digits
 * inside string values, keys, and unrelated numbers are never touched. Nothing is converted after
 * the fact: the literals are quoted before `JSON.parse` ever sees them, which is the only point at
 * which an int64 could silently lose precision.
 */
export function parseJsonPreservingInt64<T>(text: string, options: Int64JsonOptions = {}): T {
  return JSON.parse(
    new Int64JsonRewriter(text, new Set(options.fields ?? []), new Set(options.maps ?? [])).run(),
  ) as T
}

/** Convenience form of {@link parseJsonPreservingInt64} for the common "known int64 keys" case. */
export function parseJsonWithInt64<T>(text: string, fields: readonly string[]): T {
  return parseJsonPreservingInt64<T>(text, { fields })
}

class Int64JsonRewriter {
  private index = 0
  private output = ''

  constructor(
    private readonly text: string,
    private readonly fields: ReadonlySet<string>,
    private readonly maps: ReadonlySet<string>,
  ) {}

  run(): string {
    this.whitespace()
    this.value(false, false)
    this.output += this.text.slice(this.index)
    return this.output
  }

  private value(preserve: boolean, insideMap: boolean) {
    const character = this.text[this.index]
    if (character === '{') this.object(insideMap)
    else if (character === '[') this.array(preserve, insideMap)
    else if (character === '"') this.string()
    else this.primitive(preserve || insideMap)
  }

  private object(insideMap: boolean) {
    this.take(1)
    this.whitespace()
    if (this.text[this.index] === '}') {
      this.take(1)
      return
    }
    for (;;) {
      this.whitespace()
      const key = this.string()
      this.whitespace()
      this.take(1) // ':'
      this.whitespace()
      this.value(this.fields.has(key), insideMap || this.maps.has(key))
      this.whitespace()
      const separator = this.text[this.index]
      this.take(1) // ',' or '}'
      if (separator !== ',') return
    }
  }

  private array(preserve: boolean, insideMap: boolean) {
    this.take(1)
    this.whitespace()
    if (this.text[this.index] === ']') {
      this.take(1)
      return
    }
    for (;;) {
      this.whitespace()
      this.value(preserve, insideMap)
      this.whitespace()
      const separator = this.text[this.index]
      this.take(1) // ',' or ']'
      if (separator !== ',') return
    }
  }

  private string(): string {
    const end = findStringEnd(this.text, this.index)
    const literal = this.text.slice(this.index, end + 1)
    this.take(literal.length)
    return JSON.parse(literal) as string
  }

  private primitive(preserve: boolean) {
    const start = this.index
    while (!isJsonValueBoundary(this.text[this.index])) this.index += 1
    const raw = this.text.slice(start, this.index)
    this.output += preserve && INTEGER.test(raw) ? JSON.stringify(raw) : raw
  }

  private whitespace() {
    const start = this.index
    while (/\s/.test(this.text[this.index] ?? '')) this.index += 1
    this.output += this.text.slice(start, this.index)
  }

  private take(length: number) {
    this.output += this.text.slice(this.index, this.index + length)
    this.index += length
  }
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
  body: Record<string, string | number | boolean | null | undefined>,
  int64Fields: Readonly<Record<string, Int64String | undefined>>,
): string {
  const parts = Object.entries(body)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`)
  for (const [key, value] of Object.entries(int64Fields)) {
    if (value !== undefined) parts.push(`${JSON.stringify(key)}:${assertInt64(value)}`)
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

function isJsonValueBoundary(character: string | undefined): boolean {
  return character === undefined || /[\s,}\]]/.test(character)
}
