const ACTIVATION_SECRET = /^[A-Za-z0-9_-]+$/
const FULL_CREDENTIAL = /^kdc_[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)$/

export function activationSecret(value: string): string | null {
  const candidate = value.trim()
  if (!candidate || /\s/.test(candidate)) return null
  if (!candidate.startsWith('kdc_')) return ACTIVATION_SECRET.test(candidate) ? candidate : null
  return FULL_CREDENTIAL.exec(candidate)?.[1] ?? null
}

export function issuedActivationSecret(credential: string): string | null {
  const candidate = credential.trim()
  if (candidate !== credential || /\s/.test(candidate)) return null
  return FULL_CREDENTIAL.exec(candidate)?.[1] ?? null
}
