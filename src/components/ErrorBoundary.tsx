import React, { Component, type ReactNode } from 'react'
import { View, Text } from '@tarojs/components'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary caught error]', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ padding: '24px', backgroundColor: '#1a1012', minHeight: '100vh', boxSizing: 'border-box' }}>
          <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '12px', padding: '16px' }}>
            <Text style={{ color: '#ef4444', fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
              ⚠️ 页面渲染异常 (Render Error)
            </Text>
            <Text style={{ color: '#fca5a5', fontSize: '13px', display: 'block', marginBottom: '12px' }}>
              {String(this.state.error?.message || this.state.error)}
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: '10px', fontFamily: 'monospace', display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {String(this.state.error?.stack || '')}
            </Text>
          </View>
        </View>
      )
    }

    return this.props.children
  }
}
