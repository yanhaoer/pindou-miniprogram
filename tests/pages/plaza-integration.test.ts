import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as cloud from '../../src/utils/cloud'
import * as userUtils from '../../src/utils/user'
import HomePage, {
  fetchPlazaPosts,
  handleToggleLike,
  handleForkPattern,
  PlazaPost
} from '../../src/pages/home/index'

describe('Plaza Client Integration Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    ;(globalThis as any).Taro = {
      getStorageSync: vi.fn(),
      setStorageSync: vi.fn(),
      navigateTo: vi.fn(),
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      showToast: vi.fn(),
      showModal: vi.fn(),
      setNavigationBarColor: vi.fn().mockResolvedValue({})
    }
  })

  it('should fetch plaza items for category', async () => {
    const spy = vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue({
      list: [{ _id: 'post_1', title: '皮卡丘', like_count: 10, hasLiked: false }]
    })

    const res = await cloud.callCloudFunction('plaza.list', { category: '热门' })
    expect(res.list[0].title).toBe('皮卡丘')

    const items = await fetchPlazaPosts('热门')
    expect(spy).toHaveBeenCalledWith('plaza.list', { category: '热门' })
    expect(items.length).toBe(1)
    expect(items[0]._id).toBe('post_1')
    expect(items[0].title).toBe('皮卡丘')
  })

  it('should fetch plaza items for category 全部 without category constraint', async () => {
    const spy = vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue({
      list: [{ _id: 'post_all', title: '所有分类作品', like_count: 5 }]
    })

    const items = await fetchPlazaPosts('全部')
    expect(spy).toHaveBeenCalledWith('plaza.list', {})
    expect(items[0].title).toBe('所有分类作品')
  })

  it('should return empty array if plaza.list returns empty or null list', async () => {
    vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue(null)
    const items = await fetchPlazaPosts()
    expect(items).toEqual([])
  })

  it('should toggle like and return updated status', async () => {
    const spy = vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue({
      liked: true,
      post_id: 'post_1'
    })

    const res = await cloud.callCloudFunction('plaza.toggleLike', { post_id: 'post_1' })
    expect(res.liked).toBe(true)

    const toggleRes = await handleToggleLike('post_1')
    expect(spy).toHaveBeenCalledWith('plaza.toggleLike', { post_id: 'post_1' })
    expect(toggleRes.liked).toBe(true)
    expect(toggleRes.post_id).toBe('post_1')
  })

  it('should throw error when toggling like with empty post_id', async () => {
    await expect(handleToggleLike('')).rejects.toThrow('post_id is required')
  })

  it('should propagate cloud error when toggling like fails', async () => {
    vi.spyOn(cloud, 'callCloudFunction').mockRejectedValue(new Error('Network error'))
    await expect(handleToggleLike('post_err')).rejects.toThrow('Network error')
  })

  it('should call plaza.fork and return new_pattern_id', async () => {
    const spy = vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue({
      new_pattern_id: 'new_pat_123',
      pattern: { title: '复刻作品' }
    })

    const forkRes = await handleForkPattern('post_1')
    expect(spy).toHaveBeenCalledWith('plaza.fork', { post_id: 'post_1' })
    expect(forkRes.new_pattern_id).toBe('new_pat_123')
  })

  it('should throw error when forking with empty post_id', async () => {
    await expect(handleForkPattern('')).rejects.toThrow('post_id is required')
  })

  it('should propagate cloud error when forking fails', async () => {
    vi.spyOn(cloud, 'callCloudFunction').mockRejectedValue(new Error('Database error'))
    await expect(handleForkPattern('post_err')).rejects.toThrow('Database error')
  })

  it('should verify optimistic like toggle and rollback logic simulation', async () => {
    let posts: PlazaPost[] = [
      { _id: 'post_a', title: '小鸭子', tag: '萌宠', like_count: 5, hasLiked: false }
    ]

    // 1. User clicks like -> optimistic toggle
    const toggleOptimistic = (targetId: string) => {
      posts = posts.map(p => {
        if (p._id === targetId) {
          const nextLiked = !p.hasLiked
          return {
            ...p,
            hasLiked: nextLiked,
            like_count: Math.max(0, (p.like_count || 0) + (nextLiked ? 1 : -1))
          }
        }
        return p
      })
    }

    toggleOptimistic('post_a')
    expect(posts[0].hasLiked).toBe(true)
    expect(posts[0].like_count).toBe(6)

    // 2. Cloud failure -> rollback
    const rollback = (targetId: string, prevLiked: boolean, prevCount: number) => {
      posts = posts.map(p =>
        p._id === targetId ? { ...p, hasLiked: prevLiked, like_count: prevCount } : p
      )
    }

    rollback('post_a', false, 5)
    expect(posts[0].hasLiked).toBe(false)
    expect(posts[0].like_count).toBe(5)
  })

  it('should verify draft selection navigation with patternId parameter', () => {
    const navigateToEditor = (imagePath?: string, patternId?: string) => {
      if (patternId) {
        ;(globalThis as any).Taro.navigateTo({ url: `/pages/index/index?patternId=${patternId}` })
        return
      }
      let url = '/pages/index/index?width=29&height=29&brand=artkal'
      if (imagePath) url += `&imagePath=${encodeURIComponent(imagePath)}`
      ;(globalThis as any).Taro.navigateTo({ url })
    }

    navigateToEditor(undefined, 'draft_pat_888')
    expect((globalThis as any).Taro.navigateTo).toHaveBeenCalledWith({
      url: '/pages/index/index?patternId=draft_pat_888'
    })
  })

  it('should sync user profile with cloud patternCount', async () => {
    vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue({
      openid: 'test_user_openid',
      pattern_count: 7,
      vip_level: 'vip_pro'
    })

    const initial = userUtils.saveUserProfile({
      isLoggedIn: true,
      nickName: '测试小呱',
      avatarUrl: ''
    })

    const synced = await userUtils.syncUserWithCloud(initial)
    expect(synced.patternCount).toBe(7)
    expect(synced.openid).toBe('test_user_openid')
  })

  it('should render HomePage with initial state without crashing', () => {
    const html = renderToStaticMarkup(React.createElement(HomePage))
    expect(html).toContain('home-container')
    expect(html).toContain('小呱拼豆')
    expect(html).toContain('基础版（尺寸最大52*52）')
  })
})
