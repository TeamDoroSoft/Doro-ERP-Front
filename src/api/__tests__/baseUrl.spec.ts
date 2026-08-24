import { describe, expect, it } from 'vitest'
import { resolveApiBaseUrl } from '@/api/baseUrl'

describe('Edge API base URL', () => {
  it('uses the same-origin Spring Edge path when the setting is empty', () => {
    expect(resolveApiBaseUrl()).toBe('/api/v1')
    expect(resolveApiBaseUrl('  ')).toBe('/api/v1')
  })

  it('adds the Spring Edge path when only an origin is configured', () => {
    expect(resolveApiBaseUrl('http://localhost:8080')).toBe(
      'http://localhost:8080/api/v1',
    )
    expect(resolveApiBaseUrl('https://edge.example.com/')).toBe(
      'https://edge.example.com/api/v1',
    )
  })

  it('does not duplicate an already configured Spring Edge path', () => {
    expect(resolveApiBaseUrl('/api/v1/')).toBe('/api/v1')
    expect(resolveApiBaseUrl('https://edge.example.com/api/v1/')).toBe(
      'https://edge.example.com/api/v1',
    )
  })
})
