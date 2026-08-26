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

export function crossOriginTarget(current: URL, origins: AppOrigins): string | null {
  if (origins.kioskOrigin && current.origin === origins.kioskOrigin && current.pathname === '/') {
    const kioskHome = new URL(origins.kioskOrigin)
    kioskHome.pathname = '/kiosk'
    kioskHome.search = current.search
    kioskHome.hash = current.hash
    return kioskHome.href
  }

  const kioskPath = current.pathname === '/kiosk' || current.pathname.startsWith('/kiosk/')
  const targetOrigin = kioskPath ? origins.kioskOrigin : origins.publicOrigin
  if (!targetOrigin || current.origin === targetOrigin) return null

  const target = new URL(targetOrigin)
  target.pathname = current.pathname
  target.search = current.search
  target.hash = current.hash
  return target.href
}
