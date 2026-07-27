import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** 错误恢复后的回调 */
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * React 错误边界组件
 * 捕获子组件渲染错误，防止整个应用白屏崩溃
 * 使用 class 组件是因为 React 错误边界必须使用 componentDidCatch 生命周期
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    // 记录错误日志
    console.error('[ErrorBoundary] 组件渲染错误:', error.message, errorInfo.componentStack)
    // 调用外部错误回调
    this.props.onError?.(error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onReset?.()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // 如果提供了自定义回退UI，使用它
      if (this.props.fallback) {
        return this.props.fallback
      }

      // 默认错误回退界面
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.icon}>:(</Text>
            <Text style={styles.title}>出错了</Text>
            <Text style={styles.message}>
              {this.state.error?.message || '组件渲染时发生未知错误'}
            </Text>
            {__DEV__ && this.state.errorInfo && (
              <Text style={styles.detail} numberOfLines={8}>
                {this.state.errorInfo.componentStack}
              </Text>
            )}
            <TouchableOpacity style={styles.button} onPress={this.handleReset} activeOpacity={0.7}>
              <Text style={styles.buttonText}>重试</Text>
            </TouchableOpacity>
          </View>
        </View>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    fontSize: 48,
    color: '#ff6b6b',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  detail: {
    fontSize: 10,
    color: '#999',
    textAlign: 'left',
    marginBottom: 16,
    fontFamily: 'monospace',
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 4,
    width: '100%',
  },
  button: {
    backgroundColor: '#4a90d9',
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
})