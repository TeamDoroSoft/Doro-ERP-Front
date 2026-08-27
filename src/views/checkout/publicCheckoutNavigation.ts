import type { Int64String } from '@/api/int64'

export interface PublicCheckoutNavigation {
  token: string
  paymentKey: string
  providerOrderId: string
  amount: Int64String | ''
}

interface CheckoutLocation {
  pathname: string
  search: string
  hash: string
}

interface CheckoutHistory {
  state: unknown
  replaceState(data: unknown, unused: string, url?: string | URL | null): void
}

/**
 * Capture provider credentials in memory and synchronously remove both fragment and query data.
 * Call this at component setup, before any network request or asynchronous lifecycle callback.
 */
export function capturePublicCheckoutNavigation(
  location: CheckoutLocation,
  history: CheckoutHistory,
): PublicCheckoutNavigation {
  const token = exactFragmentToken(location.hash)
  const redirect = exactSuccessRedirect(location.search)
  const captured: PublicCheckoutNavigation = {
    token,
    paymentKey: redirect?.paymentKey ?? '',
    providerOrderId: redirect?.providerOrderId ?? '',
    amount: redirect?.amount ?? '',
  }

  if (location.hash || location.search) history.replaceState(history.state, '', location.pathname)
  return captured
}

function exactFragmentToken(hash: string): string {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  if (!fragment.startsWith('token=') || fragment.includes('&')) return ''
  const encoded = fragment.slice('token='.length)
  if (!encoded) return ''
  try {
    return decodeURIComponent(encoded)
  } catch {
    return ''
  }
}

function exactSuccessRedirect(search: string): {
  paymentKey: string
  providerOrderId: string
  amount: Int64String
} | null {
  const query = search.startsWith('?') ? search.slice(1) : search
  if (!query || query.startsWith('&') || query.endsWith('&')) return null
  const entries = query.split('&')
  if (entries.length !== 3) return null

  const values = new Map<string, string>()
  for (const entry of entries) {
    const separator = entry.indexOf('=')
    if (separator < 1) return null
    const key = entry.slice(0, separator)
    const encoded = entry.slice(separator + 1)
    if (!['paymentKey', 'orderId', 'amount'].includes(key) || values.has(key) || !encoded) return null
    try {
      const value = decodeURIComponent(encoded)
      if (!value) return null
      values.set(key, value)
    } catch {
      return null
    }
  }

  const paymentKey = values.get('paymentKey')
  const providerOrderId = values.get('orderId')
  const amount = values.get('amount')
  if (!paymentKey || !providerOrderId || !amount || !/^\d+$/.test(amount)) return null
  return { paymentKey, providerOrderId, amount }
}
