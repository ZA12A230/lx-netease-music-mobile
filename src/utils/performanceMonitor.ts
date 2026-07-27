import { InteractionManager } from 'react-native'

/**
 * 性能监控工具
 * 提供简单的渲染时间、内存使用和交互延迟监控能力
 * 仅在开发模式下启用详细日志
 */

interface PerformanceMark {
  name: string
  startTime: number
  duration?: number
}

interface PerformanceMetrics {
  /** 屏幕渲染时间 */
  screenRenderTimes: Record<string, number[]>
  /** API 请求耗时 */
  apiRequestTimes: Record<string, number[]>
  /** 交互响应延迟 */
  interactionLatencies: number[]
  /** 已记录的性能标记 */
  marks: PerformanceMark[]
}

const metrics: PerformanceMetrics = {
  screenRenderTimes: {},
  apiRequestTimes: {},
  interactionLatencies: [],
  marks: [],
}

/** 最大保留的样本数 */
const MAX_SAMPLES = 50

/**
 * 开始性能标记
 * 用于测量代码块执行耗时
 *
 * @param name - 标记名称
 * @example
 * startMark('loadSongList')
 * await loadData()
 * const duration = endMark('loadSongList')
 * console.log(`加载歌单耗时: ${duration}ms`)
 */
export const startMark = (name: string): void => {
  metrics.marks.push({
    name,
    startTime: Date.now(),
  })
}

/**
 * 结束性能标记并返回耗时
 *
 * @param name - 标记名称
 * @returns 耗时（毫秒），未找到对应标记返回 -1
 */
export const endMark = (name: string): number => {
  // 从后往前找，确保找到最近的同名标记
  for (let i = metrics.marks.length - 1; i >= 0; i--) {
    const mark = metrics.marks[i]
    if (mark.name === name && mark.duration === undefined) {
      mark.duration = Date.now() - mark.startTime
      if (__DEV__) {
        console.log(`[Performance] ${name}: ${mark.duration}ms`)
      }
      return mark.duration
    }
  }
  return -1
}

/**
 * 记录屏幕渲染时间
 *
 * @param screenName - 屏幕名称
 * @param renderTime - 渲染耗时(ms)
 */
export const recordScreenRenderTime = (screenName: string, renderTime: number): void => {
  if (!metrics.screenRenderTimes[screenName]) {
    metrics.screenRenderTimes[screenName] = []
  }
  const times = metrics.screenRenderTimes[screenName]
  times.push(renderTime)
  if (times.length > MAX_SAMPLES) {
    times.shift()
  }
  if (__DEV__) {
    console.log(`[Performance] 屏幕 ${screenName} 渲染耗时: ${renderTime}ms`)
  }
}

/**
 * 记录 API 请求耗时
 *
 * @param apiName - API 名称
 * @param requestTime - 请求耗时(ms)
 */
export const recordApiRequestTime = (apiName: string, requestTime: number): void => {
  if (!metrics.apiRequestTimes[apiName]) {
    metrics.apiRequestTimes[apiName] = []
  }
  const times = metrics.apiRequestTimes[apiName]
  times.push(requestTime)
  if (times.length > MAX_SAMPLES) {
    times.shift()
  }
  // 慢请求告警
  if (requestTime > 3000) {
    console.warn(`[Performance] 慢请求告警: ${apiName} 耗时 ${requestTime}ms`)
  }
}

/**
 * 记录交互响应延迟
 *
 * @param latency - 延迟时间(ms)
 */
export const recordInteractionLatency = (latency: number): void => {
  metrics.interactionLatencies.push(latency)
  if (metrics.interactionLatencies.length > MAX_SAMPLES) {
    metrics.interactionLatencies.shift()
  }
}

/**
 * 计算数组的平均值
 */
const average = (arr: number[]): number => {
  if (arr.length === 0) return 0
  return arr.reduce((sum, val) => sum + val, 0) / arr.length
}

/**
 * 计算数组的 P95 值
 */
const p95 = (arr: number[]): number => {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const index = Math.ceil(sorted.length * 0.95) - 1
  return sorted[index]
}

/**
 * 获取性能报告摘要
 * 返回各模块的平均耗时和 P95 耗时
 */
export const getPerformanceReport = (): {
  screens: Record<string, { avg: number; p95: number; count: number }>
  apis: Record<string, { avg: number; p95: number; count: number }>
  interactions: { avg: number; p95: number; count: number }
} => {
  const screenReport: Record<string, { avg: number; p95: number; count: number }> = {}
  for (const [name, times] of Object.entries(metrics.screenRenderTimes)) {
    screenReport[name] = {
      avg: Math.round(average(times)),
      p95: Math.round(p95(times)),
      count: times.length,
    }
  }

  const apiReport: Record<string, { avg: number; p95: number; count: number }> = {}
  for (const [name, times] of Object.entries(metrics.apiRequestTimes)) {
    apiReport[name] = {
      avg: Math.round(average(times)),
      p95: Math.round(p95(times)),
      count: times.length,
    }
  }

  const interactions = {
    avg: Math.round(average(metrics.interactionLatencies)),
    p95: Math.round(p95(metrics.interactionLatencies)),
    count: metrics.interactionLatencies.length,
  }

  return {
    screens: screenReport,
    apis: apiReport,
    interactions,
  }
}

/**
 * 重置所有性能指标
 */
export const resetPerformanceMetrics = (): void => {
  metrics.screenRenderTimes = {}
  metrics.apiRequestTimes = {}
  metrics.interactionLatencies = []
  metrics.marks = []
}

/**
 * 测量异步函数执行时间的高阶函数
 *
 * @param name - 测量名称
 * @param fn - 需要测量的异步函数
 * @returns 包装后的函数，返回值与原函数一致
 *
 * @example
 * const measuredFetch = measureAsync('fetchSongList', fetchSongList)
 * const result = await measuredFetch(params)
 */
export const measureAsync = <T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T,
  isApi = false,
): T => {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now()
    try {
      const result = await fn(...args)
      const duration = Date.now() - startTime
      if (isApi) {
        recordApiRequestTime(name, duration)
      } else {
        if (__DEV__) {
          console.log(`[Performance] ${name}: ${duration}ms`)
        }
      }
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      if (isApi) {
        recordApiRequestTime(name, duration)
      }
      throw error
    }
  }) as T
}

/**
 * 在下一个交互帧执行回调
 * 用于延迟非关键渲染，提升首屏性能
 */
export const runAfterInteractions = (callback: () => void): void => {
  if (InteractionManager) {
    InteractionManager.runAfterInteractions(callback)
  } else {
    // 降级方案：使用 setTimeout
    setTimeout(callback, 16)
  }
}

/**
 * 获取当前粗略内存使用情况（仅限开发模式）
 * 注意：JSC/Hermes 引擎不提供精确内存 API，此方法仅作参考
 */
export const getMemoryInfo = (): { used?: number; total?: number } => {
  try {
    // @ts-ignore - 部分 JS 引擎支持
    if (typeof global.performance?.memory !== 'undefined') {
      // @ts-ignore
      const mem = global.performance.memory
      return {
        used: mem.usedJSHeapSize,
        total: mem.totalJSHeapSize,
      }
    }
  } catch {
    // 引擎不支持内存 API
  }
  return {}
}