import type { Router } from 'vue-router'

export function safePosReturnPath(router: Router, candidate: unknown): string | null {
  if (typeof candidate !== 'string' || !candidate.startsWith('/pos/')) return null
  if (candidate.includes('?') || candidate.includes('#')) return null

  const resolved = router.resolve(candidate)
  if (resolved.name === undefined || resolved.name === 'not-found' || resolved.name === 'pos-login') {
    return null
  }
  return candidate
}
