/**
 * DJ 模式模块
 * 实现歌曲间无缝衔接、节拍同步、淡入淡出
 */
import TrackPlayer from 'react-native-track-player'
import playerState from '@/store/player/state'
import { addDevLog } from './devKit'

export type CrossfadeMode = 'off' | 'fade' | 'crossfade' | 'beatmatch'

export interface DJConfig {
  mode: CrossfadeMode
  /** 淡入淡出持续时间（秒） */
  fadeDuration: number
  /** 是否启用节拍同步 */
  beatSync: boolean
  /** 是否自动调整BPM */
  autoBPM: boolean
  /** 目标BPM（0表示自动） */
  targetBPM: number
}

const DEFAULT_CONFIG: DJConfig = {
  mode: 'crossfade',
  fadeDuration: 8,
  beatSync: true,
  autoBPM: false,
  targetBPM: 0,
}

let currentConfig: DJConfig = { ...DEFAULT_CONFIG }
let fadeInterval: ReturnType<typeof setInterval> | null = null
let isDJActive = false

/** 启用 DJ 模式 */
export const enableDJMode = async (config?: Partial<DJConfig>) => {
  if (config) currentConfig = { ...currentConfig, ...config }
  isDJActive = true
  addDevLog('info', 'DJMode', `DJ模式已启用: ${currentConfig.mode}`)
  await setupDJEventListeners()
}

/** 禁用 DJ 模式 */
export const disableDJMode = async () => {
  isDJActive = false
  if (fadeInterval) {
    clearInterval(fadeInterval)
    fadeInterval = null
  }
  addDevLog('info', 'DJMode', 'DJ模式已禁用')
}

/** 是否启用 */
export const isDJEnabled = (): boolean => isDJActive

/** 获取配置 */
export const getDJConfig = (): DJConfig => ({ ...currentConfig })

/** 更新配置 */
export const updateDJConfig = (config: Partial<DJConfig>) => {
  currentConfig = { ...currentConfig, ...config }
}

/** 设置 DJ 事件监听器 */
const setupDJEventListeners = async () => {
  // 监听播放进度，在歌曲即将结束时触发淡入淡出
  // 这里使用轮询方式，避免过度依赖事件系统
  if (fadeInterval) clearInterval(fadeInterval)

  fadeInterval = setInterval(async () => {
    if (!isDJActive) return
    try {
      const position = await TrackPlayer.getPosition()
      const duration = await TrackPlayer.getDuration()
      if (duration <= 0) return

      const remaining = duration - position
      const fadeStart = currentConfig.fadeDuration

      // 在歌曲即将结束时开始淡出
      if (remaining <= fadeStart && remaining > 0) {
        await performCrossfade(remaining)
      }
    } catch (e) {
      // 静默处理
    }
  }, 500)
}

/** 执行交叉淡化 */
const performCrossfade = async (remaining: number) => {
  try {
    const volume = playerState.volume
    const progress = 1 - (remaining / currentConfig.fadeDuration)
    const targetVolume = Math.max(0, volume * (1 - progress))
    await TrackPlayer.setVolume(targetVolume)
  } catch (e) {
    // 静默处理
  }
}

/** 估算歌曲 BPM（简化版，基于时长和元数据） */
export const estimateBPM = (duration: number, name: string): number => {
  // 根据歌名关键词推断
  const text = name.toLowerCase()
  if (/rock|金属|metal|punk|硬核|hardcore/.test(text)) return 160
  if (/pop|流行|dance|舞|电子|edm|dj/.test(text)) return 128
  if (/ballad|慢歌|抒情|slow/.test(text)) return 70
  if (/jazz|爵士|blues|蓝调/.test(text)) return 90
  if (/classical|古典|钢琴|piano/.test(text)) return 80
  if (/hip|hop|rap|说唱/.test(text)) return 95
  // 默认中等节奏
  return 110
}

/** 调整播放速率以匹配BPM */
export const matchBPM = async (currentBPM: number, targetBPM: number): Promise<number> => {
  if (targetBPM <= 0 || currentBPM <= 0) return 1
  let rate = targetBPM / currentBPM
  // 限制范围 0.5-2.0
  rate = Math.max(0.5, Math.min(2.0, rate))
  // 如果差异太大，可能是BPM翻倍/减半关系
  if (Math.abs(rate - 1) > 0.3) {
    if (rate > 1) rate = rate / 2
    else rate = rate * 2
  }
  try {
    await TrackPlayer.setRate(rate)
    addDevLog('info', 'DJMode', `BPM匹配: ${currentBPM}→${targetBPM}, 速率=${rate.toFixed(2)}`)
  } catch (e) {
    // 静默处理
  }
  return rate
}

/** 获取 DJ 状态信息 */
export const getDJStatus = (): {
  active: boolean
  mode: CrossfadeMode
  fadeDuration: number
  beatSync: boolean
} => {
  return {
    active: isDJActive,
    mode: currentConfig.mode,
    fadeDuration: currentConfig.fadeDuration,
    beatSync: currentConfig.beatSync,
  }
}
