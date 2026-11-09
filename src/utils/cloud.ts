/**
 * WeChat CloudBase SDK Wrapper for Pindou Miniprogram
 */
import Taro from '@tarojs/taro'

/**
 * 微信云开发环境 ID（可选）
 * - 如果你的微信小程序开通了云开发，可在“微信开发者工具 -> 云开发控制台”左上角查看环境 ID
 * - 如果留空 ''，微信将默认使用当前开发者工具绑定的默认云环境
 */
export const CLOUD_ENV_ID = 'xiaogua-d7gcrxxon5dd098e8'

let hasInitialized = false

/**
 * Resets initialization flag (primarily for testing purposes)
 */
export function _resetCloudInitState(): void {
  hasInitialized = false
}

export function initCloudOnce(envId?: string): void {
  if (hasInitialized) return
  try {
    const taro = (globalThis as any).Taro || Taro
    if (taro && taro.cloud && typeof taro.cloud.init === 'function') {
      const initConfig: { traceUser: boolean; env?: string } = {
        traceUser: true
      }
      const targetEnv = envId || CLOUD_ENV_ID
      if (targetEnv) {
        initConfig.env = targetEnv
      }
      taro.cloud.init(initConfig)
      hasInitialized = true
    }
  } catch (err) {
    console.warn('[CloudBase] Initialization warning:', err)
  }
}

export interface CloudResponse<T = any> {
  code: number
  message: string
  data: T
}

export async function callCloudFunction<T = any>(
  action: string,
  data: Record<string, any> = {}
): Promise<T> {
  initCloudOnce()
  const taro = (globalThis as any).Taro || Taro

  if (!taro || !taro.cloud || typeof taro.cloud.callFunction !== 'function') {
    throw new Error('WeChat CloudBase environment is not available in current runtime')
  }

  try {
    const res = await taro.cloud.callFunction({
      name: 'api',
      data: {
        action,
        data
      }
    })

    const payload = res && (res.result as CloudResponse<T>)
    if (!payload) {
      throw new Error('Empty response from cloud function')
    }

    if (payload.code !== 0) {
      if (typeof taro.showToast === 'function') {
        taro.showToast({
          title: payload.message || '操作失败',
          icon: 'none'
        })
      }
      throw new Error(payload.message || `Cloud error code: ${payload.code}`)
    }

    return payload.data
  } catch (err: any) {
    const errMsg = String(err?.message || err?.errMsg || err)
    let friendlyMsg = errMsg

    if (errMsg.includes('-404011') || errMsg.includes('cloud function not exist')) {
      friendlyMsg = '云函数 api 未部署，请在微信开发者工具中右键 cloudfunctions/api 选择“上传并部署”'
    } else if (errMsg.includes('-401003') || errMsg.includes('Environment not found') || errMsg.includes('env not found')) {
      friendlyMsg = '未找到云开发环境，请在微信开发者工具开通云开发，或在 src/utils/cloud.ts 中填写 CLOUD_ENV_ID'
    } else if (errMsg.includes('-502005') || errMsg.includes('collection not exist')) {
      friendlyMsg = '云数据库集合不存在，请在云开发控制台创建集合(users, patterns, plaza_posts, likes)'
    }

    console.error(`[Cloud Call Error] action=${action}:`, friendlyMsg, err)
    if (typeof taro.showToast === 'function' && friendlyMsg !== errMsg) {
      taro.showToast({
        title: friendlyMsg,
        icon: 'none',
        duration: 3500
      })
    }
    throw new Error(friendlyMsg)
  }
}
