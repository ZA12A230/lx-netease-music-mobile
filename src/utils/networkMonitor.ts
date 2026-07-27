/**
 * 网络状态监控工具
 * 实时检测网络连接状态，支持自动重试失败的网络请求
 * 使用 fetch 轮询方式检测，无需额外依赖
 */
import { useEffect, useState } from 'react'

type NetworkType = 'wifi' | 'cellular' | 'none' | 'unknown'

interface NetworkStatus {
  isConnected: boolean
  networkType: NetworkType
  isInternetReachable: boolean | null
}

let currentStatus: NetworkStatus = {
  isConnected: true,
  networkType: 'unknown',
  isInternetReachable: null,
}

// 网络状态变化监听器
const listeners: Set<(status: NetworkStatus) => void> = new Set()

// 待重试的回调队列
interface RetryTask {
  callback: () => Promise<any>
  resolve: (value: any) => void
  reject: (error: Error) => void
  retries: number
  maxRetries: number
  retryDelay: number
}
const retryQueue: RetryTask[] = []

let isInitialized = false
let pollInterval: ReturnType<typeof setInterval> | null = null

/** 检测网络连通性 */
const checkConnectivity = async (): Promise<boolean> => {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    // 使用 HEAD 请求检测网络连通性
    const response = await fetch('https://www.baidu.com/favicon.ico', {
      method: 'HEAD',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}

/** 初始化网络监听 */
export const initNetworkMonitor = () => {
  if (isInitialized) return
  isInitialized = true

  // 立即检测一次
  void checkConnectivity().then((isConnected) => {
    updateStatus(isConnected)
  })

  // 每30秒检测一次
  pollInterval = setInterval(() => {
    void checkConnectivity().then((isConnected) => {
      updateStatus(isConnected)
    })
  }, 30000)
}

/** 更新网络状态 */
const updateStatus = (isConnected: boolean) => {
  const wasDisconnected = !currentStatus.isConnected
  const newStatus: NetworkStatus = {
    isConnected,
    networkType: isConnected ? 'unknown' : 'none',
    isInternetReachable: isConnected,
  }

  if (
    currentStatus.isConnected === newStatus.isConnected &&
    currentStatus.isInternetReachable === newStatus.isInternetReachable
  ) {
    return
  }

  currentStatus = newStatus

  // 通知所有监听器
  for (const listener of listeners) {
    listener(newStatus)
  }

  // 网络恢复时处理重试队列
  if (wasDisconnected && isConnected) {
    processRetryQueue()
  }
}

/** 获取当前网络状态 */
export const getNetworkStatus = (): NetworkStatus => currentStatus

/** 添加网络状态监听 */
export const addNetworkListener = (listener: (status: NetworkStatus) => void) => {
  listeners.add(listener)
  // 立即通知当前状态
  listener(currentStatus)
  return () => {
    listeners.delete(listener)
  }
}

/** 添加网络重试任务 */
export const addRetryTask = (
  callback: () => Promise<any>,
  options: {
    maxRetries?: number
    retryDelay?: number
  } = {},
): Promise<any> => {
  const { maxRetries = 3, retryDelay = 2000 } = options

  return new Promise((resolve, reject) => {
    const task: RetryTask = {
      callback,
      resolve,
      reject,
      retries: 0,
      maxRetries,
      retryDelay,
    }
    retryQueue.push(task)
    processRetryQueue()
  })
}

/** 处理重试队列 */
const processRetryQueue = async () => {
  if (retryQueue.length === 0) return

  const task = retryQueue.shift()!
  if (!currentStatus.isConnected) {
    // 网络不可用，放回队列等待
    if (task.retries < task.maxRetries) {
      retryQueue.push(task)
    } else {
      task.reject(new Error('网络不可用，已达最大重试次数'))
    }
    return
  }

  try {
    const result = await task.callback()
    task.resolve(result)
  } catch (error: any) {
    task.retries++
    if (
      task.retries < task.maxRetries &&
      (error.message?.includes('Network') ||
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('too many requests'))
    ) {
      // 延迟后重试
      setTimeout(() => {
        retryQueue.unshift(task)
        processRetryQueue()
      }, task.retryDelay * task.retries)
    } else {
      task.reject(error)
    }
  }
}

/**
 * React Hook: 监听网络状态
 */
export const useNetworkStatus = (): NetworkStatus => {
  const [status, setStatus] = useState<NetworkStatus>(currentStatus)

  useEffect(() => {
    return addNetworkListener(setStatus)
  }, [])

  return status
}

/**
 * 网络请求包装器：自动重试失败的请求
 */
export const withNetworkRetry = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: { maxRetries?: number; retryDelay?: number },
): T => {
  return (async (...args: any[]) => {
    return addRetryTask(() => fn(...args), options)
  }) as unknown as T
}