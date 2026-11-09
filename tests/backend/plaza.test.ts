import { describe, it, expect } from 'vitest'

const plazaController = require('../../cloudfunctions/api/controllers/plaza')
const securityUtil = require('../../cloudfunctions/api/utils/security')
const api = require('../../cloudfunctions/api/index')

describe('Plaza Controller & Security', () => {
  describe('Security Check', () => {
    it('should pass when content is empty or cloud openapi is not available', async () => {
      expect(await securityUtil.checkText('', null)).toEqual({ pass: true })
      expect(await securityUtil.checkText('hello', {})).toEqual({ pass: true })
      expect(await securityUtil.checkText('hello', { openapi: {} })).toEqual({ pass: true })
    })

    it('should pass when msgSecCheck returns errCode 0', async () => {
      const mockCloud = {
        openapi: {
          security: {
            msgSecCheck: async () => ({ errCode: 0 })
          }
        }
      }
      const res = await securityUtil.checkText('正常合规文本', mockCloud)
      expect(res).toEqual({ pass: true })
    })

    it('should fail when msgSecCheck returns non-zero errCode', async () => {
      const mockCloud = {
        openapi: {
          security: {
            msgSecCheck: async () => ({ errCode: 87014 })
          }
        }
      }
      const res = await securityUtil.checkText('敏感词', mockCloud)
      expect(res.pass).toBe(false)
      expect(res.reason).toBe('内容包含敏感或不合规信息')
    })

    it('should fail when msgSecCheck throws errCode 87014', async () => {
      const mockCloud = {
        openapi: {
          security: {
            msgSecCheck: async () => {
              const err: any = new Error('risky content')
              err.errCode = 87014
              throw err
            }
          }
        }
      }
      const res = await securityUtil.checkText('敏感词异常', mockCloud)
      expect(res.pass).toBe(false)
      expect(res.reason).toBe('内容包含敏感或不合规信息')
    })

    it('should fallback to pass when network or other error occurs', async () => {
      const mockCloud = {
        openapi: {
          security: {
            msgSecCheck: async () => {
              const err: any = new Error('network timeout')
              err.errCode = -1
              throw err
            }
          }
        }
      }
      const res = await securityUtil.checkText('测试文本', mockCloud)
      expect(res.pass).toBe(true)
    })
  })

  describe('Plaza Controller - publish', () => {
    it('should reject unauthenticated publish', async () => {
      const res = await plazaController.publish({}, { openid: '' })
      expect(res.code).toBe(40100)
    })

    it('should reject publish without title', async () => {
      const res = await plazaController.publish({}, { openid: 'u1' })
      expect(res.code).toBe(40001)
      expect(res.message).toContain('title is required')
    })

    it('should intercept sensitive words when publishing', async () => {
      const mockSecurity = {
        checkText: async () => ({ pass: false, reason: '包含敏感内容' })
      }
      const res = await plazaController.publish(
        { title: '敏感词测试', tag: '热门' },
        { openid: 'u1', security: mockSecurity }
      )
      expect(res.code).toBe(40001)
      expect(res.message).toContain('包含敏感内容')
    })

    it('should return 50000 when db is not available', async () => {
      const mockSecurity = {
        checkText: async () => ({ pass: true })
      }
      const res = await plazaController.publish(
        { title: '测试作品', tag: '动漫' },
        { openid: 'u1', security: mockSecurity }
      )
      expect(res.code).toBe(50000)
      expect(res.message).toContain('Database connection not available')
    })

    it('should successfully publish a post and mark pattern as public', async () => {
      const posts: any[] = []
      let patternUpdated = false

      const mockDb = {
        collection(col: string) {
          if (col === 'users') {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  data: { nickname: '拼豆大师', avatar_url: 'https://example.com/avatar.jpg' }
                })
              })
            }
          }
          if (col === 'plaza_posts') {
            return {
              add: async ({ data }: any) => {
                const doc = { _id: 'post_123', ...data }
                posts.push(doc)
                return { _id: 'post_123' }
              }
            }
          }
          if (col === 'patterns') {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  data: { _id: id, _openid: 'u1', is_public: false }
                }),
                update: async ({ data }: any) => {
                  if (id === 'pat_1' && data.is_public === true) {
                    patternUpdated = true
                  }
                  return { stats: { updated: 1 } }
                }
              })
            }
          }
          throw new Error('Unknown collection: ' + col)
        }
      }

      const res = await plazaController.publish(
        {
          pattern_id: 'pat_1',
          title: '超级马里奥',
          tag: '像素风',
          preview_url: 'https://example.com/mario.png',
          size_desc: '28x28',
          colors_count: 5
        },
        { openid: 'u1', db: mockDb }
      )

      expect(res.code).toBe(0)
      expect(res.data.id).toBe('post_123')
      expect(res.data.created_at).toBeDefined()
      expect(patternUpdated).toBe(true)

      expect(posts.length).toBe(1)
      expect(posts[0].author_nickname).toBe('拼豆大师')
      expect(posts[0].author_avatar).toBe('https://example.com/avatar.jpg')
      expect(posts[0].title).toBe('超级马里奥')
      expect(posts[0].like_count).toBe(0)
      expect(posts[0].fork_count).toBe(0)
      expect(posts[0].audit_status).toBe('approved')
    })

    it('should use default nickname when user doc is not found', async () => {
      const posts: any[] = []
      const mockDb = {
        collection(col: string) {
          if (col === 'users') {
            return {
              doc: () => ({
                get: async () => { throw new Error('User not found') }
              })
            }
          }
          if (col === 'plaza_posts') {
            return {
              add: async ({ data }: any) => {
                posts.push(data)
                return { _id: 'post_456' }
              }
            }
          }
          return {
            doc: () => ({ update: async () => ({}) })
          }
        }
      }

      const res = await plazaController.publish(
        { title: '无名之作' },
        { openid: 'u_anonymous', db: mockDb }
      )
      expect(res.code).toBe(0)
      expect(posts[0].author_nickname).toBe('手作达人')
    })

    it('should reject publishing draft of another user with 40300', async () => {
      const mockDb = {
        collection(col: string) {
          if (col === 'patterns') {
            return {
              doc: (id: string) => ({
                get: async () => ({
                  data: { _id: id, _openid: 'other_user', is_public: false }
                })
              })
            }
          }
          throw new Error('Unexpected collection: ' + col)
        }
      }

      const res = await plazaController.publish(
        { pattern_id: 'pat_other', title: '别人的图纸' },
        { openid: 'attacker_user', db: mockDb }
      )
      expect(res.code).toBe(40300)
      expect(res.message).toContain('Permission denied')
    })

    it('should return 40400 when publishing non-existent pattern', async () => {
      const mockDb = {
        collection(col: string) {
          if (col === 'patterns') {
            return {
              doc: () => ({
                get: async () => { throw new Error('Not found') }
              })
            }
          }
          throw new Error('Unexpected collection: ' + col)
        }
      }

      const res = await plazaController.publish(
        { pattern_id: 'pat_not_exist', title: '不存在的图纸' },
        { openid: 'u1', db: mockDb }
      )
      expect(res.code).toBe(40400)
      expect(res.message).toContain('Pattern not found')
    })
  })

  describe('Plaza Controller - list', () => {
    it('should return error when db is not available', async () => {
      const res = await plazaController.list({}, {})
      expect(res.code).toBe(50000)
    })

    it('should return paginated posts with like status for authenticated user', async () => {
      const posts = [
        { _id: 'p1', title: '作品1', tag: '卡通', created_at: new Date(2026, 1, 2) },
        { _id: 'p2', title: '作品2', tag: '动漫', created_at: new Date(2026, 1, 1) }
      ]
      const userLikes = new Set(['u1_p1'])

      const mockDb = {
        collection(col: string) {
          if (col === 'plaza_posts') {
            return {
              where(filter: any) {
                return this
              },
              orderBy(field: string, direction: string) {
                return this
              },
              skip(n: number) {
                return this
              },
              limit(n: number) {
                return {
                  get: async () => ({ data: posts })
                }
              }
            }
          }
          if (col === 'likes') {
            return {
              doc: (id: string) => ({
                get: async () => {
                  if (userLikes.has(id)) {
                    return { data: { _id: id } }
                  }
                  throw new Error('Not found')
                }
              })
            }
          }
        }
      }

      const res = await plazaController.list({ page: 1, pageSize: 10 }, { openid: 'u1', db: mockDb })
      expect(res.code).toBe(0)
      expect(res.data.list.length).toBe(2)
      expect(res.data.list[0].hasLiked).toBe(true)
      expect(res.data.list[1].hasLiked).toBe(false)
      expect(res.data.page).toBe(1)
      expect(res.data.pageSize).toBe(10)
    })

    it('should filter by category when category is provided and not "全部"', async () => {
      let filterTag: string | null = null

      const mockDb = {
        collection(col: string) {
          if (col === 'plaza_posts') {
            return {
              where(filter: any) {
                filterTag = filter.tag
                return this
              },
              orderBy() { return this },
              skip() { return this },
              limit() {
                return {
                  get: async () => ({ data: [] })
                }
              }
            }
          }
          if (col === 'likes') {
            return {
              doc: () => ({ get: async () => { throw new Error('Not found') } })
            }
          }
        }
      }

      await plazaController.list({ category: '游戏' }, { db: mockDb })
      expect(filterTag).toBe('游戏')

      filterTag = null
      await plazaController.list({ category: '全部' }, { db: mockDb })
      expect(filterTag).toBeNull()
    })
  })

  describe('Plaza Controller - toggleLike', () => {
    it('should require authentication', async () => {
      const res = await plazaController.toggleLike({ post_id: 'p1' }, { openid: '' })
      expect(res.code).toBe(40100)
    })

    it('should require post_id', async () => {
      const res = await plazaController.toggleLike({}, { openid: 'u1' })
      expect(res.code).toBe(40003)
      expect(res.message).toContain('post_id is required')
    })

    it('should toggle like idempotently', async () => {
      const likesMap = new Map()
      const postsMap = new Map([['p1', { _id: 'p1', like_count: 5 }]])

      const mockDb = {
        collection(col: string) {
          if (col === 'likes') {
            return {
              doc: (id: string) => ({
                get: async () => {
                  const item = likesMap.get(id)
                  if (!item) throw new Error('Not found')
                  return { data: item }
                },
                set: async ({ data }: any) => { likesMap.set(id, data) },
                remove: async () => { likesMap.delete(id) }
              })
            }
          }
          if (col === 'plaza_posts') {
            return {
              doc: (id: string) => ({
                update: async ({ data }: any) => {
                  const post = postsMap.get(id)
                  post.like_count += data.like_count.$inc
                }
              })
            }
          }
        }
      }

      // 第一次点赞：like_count 应该增加
      const res1 = await plazaController.toggleLike({ post_id: 'p1' }, { openid: 'u1', db: mockDb })
      expect(res1.code).toBe(0)
      expect(res1.data.liked).toBe(true)
      expect(postsMap.get('p1').like_count).toBe(6)

      // 第二次点赞：取消点赞
      const res2 = await plazaController.toggleLike({ post_id: 'p1' }, { openid: 'u1', db: mockDb })
      expect(res2.code).toBe(0)
      expect(res2.data.liked).toBe(false)
      expect(postsMap.get('p1').like_count).toBe(5)
    })
  })

  describe('Plaza Controller - fork', () => {
    it('should require authentication', async () => {
      const res = await plazaController.fork({ post_id: 'p1' }, { openid: '' })
      expect(res.code).toBe(40100)
    })

    it('should require post_id', async () => {
      const res = await plazaController.fork({}, { openid: 'u1' })
      expect(res.code).toBe(40003)
      expect(res.message).toContain('post_id is required')
    })

    it('should return 40401 if post or source pattern not found', async () => {
      const mockDb = {
        collection(col: string) {
          return {
            doc: () => ({
              get: async () => { throw new Error('Not found') }
            })
          }
        }
      }
      const res = await plazaController.fork({ post_id: 'non_existent' }, { openid: 'u1', db: mockDb })
      expect(res.code).toBe(40401)
    })

    it('should successfully fork a pattern, increment fork_count and clone pattern doc', async () => {
      const postsMap = new Map([
        ['p1', { _id: 'p1', pattern_id: 'source_pat_1', fork_count: 2 }]
      ])
      const patternsMap = new Map([
        ['source_pat_1', {
          _id: 'source_pat_1',
          _openid: 'original_creator',
          title: '皮卡丘图纸',
          width: 20,
          height: 20,
          brand: 'artkal',
          grid_data: [{ x: 0, y: 0, color: '#000000' }],
          is_public: true
        }]
      ])
      let createdDoc: any = null

      const mockDb = {
        collection(col: string) {
          if (col === 'plaza_posts') {
            return {
              doc: (id: string) => ({
                get: async () => {
                  const post = postsMap.get(id)
                  if (!post) throw new Error('Post not found')
                  return { data: post }
                },
                update: async ({ data }: any) => {
                  const post = postsMap.get(id)
                  post.fork_count += data.fork_count.$inc
                }
              })
            }
          }
          if (col === 'patterns') {
            return {
              doc: (id: string) => ({
                get: async () => {
                  const pat = patternsMap.get(id)
                  if (!pat) throw new Error('Pattern not found')
                  return { data: pat }
                }
              }),
              add: async ({ data }: any) => {
                createdDoc = { _id: 'cloned_pat_999', ...data }
                patternsMap.set('cloned_pat_999', createdDoc)
                return { _id: 'cloned_pat_999' }
              }
            }
          }
        }
      }

      const res = await plazaController.fork({ post_id: 'p1' }, { openid: 'forker_user', db: mockDb })
      expect(res.code).toBe(0)
      expect(res.data.new_pattern_id).toBe('cloned_pat_999')
      expect(postsMap.get('p1').fork_count).toBe(3)

      expect(createdDoc._openid).toBe('forker_user')
      expect(createdDoc.title).toBe('皮卡丘图纸 (副本)')
      expect(createdDoc.fork_from_id).toBe('source_pat_1')
      expect(createdDoc.is_public).toBe(false)
      expect(createdDoc.width).toBe(20)
      expect(createdDoc.grid_data).toEqual([{ x: 0, y: 0, color: '#000000' }])
      expect(createdDoc._id).toBe('cloned_pat_999')
    })

    it('should increment pattern_count when user forks a pattern', async () => {
      const usersMap = new Map([['forker_user', { _id: 'forker_user', pattern_count: 2 }]])
      const postsMap = new Map([['p1', { _id: 'p1', pattern_id: 'src_pat', fork_count: 0 }]])
      const patternsMap = new Map([['src_pat', { _id: 'src_pat', _openid: 'orig', title: '原图纸' }]])

      const mockDb = {
        command: {
          inc: (n: number) => ({ $inc: n })
        },
        collection(col: string) {
          if (col === 'plaza_posts') {
            return {
              doc: (id: string) => ({
                get: async () => ({ data: postsMap.get(id) }),
                update: async ({ data }: any) => {
                  const post = postsMap.get(id)
                  const incVal = typeof data.fork_count === 'object' ? data.fork_count.$inc : data.fork_count
                  post.fork_count += incVal
                }
              })
            }
          }
          if (col === 'patterns') {
            return {
              doc: (id: string) => ({
                get: async () => ({ data: patternsMap.get(id) })
              }),
              add: async ({ data }: any) => {
                patternsMap.set('cloned_id', { _id: 'cloned_id', ...data })
                return { _id: 'cloned_id' }
              }
            }
          }
          if (col === 'users') {
            return {
              doc: (id: string) => ({
                update: async ({ data }: any) => {
                  const user = usersMap.get(id)
                  const incVal = typeof data.pattern_count === 'object' ? data.pattern_count.$inc : data.pattern_count
                  user.pattern_count += incVal
                }
              })
            }
          }
          throw new Error('Unexpected collection: ' + col)
        }
      }

      const res = await plazaController.fork({ post_id: 'p1' }, { openid: 'forker_user', db: mockDb })
      expect(res.code).toBe(0)
      expect(usersMap.get('forker_user')!.pattern_count).toBe(3)
    })
  })

  describe('Router integration for Plaza routes', () => {
    it('should have plaza actions registered in routes', async () => {
      expect(api.routes['plaza.publish']).toBeTypeOf('function')
      expect(api.routes['plaza.list']).toBeTypeOf('function')
      expect(api.routes['plaza.toggleLike']).toBeTypeOf('function')
      expect(api.routes['plaza.fork']).toBeTypeOf('function')
    })

    it('should route plaza.toggleLike through api.main', async () => {
      const likesMap = new Map()
      const postsMap = new Map([['p100', { _id: 'p100', like_count: 0 }]])

      const mockDb = {
        collection(col: string) {
          if (col === 'likes') {
            return {
              doc: (id: string) => ({
                get: async () => {
                  const item = likesMap.get(id)
                  if (!item) throw new Error('Not found')
                  return { data: item }
                },
                set: async ({ data }: any) => { likesMap.set(id, data) },
                remove: async () => { likesMap.delete(id) }
              })
            }
          }
          if (col === 'plaza_posts') {
            return {
              doc: (id: string) => ({
                update: async ({ data }: any) => {
                  const post = postsMap.get(id)
                  post.like_count += data.like_count.$inc
                }
              })
            }
          }
        }
      }

      const res = await api.main(
        { action: 'plaza.toggleLike', data: { post_id: 'p100' } },
        { OPENID: 'user_rt', db: mockDb }
      )
      expect(res.code).toBe(0)
      expect(res.data.liked).toBe(true)
      expect(postsMap.get('p100').like_count).toBe(1)
    })
  })
})
