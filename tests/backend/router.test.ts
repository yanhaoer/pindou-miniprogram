import { describe, it, expect, vi } from 'vitest'
const api = require('../../cloudfunctions/api/index')

describe('Cloud API Router Gateway', () => {
  it('should return 40000 when action is missing or invalid', async () => {
    const res1 = await api.main({}, {})
    expect(res1.code).toBe(40000)
    expect(res1.message).toContain('action is required')

    const res2 = await api.main({ action: 123 as any }, {})
    expect(res2.code).toBe(40000)
    expect(res2.message).toContain('action is required')

    const res3 = await api.main()
    expect(res3.code).toBe(40000)
    expect(res3.message).toContain('action is required')
  })

  it('should return 40400 when action is not recognized', async () => {
    const res = await api.main({ action: 'unknown.action' }, {})
    expect(res.code).toBe(40400)
    expect(res.message).toContain('Unknown action')
  })

  it('should dispatch to registered action handler with openid', async () => {
    const res = await api.main(
      { action: 'system.ping', data: { echo: 'hello' } },
      { OPENID: 'mock_openid_123' }
    )
    expect(res.code).toBe(0)
    expect(res.data.echo).toBe('hello')
    expect(res.data.openid).toBe('mock_openid_123')
  })

  it('should allow dynamic route registration via registerRoute', async () => {
    api.registerRoute('test.custom', async (data: any, context: any) => {
      return { code: 0, message: 'ok', data: { num: data.num * 2, from: context.openid } }
    })

    const res = await api.main(
      { action: 'test.custom', data: { num: 21 } },
      { OPENID: 'user_456' }
    )
    expect(res.code).toBe(0)
    expect(res.data.num).toBe(42)
    expect(res.data.from).toBe('user_456')
  })

  it('should catch handler errors and return 50000', async () => {
    api.registerRoute('test.error', async () => {
      throw new Error('Database connection failed')
    })

    const res = await api.main({ action: 'test.error' }, {})
    expect(res.code).toBe(50000)
    expect(res.message).toBe('Database connection failed')
  })

  it('should handle null event or data defensively', async () => {
    api.registerRoute('test.nullData', async (data: any) => {
      return { code: 0, message: 'ok', data: { receivedType: typeof data, isObject: data !== null && typeof data === 'object' } }
    })

    const res = await api.main({ action: 'test.nullData', data: null }, {})
    expect(res.code).toBe(0)
    expect(res.data.isObject).toBe(true)
  })
})
