/**
 * Mock for @tarojs/taro in Vitest Node environment
 * Delegates dynamic lookups to globalThis.Taro if available
 */
const taroProxy: any = new Proxy({}, {
  get(_target, prop) {
    if (typeof (globalThis as any).Taro !== 'undefined' && (globalThis as any).Taro !== null) {
      return (globalThis as any).Taro[prop]
    }
    return undefined
  }
})

export default taroProxy
