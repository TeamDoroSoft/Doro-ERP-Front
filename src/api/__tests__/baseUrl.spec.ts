import { describe, expect, it } from 'vitest'
import { EDGE_API_BASE_URL } from '@/api/baseUrl'

describe('Edge API base URL', () => {
  it('always uses the same-origin versioned Edge path', () => {
    expect(EDGE_API_BASE_URL).toBe('/api/v1')
  })
})
