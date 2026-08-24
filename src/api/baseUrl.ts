const EDGE_API_PATH = '/api/v1'

/**
 * Accept either the Edge origin (`http://localhost:8080`) or the complete Edge API base URL.
 * Keeping the versioned Spring path here prevents an origin-only environment value from
 * accidentally producing requests such as `/auth/login` instead of `/api/v1/auth/login`.
 */
export function resolveApiBaseUrl(configuredBaseUrl?: string): string {
  const configured = configuredBaseUrl?.trim().replace(/\/+$/, '')

  if (!configured) return EDGE_API_PATH
  if (configured === EDGE_API_PATH || configured.endsWith(EDGE_API_PATH)) return configured

  return `${configured}${EDGE_API_PATH}`
}
