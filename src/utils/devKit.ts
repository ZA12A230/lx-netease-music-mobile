/**
 * 开发者工具套件
 * 提供调试、性能监控、日志收集、网络检查、API测试能力
 */
import { getPerformanceReport, resetPerformanceMetrics, getMemoryInfo } from './performanceMonitor'
import { getLogs, clearLogs } from './log'
import { getBootLog } from './bootLog'
import settingState from '@/store/setting/state'
import { updateSetting } from '@/core/common'

export interface DevLogEntry {
  time: string
  level: 'info' | 'warn' | 'error' | 'debug'
  tag: string
  message: string
}

const MAX_LOG_ENTRIES = 500
const devLogs: DevLogEntry[] = []
let logSubscribers: Array<(logs: DevLogEntry[]) => void> = []

/** 添加开发者日志 */
export const addDevLog = (level: DevLogEntry['level'], tag: string, message: string) => {
  if (!settingState.setting['developer.enabled']) return
  const entry: DevLogEntry = {
    time: new Date().toLocaleTimeString(),
    level,
    tag,
    message: typeof message === 'string' ? message : JSON.stringify(message),
  }
  devLogs.push(entry)
  if (devLogs.length > MAX_LOG_ENTRIES) devLogs.shift()

  // 通知订阅者
  if (settingState.setting['developer.showLogOverlay']) {
    logSubscribers.forEach((cb) => cb([...devLogs]))
  }
}

/** 订阅日志更新 */
export const subscribeDevLogs = (cb: (logs: DevLogEntry[]) => void) => {
  logSubscribers.push(cb)
  cb([...devLogs])
  return () => {
    logSubscribers = logSubscribers.filter((fn) => fn !== cb)
  }
}

/** 获取开发者日志 */
export const getDevLogs = (): DevLogEntry[] => [...devLogs]

/** 清空开发者日志 */
export const clearDevLogs = () => {
  devLogs.length = 0
  logSubscribers.forEach((cb) => cb([]))
}

/** 获取调试面板数据 */
export const getDebugSnapshot = async () => {
  const report = getPerformanceReport()
  const mem = getMemoryInfo()
  const bootLog = getBootLog()
  let errorLog = ''
  try {
    errorLog = await getLogs()
  } catch (e) {
    errorLog = String(e)
  }
  return {
    performance: report,
    memory: mem,
    bootLog,
    errorLog,
    devLogs: getDevLogs(),
    timestamp: Date.now(),
    settings: { ...settingState.setting },
  }
}

/** 清空所有日志 */
export const clearAllLogs = async () => {
  clearDevLogs()
  await clearLogs()
  resetPerformanceMetrics()
}

/** 网络请求测试 */
export const testNetworkRequest = async (url: string): Promise<{
  ok: boolean
  status: number
  duration: number
  size: number
  error?: string
}> => {
  const startTime = Date.now()
  try {
    const response = await fetch(url, { method: 'GET' })
    const text = await response.text()
    // 估算字节数（UTF-8 编码下大致等于字符长度）
    const size = new TextEncoder().encode(text).length
    return {
      ok: response.ok,
      status: response.status,
      duration: Date.now() - startTime,
      size,
    }
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      duration: Date.now() - startTime,
      size: 0,
      error: e?.message || String(e),
    }
  }
}

/** 导出调试信息 */
export const exportDebugInfo = async (): Promise<string> => {
  const snapshot = await getDebugSnapshot()
  return JSON.stringify(snapshot, null, 2)
}

/** 启用开发者模式 */
export const enableDevMode = async () => {
  await updateSetting({ 'developer.enabled': true })
  addDevLog('info', 'DevKit', '开发者模式已启用')
}

/** 禁用开发者模式 */
export const disableDevMode = async () => {
  await updateSetting({
    'developer.enabled': false,
    'developer.showPerformanceOverlay': false,
    'developer.showLogOverlay': false,
    'developer.verboseLog': false,
    'developer.enableNetworkInspector': false,
  })
}
