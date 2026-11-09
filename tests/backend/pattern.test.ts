import { describe, it, expect } from 'vitest'
const patternController = require('../../cloudfunctions/api/controllers/pattern')
const api = require('../../cloudfunctions/api/index')

describe('Pattern Controller', () => {
  function createMockDb() {
    const patterns = new Map<string, any>()
    const users = new Map<string, any>()
    let autoId = 1

    return {
      patterns,
      users,
      command: {
        inc: (n: number) => ({ $inc: n })
      },
      collection(name: string) {
        if (name === 'patterns') {
          return {
            add: async ({ data }: any) => {
              const id = `pattern_${autoId++}`
              const doc = { _id: id, ...data }
              patterns.set(id, doc)
              return { _id: id }
            },
            doc: (id: string) => ({
              get: async () => {
                const doc = patterns.get(id)
                if (!doc) throw new Error('Pattern not found')
                return { data: { ...doc } }
              },
              update: async ({ data }: any) => {
                const doc = patterns.get(id)
                if (!doc) throw new Error('Pattern not found')
                const updated = { ...doc, ...data }
                patterns.set(id, updated)
                return { stats: { updated: 1 } }
              },
              remove: async () => {
                const doc = patterns.get(id)
                if (!doc) throw new Error('Pattern not found')
                patterns.delete(id)
                return { stats: { removed: 1 } }
              }
            }),
            where(query: any) {
              return {
                field(projection: any) {
                  return {
                    orderBy(orderField: string, dir: string) {
                      return {
                        skip(skipCount: number) {
                          return {
                            limit: (limitCount: number) => ({
                              get: async () => {
                                let list = Array.from(patterns.values()).filter((item) => {
                                  for (const key in query) {
                                    if (item[key] !== query[key]) return false
                                  }
                                  return true
                                })
                                list.sort((a, b) => {
                                  const aVal = a[orderField]
                                  const bVal = b[orderField]
                                  if (dir === 'desc') return bVal > aVal ? 1 : -1
                                  return aVal > bVal ? 1 : -1
                                })
                                const paginated = list.slice(skipCount, skipCount + limitCount)
                                // Handle projection
                                const projected = paginated.map((item) => {
                                  const copy = { ...item }
                                  for (const pKey in projection) {
                                    if (projection[pKey] === false) {
                                      delete copy[pKey]
                                    }
                                  }
                                  return copy
                                })
                                return { data: projected }
                              }
                            })
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (name === 'users') {
          return {
            doc: (id: string) => ({
              get: async () => {
                const u = users.get(id)
                if (!u) throw new Error('User not found')
                return { data: { ...u } }
              },
              update: async ({ data }: any) => {
                const u = users.get(id) || { _id: id, pattern_count: 0 }
                if (data.pattern_count && typeof data.pattern_count === 'object' && '$inc' in data.pattern_count) {
                  u.pattern_count = (u.pattern_count || 0) + data.pattern_count.$inc
                } else if (typeof data.pattern_count === 'number') {
                  u.pattern_count = data.pattern_count
                }
                users.set(id, u)
                return { stats: { updated: 1 } }
              }
            })
          }
        }

        throw new Error(`Unknown collection: ${name}`)
      }
    }
  }

  describe('saveDraft', () => {
    it('should reject unauthenticated request', async () => {
      const res = await patternController.saveDraft({ width: 29, height: 29 }, { openid: '' })
      expect(res.code).toBe(40100)
    })

    it('should validate required width and height', async () => {
      const res = await patternController.saveDraft({ title: '马里奥' }, { openid: 'u1' })
      expect(res.code).toBe(40002)
      expect(res.message).toContain('width and height are required')
    })

    it('should return error when database connection is not available', async () => {
      const res = await patternController.saveDraft({ width: 29, height: 29 }, { openid: 'u1' })
      expect(res.code).toBe(50000)
      expect(res.message).toContain('Database connection not available')
    })

    it('should save new draft with generated ID and update user count', async () => {
      const mockDb = createMockDb()

      const res = await patternController.saveDraft({
        title: '皮卡丘挂件',
        width: 29,
        height: 29,
        brand: 'artkal',
        grid_data: [[1, 2], [3, 4]],
        color_summary: { A01: 4 }
      }, { openid: 'u1', db: mockDb })

      expect(res.code).toBe(0)
      expect(res.data.id).toBeDefined()
      expect(res.data.created_at).toBeDefined()

      // Verify stored document
      const doc = mockDb.patterns.get(res.data.id)
      expect(doc._openid).toBe('u1')
      expect(doc.title).toBe('皮卡丘挂件')
      expect(doc.width).toBe(29)
      expect(doc.height).toBe(29)
      expect(doc.brand).toBe('artkal')
      expect(doc.is_public).toBe(false)
      expect(doc.grid_data).toEqual([[1, 2], [3, 4]])
      expect(doc.color_summary).toEqual({ A01: 4 })

      // Verify user pattern_count incremented
      const user = mockDb.users.get('u1')
      expect(user).toBeDefined()
      expect(user.pattern_count).toBe(1)
    })

    it('should use default values for omitted optional fields when creating draft', async () => {
      const mockDb = createMockDb()

      const res = await patternController.saveDraft({
        width: 10,
        height: 10
      }, { openid: 'u2', db: mockDb })

      expect(res.code).toBe(0)
      const doc = mockDb.patterns.get(res.data.id)
      expect(doc.title).toBe('未命名图纸')
      expect(doc.brand).toBe('artkal')
      expect(doc.preview_url).toBe('')
      expect(doc.fork_from_id).toBeNull()
      expect(doc.is_public).toBe(false)
    })

    it('should update existing draft when id is provided without incrementing user count', async () => {
      const mockDb = createMockDb()
      const originalDate = new Date('2026-01-01')
      mockDb.patterns.set('existing_pattern_1', {
        _id: 'existing_pattern_1',
        _openid: 'u1',
        title: '旧标题',
        width: 20,
        height: 20,
        brand: 'perler',
        grid_data: [[0]],
        color_summary: {},
        preview_url: '',
        created_at: originalDate,
        updated_at: originalDate
      })
      mockDb.users.set('u1', { _id: 'u1', pattern_count: 5 })

      const res = await patternController.saveDraft({
        id: 'existing_pattern_1',
        title: '新标题',
        width: 30,
        height: 30,
        brand: 'artkal',
        grid_data: [[1]],
        color_summary: { B01: 1 },
        preview_url: 'https://example.com/p.png'
      }, { openid: 'u1', db: mockDb })

      expect(res.code).toBe(0)
      expect(res.data.id).toBe('existing_pattern_1')
      expect(res.data.updated_at).toBeDefined()

      const updated = mockDb.patterns.get('existing_pattern_1')
      expect(updated.title).toBe('新标题')
      expect(updated.width).toBe(30)
      expect(updated.height).toBe(30)
      expect(updated.brand).toBe('artkal')
      expect(updated.grid_data).toEqual([[1]])
      expect(updated.preview_url).toBe('https://example.com/p.png')
      expect(updated.created_at).toEqual(originalDate)

      // User count should remain unchanged
      const user = mockDb.users.get('u1')
      expect(user.pattern_count).toBe(5)
    })

    it('should return 40400 when updating non-existent draft', async () => {
      const mockDb = createMockDb()
      const res = await patternController.saveDraft({
        id: 'non_existent_pattern',
        width: 10,
        height: 10
      }, { openid: 'u1', db: mockDb })

      expect(res.code).toBe(40400)
      expect(res.message).toContain('Pattern not found')
    })

    it('should reject updating draft of another user with 40300', async () => {
      const mockDb = createMockDb()
      mockDb.patterns.set('user_a_pattern', {
        _id: 'user_a_pattern',
        _openid: 'user_a',
        title: '用户A的图纸',
        width: 10,
        height: 10
      })

      const res = await patternController.saveDraft({
        id: 'user_a_pattern',
        title: '试图篡改标题',
        width: 10,
        height: 10
      }, { openid: 'attacker_user', db: mockDb })

      expect(res.code).toBe(40300)
      expect(res.message).toContain('Permission denied')

      // Ensure unchanged
      const original = mockDb.patterns.get('user_a_pattern')
      expect(original.title).toBe('用户A的图纸')
    })
  })

  describe('listMine', () => {
    it('should reject unauthenticated request', async () => {
      const res = await patternController.listMine({}, { openid: '' })
      expect(res.code).toBe(40100)
    })

    it('should paginate and exclude grid_data', async () => {
      const mockDb = createMockDb()
      for (let i = 1; i <= 5; i++) {
        mockDb.patterns.set(`p_${i}`, {
          _id: `p_${i}`,
          _openid: 'u1',
          title: `图纸 ${i}`,
          width: 20,
          height: 20,
          grid_data: [[i]],
          updated_at: new Date(2026, 0, i)
        })
      }
      // Add another user's pattern
      mockDb.patterns.set('other_p', {
        _id: 'other_p',
        _openid: 'other_user',
        title: '其他用户图纸',
        updated_at: new Date(2026, 0, 10)
      })

      const res = await patternController.listMine({ page: 1, pageSize: 3 }, { openid: 'u1', db: mockDb })

      expect(res.code).toBe(0)
      expect(res.data.page).toBe(1)
      expect(res.data.pageSize).toBe(3)
      expect(res.data.list.length).toBe(3)
      // Ordered by updated_at desc (p_5, p_4, p_3)
      expect(res.data.list[0]._id).toBe('p_5')
      expect(res.data.list[1]._id).toBe('p_4')
      expect(res.data.list[2]._id).toBe('p_3')
      // grid_data should be excluded
      expect(res.data.list[0].grid_data).toBeUndefined()
    })

    it('should enforce default and max page size constraints', async () => {
      const mockDb = createMockDb()
      const resDefault = await patternController.listMine({}, { openid: 'u1', db: mockDb })
      expect(resDefault.data.pageSize).toBe(15)

      const resCapped = await patternController.listMine({ pageSize: 100 }, { openid: 'u1', db: mockDb })
      expect(resCapped.data.pageSize).toBe(50)
    })
  })

  describe('getDetail', () => {
    it('should validate required id', async () => {
      const res = await patternController.getDetail({}, { openid: 'u1' })
      expect(res.code).toBe(40003)
      expect(res.message).toContain('id is required')
    })

    it('should return complete pattern document including grid_data', async () => {
      const mockDb = createMockDb()
      mockDb.patterns.set('detail_p1', {
        _id: 'detail_p1',
        _openid: 'u1',
        title: '详细图纸',
        width: 10,
        height: 10,
        grid_data: [[1, 2], [3, 4]],
        color_summary: { A01: 2 }
      })

      const res = await patternController.getDetail({ id: 'detail_p1' }, { openid: 'u1', db: mockDb })
      expect(res.code).toBe(0)
      expect(res.data._id).toBe('detail_p1')
      expect(res.data.title).toBe('详细图纸')
      expect(res.data.grid_data).toEqual([[1, 2], [3, 4]])
    })

    it('should return 40400 when pattern is not found', async () => {
      const mockDb = createMockDb()
      const res = await patternController.getDetail({ id: 'non_existent' }, { openid: 'u1', db: mockDb })
      expect(res.code).toBe(40400)
    })

    it('should reject reading private draft of another user in getDetail with 40300', async () => {
      const mockDb = createMockDb()
      mockDb.patterns.set('private_p', {
        _id: 'private_p',
        _openid: 'user_a',
        title: '私密草稿',
        is_public: false
      })

      const res = await patternController.getDetail({ id: 'private_p' }, { openid: 'user_b', db: mockDb })
      expect(res.code).toBe(40300)
      expect(res.message).toContain('Permission denied')
    })

    it('should allow reading public draft of another user in getDetail', async () => {
      const mockDb = createMockDb()
      mockDb.patterns.set('public_p', {
        _id: 'public_p',
        _openid: 'user_a',
        title: '公开图纸',
        is_public: true
      })

      const res = await patternController.getDetail({ id: 'public_p' }, { openid: 'user_b', db: mockDb })
      expect(res.code).toBe(0)
      expect(res.data._id).toBe('public_p')
      expect(res.data.title).toBe('公开图纸')
    })
  })

  describe('deleteDraft', () => {
    it('should reject unauthenticated request', async () => {
      const res = await patternController.deleteDraft({ id: 'p1' }, { openid: '' })
      expect(res.code).toBe(40100)
    })

    it('should validate required id', async () => {
      const res = await patternController.deleteDraft({}, { openid: 'u1' })
      expect(res.code).toBe(40003)
      expect(res.message).toContain('id is required')
    })

    it('should return 40400 when pattern does not exist', async () => {
      const mockDb = createMockDb()
      const res = await patternController.deleteDraft({ id: 'non_existent' }, { openid: 'u1', db: mockDb })
      expect(res.code).toBe(40400)
    })

    it('should reject deletion with 40300 if pattern belongs to another user', async () => {
      const mockDb = createMockDb()
      mockDb.patterns.set('target_p', {
        _id: 'target_p',
        _openid: 'owner_user',
        title: '别人图纸'
      })

      const res = await patternController.deleteDraft({ id: 'target_p' }, { openid: 'attacker_user', db: mockDb })
      expect(res.code).toBe(40300)
      expect(res.message).toContain('Permission denied')
      expect(mockDb.patterns.has('target_p')).toBe(true)
    })

    it('should delete pattern and decrement user pattern count when caller is owner', async () => {
      const mockDb = createMockDb()
      mockDb.patterns.set('del_p1', {
        _id: 'del_p1',
        _openid: 'u1',
        title: '准备删除的图纸'
      })
      mockDb.users.set('u1', { _id: 'u1', pattern_count: 3 })

      const res = await patternController.deleteDraft({ id: 'del_p1' }, { openid: 'u1', db: mockDb })
      expect(res.code).toBe(0)
      expect(res.data.id).toBe('del_p1')
      expect(res.data.deleted).toBe(true)

      // Verified removed from DB
      expect(mockDb.patterns.has('del_p1')).toBe(false)

      // User count decremented
      const user = mockDb.users.get('u1')
      expect(user.pattern_count).toBe(2)
    })
  })

  describe('Router integration via api.main', () => {
    it('should dispatch pattern.saveDraft through gateway', async () => {
      const mockDb = createMockDb()
      const res = await api.main({
        action: 'pattern.saveDraft',
        data: {
          title: '网关图纸',
          width: 15,
          height: 15
        }
      }, { OPENID: 'gateway_user', db: mockDb })

      expect(res.code).toBe(0)
      expect(res.data.id).toBeDefined()
    })

    it('should dispatch pattern.listMine through gateway', async () => {
      const mockDb = createMockDb()
      mockDb.patterns.set('p_gw_1', {
        _id: 'p_gw_1',
        _openid: 'gateway_user',
        title: '网关图纸',
        updated_at: new Date()
      })

      const res = await api.main({
        action: 'pattern.listMine',
        data: {}
      }, { OPENID: 'gateway_user', db: mockDb })

      expect(res.code).toBe(0)
      expect(res.data.list.length).toBe(1)
    })

    it('should dispatch pattern.getDetail through gateway', async () => {
      const mockDb = createMockDb()
      mockDb.patterns.set('p_gw_1', {
        _id: 'p_gw_1',
        _openid: 'gateway_user',
        title: '网关详情图纸',
        grid_data: [[1, 2]]
      })

      const res = await api.main({
        action: 'pattern.getDetail',
        data: { id: 'p_gw_1' }
      }, { OPENID: 'gateway_user', db: mockDb })

      expect(res.code).toBe(0)
      expect(res.data.title).toBe('网关详情图纸')
    })

    it('should dispatch pattern.delete through gateway', async () => {
      const mockDb = createMockDb()
      mockDb.patterns.set('p_gw_1', {
        _id: 'p_gw_1',
        _openid: 'gateway_user',
        title: '网关待删图纸'
      })

      const res = await api.main({
        action: 'pattern.delete',
        data: { id: 'p_gw_1' }
      }, { OPENID: 'gateway_user', db: mockDb })

      expect(res.code).toBe(0)
      expect(res.data.deleted).toBe(true)
    })
  })
})
