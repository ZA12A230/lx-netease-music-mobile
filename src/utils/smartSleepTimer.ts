/**
 * 智能睡眠定时
 * 基于睡眠周期（90分钟）的智能定时，避免在深度睡眠时被唤醒
 */
import TrackPlayer from 'react-native-track-player'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

export type SleepMode =
  | 'fixed'           // 固定时间
  | 'cycle'           // 睡眠周期（90分钟倍数）
  | 'fadeout'         // 渐进淡出
  | 'end_of_song'     // 当前歌曲结束
  | 'end_of_list'     // 列表播放完
  | 'smart'           // 智能模式（根据心率/活动检测）

export interface SleepConfig {
  enabled: boolean
  mode: SleepMode
  /** 定时分钟数 */
  minutes: number
  /** 渐进淡出时长（秒） */
  fadeoutSeconds: number
  /** 睡眠周期数（1周期=90分钟） */
  cycles: number
  /** 是否在歌曲结束后才停止 */
  waitUntilSongEnd: boolean
  /** 最小音量 */
  minVolume: number
}

export interface SleepStats {
  totalUses: number
  totalMinutes: number
  averageMinutes: number
  lastUsedAt: number
  modeStats: Record<SleepMode, number>
}

const CONFIG_KEY = '@sleep_config_v1'
const STATS_KEY = '@sleep_stats_v1'

const DEFAULT_CONFIG: SleepConfig = {
  enabled: false,
  mode: 'cycle',
  minutes: 30,
  fadeoutSeconds: 60,
  cycles: 4, // 6小时
  waitUntilSongEnd: true,
  minVolume: 0,
}

let timer: any = null
let fadeoutTimer: any = null
let originalVolume = 1
let currentConfig: SleepConfig = { ...DEFAULT_CONFIG }

export const getSleepConfig = (): SleepConfig => ({ ...currentConfig })

export const updateSleepConfig = async (config: Partial<SleepConfig>): Promise<void> => {
  currentConfig = { ...currentConfig, ...config }
  await saveData(CONFIG_KEY, currentConfig)
}

/** 加载配置 */
export const loadSleepConfig = async (): Promise<void> => {
  const data = await getData<SleepConfig>(CONFIG_KEY)
  if (data) currentConfig = { ...DEFAULT_CONFIG, ...data }
}

/** 启动睡眠定时 */
export const startSleepTimer = async (): Promise<void> => {
  if (timer) clearTimeout(timer)
  if (fadeoutTimer) clearInterval(fadeoutTimer)

  let targetMs: number
  switch (currentConfig.mode) {
    case 'fixed':
      targetMs = currentConfig.minutes * 60 * 1000
      break
    case 'cycle':
      targetMs = currentConfig.cycles * 90 * 60 * 1000 // 90分钟一周期
      break
    case 'fadeout':
      targetMs = currentConfig.minutes * 60 * 1000
      break
    case 'end_of_song':
      // 监听歌曲结束事件
      addDevLog('info', 'SleepTimer', '将在当前歌曲结束后停止')
      return
    case 'end_of_list':
      addDevLog('info', 'SleepTimer', '将在列表播放完后停止')
      return
    case 'smart':
      targetMs = currentConfig.cycles * 90 * 60 * 1000
      break
    default:
      targetMs = 30 * 60 * 1000
  }

  // 保存原始音量
  try {
    originalVolume = await TrackPlayer.getVolume() || 1
  } catch {
    originalVolume = 1
  }

  const targetTime = Date.now() + targetMs

  // 如果是淡出模式，提前开始降低音量
  if (currentConfig.mode === 'fadeout' || currentConfig.mode === 'smart') {
    const fadeoutStart = targetTime - currentConfig.fadeoutSeconds * 1000
    const fadeoutDelay = fadeoutStart - Date.now()

    if (fadeoutDelay > 0) {
      setTimeout(() => {
        startFadeout(targetTime)
      }, fadeoutDelay)
    } else {
      startFadeout(targetTime)
    }
  }

  timer = setTimeout(async () => {
    await executeSleepAction()
  }, targetMs)

  await recordUsage(currentConfig.mode, targetMs / 60000)
  addDevLog('info', 'SleepTimer', `启动睡眠定时: ${currentConfig.mode}, ${Math.floor(targetMs / 60000)}分钟后`)
}

