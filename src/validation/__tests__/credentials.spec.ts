import { describe, expect, it } from 'vitest'
import { loginIdError, temporaryPasswordError } from '@/validation/credentials'

describe('credential validation', () => {
  it('accepts only the documented login ID syntax', () => {
    expect(loginIdError('owner.one')).toBe('')
    expect(loginIdError('.owner')).not.toBe('')
    expect(loginIdError('Owner')).not.toBe('')
    expect(loginIdError('abc')).not.toBe('')
  })

  it('enforces length and forbidden substrings without inventing complexity rules', () => {
    expect(temporaryPasswordError('plainwords-12345', 'owner')).toBe('')
    expect(temporaryPasswordError('short', 'owner')).not.toBe('')
    expect(temporaryPasswordError('safe-owner-secret-123', 'owner')).not.toBe('')
    expect(temporaryPasswordError('prefixDoroerp-secret-123', 'owner')).not.toBe('')
  })
})
