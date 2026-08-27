export interface AppOrigins {
  publicOrigin: string | null
  kioskOrigin: string | null
}

export function parseAppOrigin(value: string | undefined): string | null {
  const candidate = value?.trim()
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
    if ((!localHttp && url.protocol !== 'https:') || url.username || url.password) return null
    if (url.pathname !== '/' || url.search || url.hash) return null
    return url.origin
  } catch {
    return null
  }
}

export function configuredAppOrigins(): AppOrigins {
  return {
    publicOrigin: parseAppOrigin(import.meta.env.VITE_PUBLIC_APP_ORIGIN),
    kioskOrigin: parseAppOrigin(import.meta.env.VITE_KIOSK_APP_ORIGIN),
  }
}

export function isPublicCheckoutPath(pathname: string): boolean {
  const segments = pathname.split('/')
  if (segments.length !== 3 && segments.length !== 4) return false
  const publicIdSegment = segments[2]
  if (segments[0] !== '' || segments[1] !== 'pay' || !publicIdSegment) return false

  // Encoded path separators can be interpreted differently by proxies and routers.
  if (typeof publicIdSegment !== 'string' || /%2f|%5c/i.test(publicIdSegment)) return false
  if (segments.length === 4 && segments[3] !== 'success' && segments[3] !== 'fail') return false

  return true
}

export function crossOriginTarget(current: URL, origins: AppOrigins): string | null {
  const kioskPath = current.pathname === '/kiosk' || current.pathname.startsWith('/kiosk/')
  const publicCheckoutPath = isPublicCheckoutPath(current.pathname)
  if (origins.kioskOrigin && current.origin === origins.kioskOrigin) {
    if (kioskPath || publicCheckoutPath) return null
    const activation = new URL('/kiosk/activate', origins.kioskOrigin)
    if (current.pathname === '/') {
      activation.search = current.search
      activation.hash = current.hash
    }
    return activation.href
  }

  const targetOrigin = kioskPath || publicCheckoutPath ? origins.kioskOrigin : origins.publicOrigin
  if (!targetOrigin || current.origin === targetOrigin) return null

  const target = new URL(targetOrigin)
  target.pathname = current.pathname
  target.search = current.search
  target.hash = current.hash
  return target.href
}
