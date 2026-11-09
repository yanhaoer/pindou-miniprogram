import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as cloud from '../../src/utils/cloud'
import {
  DraftsSheet,
  DraftItem,
  formatDraftTime,
  getDraftColorCount
} from '../../src/components/DraftsSheet'
import {
  PublishModal,
  PUBLISH_TAGS,
  handlePublishSubmit
} from '../../src/components/PublishModal'

describe('DraftsSheet Data & Component Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    ;(globalThis as any).Taro = {
      showModal: vi.fn(),
      showToast: vi.fn()
    }
  })

  it('should export DraftsSheet and PublishModal components', () => {
    expect(DraftsSheet).toBeDefined()
    expect(PublishModal).toBeDefined()
  })

  it('should fetch mine patterns list via pattern.listMine', async () => {
    const mockList: DraftItem[] = [
      {
        _id: 'd1',
        title: '马里奥',
        width: 29,
        height: 29,
        brand: 'artkal',
        preview_url: 'cloud://thumb1.png',
        color_summary: { '#FF0000': 10, '#00FF00': 5 },
        updated_at: new Date('2026-11-05T10:00:00Z')
      }
    ]
    const spy = vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue({ list: mockList })

    const res = await cloud.callCloudFunction('pattern.listMine', { page: 1, pageSize: 30 })
    expect(spy).toHaveBeenCalledWith('pattern.listMine', { page: 1, pageSize: 30 })
    expect(res.list.length).toBe(1)
    expect(res.list[0].title).toBe('马里奥')
    expect(res.list[0].width).toBe(29)
  })

  it('should handle empty mine patterns list', async () => {
    vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue({ list: [] })
    const res = await cloud.callCloudFunction('pattern.listMine', { page: 1, pageSize: 30 })
    expect(res.list).toEqual([])
  })

  it('should properly format draft time and count colors', () => {
    const date = new Date('2026-11-05T12:30:00Z')
    const formatted = formatDraftTime(date)
    expect(formatted).toBeTruthy()
    expect(typeof formatted).toBe('string')

    // formatDraftTime fallback with invalid date
    expect(formatDraftTime(null as any)).toBe('未知时间')
    expect(formatDraftTime('invalid-date')).toBe('未知时间')

    // Today format test
    const now = new Date()
    expect(formatDraftTime(now)).toContain('今天')

    // Color count calculation
    expect(getDraftColorCount({ color_summary: { c1: 2, c2: 3 } } as any)).toBe(2)
    expect(getDraftColorCount({ colors_count: 5 } as any)).toBe(5)
    expect(getDraftColorCount(null)).toBe(0)
    expect(getDraftColorCount({} as any)).toBe(0)
  })

  it('should call pattern.delete on confirmed deletion', async () => {
    const deleteSpy = vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue({ id: 'd1', deleted: true })

    const res = await cloud.callCloudFunction('pattern.delete', { id: 'd1' })
    expect(deleteSpy).toHaveBeenCalledWith('pattern.delete', { id: 'd1' })
    expect(res.deleted).toBe(true)
  })

  it('should render null when isOpen is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(DraftsSheet, {
        isOpen: false,
        onClose: vi.fn(),
        onSelectDraft: vi.fn()
      })
    )
    expect(html).toBe('')
  })
})

describe('PublishModal Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    ;(globalThis as any).Taro = {
      showModal: vi.fn(),
      showToast: vi.fn()
    }
  })

  it('should provide default category tags', () => {
    expect(PUBLISH_TAGS).toEqual(['复古游戏', '可爱萌宠', '热门动漫', '美食小物', '其他'])
  })

  it('should reject empty title when submitting publish', async () => {
    const mockTaro = (globalThis as any).Taro
    const cloudSpy = vi.spyOn(cloud, 'callCloudFunction')

    const success = await handlePublishSubmit({
      draft: { _id: 'd1', width: 29, height: 29 },
      title: '   ',
      tag: '复古游戏',
      onSuccess: vi.fn(),
      onClose: vi.fn()
    })

    expect(success).toBe(false)
    expect(cloudSpy).not.toHaveBeenCalled()
    expect(mockTaro.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('标题'),
        icon: 'none'
      })
    )
  })

  it('should submit publish successfully to plaza.publish', async () => {
    const mockTaro = (globalThis as any).Taro
    const publishSpy = vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue({ id: 'plaza_1' })
    const onSuccess = vi.fn()
    const onClose = vi.fn()

    const success = await handlePublishSubmit({
      draft: {
        _id: 'd1',
        title: '测试图纸',
        width: 29,
        height: 29,
        preview_url: 'cloud://preview.png',
        color_summary: { A01: 12, A02: 8 }
      },
      title: '新发布标题',
      tag: '热门动漫',
      onSuccess,
      onClose
    })

    expect(success).toBe(true)
    expect(publishSpy).toHaveBeenCalledWith('plaza.publish', {
      pattern_id: 'd1',
      title: '新发布标题',
      tag: '热门动漫',
      preview_url: 'cloud://preview.png',
      size_desc: '29×29',
      colors_count: 2
    })
    expect(mockTaro.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '发布成功',
        icon: 'success'
      })
    )
    expect(onSuccess).toHaveBeenCalledWith({ id: 'plaza_1' })
    expect(onClose).toHaveBeenCalled()
  })

  it('should handle sensitive content rejection (40001) with friendly toast', async () => {
    const mockTaro = (globalThis as any).Taro
    const error: any = new Error('内容存在不合规字符，请修改后重试')
    error.code = 40001
    vi.spyOn(cloud, 'callCloudFunction').mockRejectedValue(error)

    const onSuccess = vi.fn()
    const onClose = vi.fn()

    const success = await handlePublishSubmit({
      draft: { _id: 'd1', width: 29, height: 29 },
      title: '违规词汇',
      tag: '复古游戏',
      onSuccess,
      onClose
    })

    expect(success).toBe(false)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(mockTaro.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/违规|敏感|不合规/),
        icon: 'none'
      })
    )
  })

  it('should handle general cloud error on publish with toast', async () => {
    const mockTaro = (globalThis as any).Taro
    vi.spyOn(cloud, 'callCloudFunction').mockRejectedValue(new Error('Network timeout'))

    const success = await handlePublishSubmit({
      draft: { _id: 'd1', width: 20, height: 20 },
      title: '正常标题',
      tag: '美食小物'
    })

    expect(success).toBe(false)
    expect(mockTaro.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Network timeout',
        icon: 'none'
      })
    )
  })

  it('should render null when isOpen is false or draft is missing in PublishModal', () => {
    const html1 = renderToStaticMarkup(
      React.createElement(PublishModal, {
        isOpen: false,
        draft: { _id: '1' },
        onClose: vi.fn()
      })
    )
    expect(html1).toBe('')

    const html2 = renderToStaticMarkup(
      React.createElement(PublishModal, {
        isOpen: true,
        draft: null,
        onClose: vi.fn()
      })
    )
    expect(html2).toBe('')
  })
})
