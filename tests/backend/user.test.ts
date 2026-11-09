import { describe, it, expect } from 'vitest'
const userController = require('../../cloudfunctions/api/controllers/user')
const api = require('../../cloudfunctions/api/index')

describe('User Controller', () => {
  function createMockDb() {
    const users = new Map<string, any>()
    return {
      users,
      collection(name: string) {
        return {
          doc: (id: string) => ({
            get: async () => {
              const u = users.get(id)
              if (!u) throw new Error('Not found')
              return { data: u }
            },
            set: async ({ data }: any) => {
              users.set(id, { _id: id, ...data })
              return { stats: { updated: 1 } }
            }
          })
        }
      }
    }
  }

  it('should reject unauthenticated request', async () => {
    const res = await userController.syncProfile({}, { openid: '' })
    expect(res.code).toBe(40100)
  })

  it('should return error when db is not available', async () => {
    const res = await userController.syncProfile({}, { openid: 'test_user_no_db' })
    expect(res.code).toBe(50000)
    expect(res.message).toContain('Database connection not available')
  })

  it('should upsert user document and return profile', async () => {
    const mockDb = createMockDb()

    const res = await userController.syncProfile(
      { nickname: '拼豆呱呱', avatar_url: 'https://example.com/avatar.png' },
      { openid: 'test_user_1', db: mockDb }
    )

    expect(res.code).toBe(0)
    expect(res.data.nickname).toBe('拼豆呱呱')
    expect(res.data.vip_level).toBe('pro')
    expect(res.data.pattern_count).toBe(0)
    expect(res.data.openid).toBe('test_user_1')
    expect(res.data.avatar_url).toBe('https://example.com/avatar.png')
    expect(res.data.created_at).toBeDefined()
    expect(res.data.updated_at).toBeDefined()

    // Verify stored in mockDb
    const stored = mockDb.users.get('test_user_1')
    expect(stored.nickname).toBe('拼豆呱呱')
  })

  it('should preserve existing user fields when updating profile partially', async () => {
    const originalCreatedAt = new Date('2026-01-01')
    const mockDb = createMockDb()
    mockDb.users.set('test_user_2', {
      _id: 'test_user_2',
      nickname: '老玩家',
      avatar_url: 'https://example.com/old.png',
      vip_level: 'pro',
      pattern_count: 5,
      created_at: originalCreatedAt
    })

    const res = await userController.syncProfile(
      { nickname: '新名字' },
      { openid: 'test_user_2', db: mockDb }
    )

    expect(res.code).toBe(0)
    expect(res.data.nickname).toBe('新名字')
    expect(res.data.avatar_url).toBe('https://example.com/old.png')
    expect(res.data.pattern_count).toBe(5)
    expect(res.data.vip_level).toBe('pro')
    expect(res.data.created_at).toEqual(originalCreatedAt)

    // Verify created_at is preserved in database store
    const stored = mockDb.users.get('test_user_2')
    expect(stored.created_at).toEqual(originalCreatedAt)
  })

  it('should use default nickname when newly registered user does not provide one', async () => {
    const mockDb = createMockDb()

    const res = await userController.syncProfile(
      {},
      { openid: 'new_user_default', db: mockDb }
    )

    expect(res.code).toBe(0)
    expect(res.data.nickname).toBe('拼豆手作人')
    expect(res.data.avatar_url).toBe('')
    expect(res.data.pattern_count).toBe(0)
    expect(res.data.vip_level).toBe('pro')
  })

  describe('getProfile', () => {
    it('should reject unauthenticated request', async () => {
      const res = await userController.getProfile({}, { openid: '' })
      expect(res.code).toBe(40100)
    })

    it('should return existing profile from database', async () => {
      const mockDb = createMockDb()
      mockDb.users.set('existing_user', {
        _id: 'existing_user',
        nickname: '现有用户',
        avatar_url: 'https://example.com/existing.png',
        vip_level: 'pro',
        pattern_count: 3
      })

      const res = await userController.getProfile({}, { openid: 'existing_user', db: mockDb })
      expect(res.code).toBe(0)
      expect(res.data.openid).toBe('existing_user')
      expect(res.data.nickname).toBe('现有用户')
      expect(res.data.pattern_count).toBe(3)
    })

    it('should fallback to syncProfile if user not found in database', async () => {
      const mockDb = createMockDb()

      const res = await userController.getProfile({}, { openid: 'non_existing_user', db: mockDb })
      expect(res.code).toBe(0)
      expect(res.data.nickname).toBe('拼豆手作人')
      expect(res.data.vip_level).toBe('pro')
      expect(res.data.pattern_count).toBe(0)

      // Verify user was created in DB
      const stored = mockDb.users.get('non_existing_user')
      expect(stored).toBeDefined()
      expect(stored.nickname).toBe('拼豆手作人')
    })
  })

  describe('Router integration', () => {
    it('should handle user.syncProfile via api.main gateway', async () => {
      const mockDb = createMockDb()
      const res = await api.main(
        {
          action: 'user.syncProfile',
          data: { nickname: '路由测试' }
        },
        {
          OPENID: 'router_user_1',
          db: mockDb
        }
      )

      expect(res.code).toBe(0)
      expect(res.data.nickname).toBe('路由测试')
    })

    it('should handle user.getProfile via api.main gateway', async () => {
      const mockDb = createMockDb()
      const res = await api.main(
        {
          action: 'user.getProfile',
          data: {}
        },
        {
          OPENID: 'router_user_2',
          db: mockDb
        }
      )

      expect(res.code).toBe(0)
      expect(res.data.nickname).toBe('拼豆手作人')
    })
  })
})
