import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callCloudFunction, initCloudOnce, _resetCloudInitState } from '../../src/utils/cloud'

describe('Frontend Cloud SDK Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    _resetCloudInitState()
    delete (globalThis as any).Taro
  })

  it('should call Taro.cloud.callFunction with standard action envelope', async () => {
    const mockCallFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        message: 'success',
        data: { openid: 'test_user_ok' }
      }
    })

    const mockTaro = {
      cloud: {
        init: vi.fn(),
        callFunction: mockCallFunction
      }
    }
    ;(globalThis as any).Taro = mockTaro

    initCloudOnce()
    expect(mockTaro.cloud.init).toHaveBeenCalled()

    const res = await callCloudFunction<{ openid: string }>('user.syncProfile', { nickname: '小呱' })
    expect(res.openid).toBe('test_user_ok')
    expect(mockCallFunction).toHaveBeenCalledWith({
      name: 'api',
      data: {
        action: 'user.syncProfile',
        data: { nickname: '小呱' }
      }
    })
  })

  it('should throw friendly error when cloud returns non-zero code', async () => {
    const mockTaro = {
      cloud: {
        init: vi.fn(),
        callFunction: vi.fn().mockResolvedValue({
          result: {
            code: 40001,
            message: '包含敏感内容'
          }
        })
      },
      showToast: vi.fn()
    }
    ;(globalThis as any).Taro = mockTaro

    await expect(callCloudFunction('plaza.publish', { title: 'bad' })).rejects.toThrow('包含敏感内容')
    expect(mockTaro.showToast).toHaveBeenCalledWith({
      title: '包含敏感内容',
      icon: 'none'
    })
  })

  it('should throw error when WeChat CloudBase environment is not available in current runtime', async () => {
    (globalThis as any).Taro = {}

    await expect(callCloudFunction('user.syncProfile')).rejects.toThrow(
      'WeChat CloudBase environment is not available in current runtime'
    )
  })

  it('should throw error when cloud function returns empty result', async () => {
    const mockTaro = {
      cloud: {
        init: vi.fn(),
        callFunction: vi.fn().mockResolvedValue(null)
      }
    }
    ;(globalThis as any).Taro = mockTaro

    await expect(callCloudFunction('pattern.list')).rejects.toThrow('Empty response from cloud function')
  })

  it('should only initialize cloud once (idempotent)', () => {
    const mockInit = vi.fn()
    const mockTaro = {
      cloud: {
        init: mockInit,
        callFunction: vi.fn()
      }
    }
    ;(globalThis as any).Taro = mockTaro

    initCloudOnce()
    initCloudOnce()
    expect(mockInit).toHaveBeenCalledTimes(1)
    expect(mockInit).toHaveBeenCalledWith(expect.objectContaining({ traceUser: true }))
  })

  it('should handle initCloudOnce error gracefully without crashing', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mockTaro = {
      cloud: {
        init: vi.fn().mockImplementation(() => {
          throw new Error('Init error')
        })
      }
    }
    ;(globalThis as any).Taro = mockTaro

    expect(() => initCloudOnce()).not.toThrow()
    expect(consoleWarnSpy).toHaveBeenCalled()
  })

  it('should rethrow network or runtime exceptions from callFunction', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mockTaro = {
      cloud: {
        init: vi.fn(),
        callFunction: vi.fn().mockRejectedValue(new Error('Network timeout'))
      }
    }
    ;(globalThis as any).Taro = mockTaro

    await expect(callCloudFunction('pattern.create')).rejects.toThrow('Network timeout')
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})
