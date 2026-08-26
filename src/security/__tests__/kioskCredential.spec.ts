import { describe, expect, it } from 'vitest'
import { activationSecret, issuedActivationSecret } from '@/security/kioskCredential'

describe('kiosk credential handling', () => {
  it('extracts only the activation secret from an issued full credential', () => {
    expect(issuedActivationSecret('kdc_credential-id.activation-secret')).toBe('activation-secret')
  })

  it.each([
    'unexpected-value',
    ' kdc_id.secret',
    'kdc_id.secret ',
    'kdc_missing_separator',
    'kdc_id.secret with-space',
    'kdc_id.secret.with-dot',
  ])('fails closed for malformed issued credentials: %s', (credential) => {
    expect(issuedActivationSecret(credential)).toBeNull()
  })

  it('accepts both a secret and a full credential pasted into activation', () => {
    expect(activationSecret('  activation-secret  ')).toBe('activation-secret')
    expect(activationSecret(' kdc_credential-id.activation-secret ')).toBe('activation-secret')
  })

  it.each(['', '   ', 'secret with-space', 'secret.with-dot', 'kdc_invalid'])(
    'rejects invalid activation input: %s',
    (value) => {
      expect(activationSecret(value)).toBeNull()
    },
  )
})
