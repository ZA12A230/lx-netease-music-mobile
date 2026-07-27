/**
 * 歌曲交叉淡化模块
 * 实现歌曲切换时的平滑过渡
 */
import TrackPlayer from 'react-native-track-player'
import playerState from '@/store/player/state'
import { addDevLog } from './devKit'

export interface CrossfadeConfig {
  /** 淡化持续时间（秒） */
  duration: number
  /** 曲目类型 */
  curve: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  /** 是否启用 */
  enabled: boolean
}

const DEFAULT_CONFIG: CrossfadeConfig = {
  duration: 5,
  curve: 'easeInOut',
  enabled: false,
}

let currentConfig: CrossfadeConfig = { ...DEFAULT_CONFIG }
let monitorInterval: ReturnType<typeof setInterval> | null = null
let isFading = false

/** 启用交叉淡化 */
export const enableCrossfade = (config?: Partial<CrossfadeConfig>) => {
  if (config) currentConfig = { ...currentConfig, ...config }
  currentConfig.enabled = true
  startMonitor()
  addDevLog('info', 'Crossfade', `交叉淡化已启用: ${currentConfig.duration}s`)
}

/** 禁用交叉淡化 */
export const disableCrossfade = () => {
  currentConfig.enabled = false
  if (monitorInterval) {
    clearInterval(monitorInterval)
    monitorInterval = null
  }
  isFading = false
  addDevLog('info', 'Crossfade', '交叉淡化已禁用')
}

export const getCrossfadeConfig = (): CrossfadeConfig => ({ ...currentConfig })

export const updateCrossfadeConfig = (config: Partial<CrossfadeConfig>) => {
  currentConfig = { ...currentConfig, ...config }
}

/** 计算淡化的音量曲线值 */
const calculateFadeValue = (progress: number, curve: CrossfadeConfig['curve']): number => {
  // progress: 0 → 1
  switch (curve) {
    case 'linear':
      return progress
    case 'easeIn':
      return progress * progress
    case 'easeOut':
      return 1 - (1 - progress) * (1 - progress)
    case 'easeInOut':
    default:
      return progress < 0.5
        ? 2 * progress * progress
        : 1 - 2 * (1 - progress) * (1 - progress)
  }
}

/** 开始淡化 */
const startFade = async (remainingSeconds: number) => {
  if (isFading) return
  isFading = true

  const originalVolume = playerState.volume
  const fadeDurationMs = currentConfig.duration * 1000
  const steps = 50
  const stepInterval = fadeDurationMs / steps

  for (let i = 0; i < steps; i++) {
    if (!isFading) break
    const progress = (i + 1) / steps
    // 当前歌曲音量从 originalVolume → 0
    const fadeValue = calculateFadeValue(1 - progress, currentConfig.curve)
    const targetVolume = Math.max(0, originalVolume * fadeValue)
    try {
      await TrackPlayer.setVolume(targetVolume)
    } catch (e) {
      // 静默处理
    }
    await new Promise((resolve) => setTimeout(resolve, stepInterval))
  }

  // 淡化结束后恢复音量
  try {
    await TrackPlayer.setVolume(originalVolume)
  } catch (e) {
    // 静默处理
  }
  isFading = false
}

/** 启动进度监控 */
const startMonitor = () => {
  if (monitorInterval) clearInterval(monitorInterval)

  monitorInterval = setInterval(async () => {
    if (!currentConfig.enabled || isFading) return
    try {
      const position = await TrackPlayer.getPosition()
      const duration = await TrackPlayer.getDuration()
      if (duration <= 0) return

      const remaining = duration - position
      if (remaining <= currentConfig.duration && remaining > 0.5) {
        await startFade(remaining)
      }
    } catch (e) {
      // 静默处理
    }
  }, 500)
}

/** 立即执行一次淡化（用于手动切换） */
export const performManualFade = async () => {
  if (isFading) return
  await startFade(currentConfig.duration)
}

/** 获取当前状态 */
export const getCrossfadeStatus = () => ({
  enabled: currentConfig.enabled,
  isFading,
  duration: currentConfig.duration,
  curve: currentConfig.curve,
})
