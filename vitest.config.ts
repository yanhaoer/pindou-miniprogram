import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tarojs/taro': path.resolve(__dirname, './tests/mocks/taro.ts'),
      '@tarojs/components': path.resolve(__dirname, './tests/mocks/components.ts')
    }
  }
})