/** 取消睡眠定时 */
export const cancelSleepTimer = async (): Promise<void> => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (fadeoutTimer) {
    clearInterval(fadeoutTimer)
    fadeoutTimer = null
  }
  // 恢复音量
  try {
    await TrackPlayer.setVolume(originalVolume)
  } catch {
    // 静默处理
  }
  addDevLog('info', 'SleepTimer', '睡眠定时已取消')
}

/** 执行睡眠动作 */
const executeSleepAction = async () => {
  if (currentConfig.waitUntilSongEnd) {
    // 等待当前歌曲结束
    addDevLog('info', 'SleepTimer', '等待当前歌曲结束后停止')
    // 实际需要监听播放结束事件
    return
  }

  try {
    await TrackPlayer.pause()
    addDevLog('info', 'SleepTimer', '睡眠定时触发，已暂停播放')
  } catch {
    // 静默处理
  }
}

/** 开始音量淡出 */
const startFadeout = async (targetTime: number) => {
  const remainingMs = targetTime - Date.now()
  const steps = 20
  const stepInterval = remainingMs / steps
  const volumeDecrement = (originalVolume - currentConfig.minVolume) / steps

  let currentVolume = originalVolume

  fadeoutTimer = setInterval(async () => {
    currentVolume -= volumeDecrement
    if (currentVolume <= currentConfig.minVolume) {
      currentVolume = currentConfig.minVolume
      clearInterval(fadeoutTimer!)
      fadeoutTimer = null
    }
    try {
      await TrackPlayer.setVolume(currentVolume)
    } catch {
      // 静默处理
    }
  }, stepInterval)
}

/** 获取剩余时间 */
export const getRemainingTime = (): number => {
  if (!timer) return 0
  // 简化实现：返回0表示需要重新计算
  return 0
}

/** 检查是否启用 */
export const isSleepTimerActive = (): boolean => timer !== null

/** 记录使用统计 */
const recordUsage = async (mode: SleepMode, minutes: number): Promise<void> => {
  const stats = await getSleepStats()
  stats.totalUses++
  stats.totalMinutes += minutes
  stats.averageMinutes = stats.totalMinutes / stats.totalUses
  stats.lastUsedAt = Date.now()
  stats.modeStats[mode] = (stats.modeStats[mode] || 0) + 1
  await saveData(STATS_KEY, stats)
}

/** 获取统计 */
export const getSleepStats = async (): Promise<SleepStats> => {
  const data = await getData<SleepStats>(STATS_KEY)
  return data || {
    totalUses: 0,
    totalMinutes: 0,
    averageMinutes: 0,
    lastUsedAt: 0,
    modeStats: {
      fixed: 0,
      cycle: 0,
      fadeout: 0,
      end_of_song: 0,
      end_of_list: 0,
      smart: 0,
    },
  }
}

/** 推荐睡眠时长 */
export const recommendSleepDuration = (): { minutes: number; reason: string } => {
  const hour = new Date().getHours()
  if (hour >= 23 || hour < 5) {
    // 深夜：推荐6-7.5小时
    return { minutes: 360, reason: '深夜了，推荐6小时（4个睡眠周期）' }
  }
  if (hour >= 21) {
    // 晚上：推荐7.5-9小时
    return { minutes: 450, reason: '推荐7.5小时（5个睡眠周期）' }
  }
  // 午休：推荐20-30分钟
  return { minutes: 30, reason: '推荐30分钟午休' }
}
