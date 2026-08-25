import type { RouteLocationNormalized } from 'vue-router'

const APPLICATION_NAME = 'Doro ERP'
const DEFAULT_TITLE = '매장 운영'
const DEFAULT_DESCRIPTION = 'Doro ERP의 매장 직원 POS와 고객 주문 키오스크입니다.'

function upsertNamedMeta(name: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.name = name
    document.head.append(element)
  }
  element.content = content
}

export function applyPageMetadata(route: RouteLocationNormalized): void {
  if (typeof document === 'undefined') return

  const pageTitle = route.meta.title?.trim() || DEFAULT_TITLE
  const description = route.meta.description?.trim() || DEFAULT_DESCRIPTION

  document.title = `${pageTitle} | ${APPLICATION_NAME}`
  upsertNamedMeta('description', description)
}
