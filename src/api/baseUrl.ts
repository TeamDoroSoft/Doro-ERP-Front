/**
 * Browser traffic always enters through the same-origin Edge API boundary. In production,
 * CloudFront routes `/api/*` to the public Edge runtime; in development, Vite proxies the same
 * path to `VITE_EDGE_PROXY_TARGET`. Keeping this non-configurable prevents a public build from
 * accidentally embedding a Commerce, Payment, Queue, or Store Access service origin.
 */
export const EDGE_API_BASE_URL = '/api/v1'
