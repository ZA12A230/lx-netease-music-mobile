/**
 * 频谱可视化模块
 * 提供音频频谱分析数据（用于UI可视化）
 */
import TrackPlayer from 'react-native-track-player'
import { addDevLog } from './devKit'
import playerState from '@/store/player/state'

export interface SpectrumData {
  /** 低频强度（0-100） */
  bass: number
  /** 中频强度（0-100） */
  mid: number
  /** 高频强度（0-100） */
  treble: number
  /** 32个频段强度数组（0-100） */
  bands: number[]
  /** 总体音量（0-100） */
  volume: number
  /** 节拍强度（0-100） */
  beat: number
}

export type VisualizerStyle = 'bars' | 'wave' | 'circular' | 'particles'

export interface VisualizerConfig {
  style: VisualizerStyle
  /** 频段数量 */
  bandCount: number
  /** 灵敏度（0.5-3.0） */
  sensitivity: number
  /** 平滑度（0-1） */
  smoothing: number
  /** 主色调 */
  color: string
}

const DEFAULT_CONFIG: VisualizerConfig = {
  style: 'bars',
  bandCount: 32,
  sensitivity: 1.5,
  smoothing: 0.7,
  color: '#07C556',
}

let currentConfig: VisualizerConfig = { ...DEFAULT_CONFIG }
let isMonitoring = false
let monitorInterval: ReturnType<typeof setInterval> | null = null
let lastData: SpectrumData = {
  bass: 0, mid: 0, treble: 0,
  bands: new Array(32).fill(0),
  volume: 0, beat: 0,
}
let subscribers: Array<(data: SpectrumData) => void> = []
let beatHistory: number[] = []

export const getVisualizerConfig = (): VisualizerConfig => ({ ...currentConfig })

export const updateVisualizerConfig = (config: Partial<VisualizerConfig>) => {
  currentConfig = { ...currentConfig, ...config }
}

/** 启动频谱监测 */
export const startVisualizer = () => {
  if (isMonitoring) return
  isMonitoring = true
  addDevLog('info', 'Spectrum', '频谱可视化已启动')

  monitorInterval = setInterval(async () => {
    if (!isMonitoring) return
    try {
      const position = await TrackPlayer.getPosition()
      const duration = await TrackPlayer.getDuration()
      const volume = playerVolumeState()

      // 由于 RN 没有原生频谱分析 API，使用伪频谱数据
      // 基于时间和音量生成模拟频谱
      const newData = generateMockSpectrum(position, duration, volume)
      lastData = newData

      // 节拍检测
      detectBeat(newData)

      // 通知订阅者
      subscribers.forEach((cb) => cb(newData))
    } catch (e) {
      // 静默处理
    }
  }, 50) // 20 FPS
}

/** 停止频谱监测 */
export const stopVisualizer = () => {
  isMonitoring = false
  if (monitorInterval) {
    clearInterval(monitorInterval)
    monitorInterval = null
  }
  subscribers = []
  addDevLog('info', 'Spectrum', '频谱可视化已停止')
}

/** 获取当前播放音量 */
const playerVolumeState = (): number => {
  try {
    return playerState.volume || 0.5
  } catch {
    return 0.5
  }
}

/** 生成模拟频谱数据 */
const generateMockSpectrum = (
  position: number,
  duration: number,
  volume: number
): SpectrumData => {
  const t = position
  const bands: number[] = []
  const bandCount = currentConfig.bandCount

  // 基于时间和频率生成伪频谱
  for (let i = 0; i < bandCount; i++) {
    const freq = (i + 1) / bandCount
    // 低频幅度大，高频幅度小（模拟真实音频）
    const amplitude = Math.pow(1 - freq, 0.5)
    // 加入多个正弦波叠加，模拟音乐波动
    const wave1 = Math.sin(t * 2 * Math.PI * (1 + freq * 5)) * 0.3
    const wave2 = Math.sin(t * 2 * Math.PI * (2 + freq * 3)) * 0.2
    const wave3 = Math.sin(t * 2 * Math.PI * (0.5 + freq * 8)) * 0.15
    const noise = (Math.random() - 0.5) * 0.1

    let value = amplitude * (0.5 + wave1 + wave2 + wave3 + noise) * volume * currentConfig.sensitivity
    value = Math.max(0, Math.min(100, value * 100))

    // 平滑处理
    const prevValue = lastData.bands[i] || 0
    const smoothing = currentConfig.smoothing
    value = prevValue * smoothing + value * (1 - smoothing)

    bands.push(value)
  }

  // 计算低/中/高频平均
  const third = Math.floor(bandCount / 3)
  const bass = avg(bands.slice(0, third))
  const mid = avg(bands.slice(third, third * 2))
  const treble = avg(bands.slice(third * 2))

  return {
    bass,
    mid,
    treble,
    bands,
    volume: volume * 100,
    beat: 0, // 在 detectBeat 中更新
  }
}

const avg = (arr: number[]): number => {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/** 简单节拍检测 */
const detectBeat = (data: SpectrumData) => {
  beatHistory.push(data.bass)
  if (beatHistory.length > 20) beatHistory.shift()

  const avgBass = avg(beatHistory)
  const variance = avg(beatHistory.map((b) => Math.pow(b - avgBass, 2)))
  const threshold = avgBass + Math.sqrt(variance) * 1.5

  if (data.bass > threshold && data.bass > 50) {
    data.beat = Math.min(100, (data.bass - threshold) * 2)
  } else {
    data.beat = Math.max(0, lastData.beat * 0.8)
  }
}

/** 订阅频谱数据更新 */
export const subscribeSpectrum = (cb: (data: SpectrumData) => void): (() => void) => {
  subscribers.push(cb)
  cb(lastData)
  return () => {
    subscribers = subscribers.filter((fn) => fn !== cb)
  }
}

/** 获取最近一次频谱数据 */
export const getLastSpectrum = (): SpectrumData => ({ ...lastData })

/** 是否正在监测 */
export const isVisualizerActive = (): boolean => isMonitoring
