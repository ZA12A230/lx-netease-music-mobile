/**
 * 音频均衡器工具
 * 支持预设音效和自定义EQ
 */
import TrackPlayer from 'react-native-track-player'

export interface EQBand {
  /** 频率 (Hz) */
  frequency: number
  /** 增益 (dB), -12 到 +12 */
  gain: number
}

export interface EQPreset {
  name: string
  label: string
  bands: EQBand[]
}

/** 预设均衡器 */
export const EQ_PRESETS: EQPreset[] = [
  {
    name: 'flat',
    label: '平坦',
    bands: [
      { frequency: 32, gain: 0 },
      { frequency: 64, gain: 0 },
      { frequency: 125, gain: 0 },
      { frequency: 250, gain: 0 },
      { frequency: 500, gain: 0 },
      { frequency: 1000, gain: 0 },
      { frequency: 2000, gain: 0 },
      { frequency: 4000, gain: 0 },
      { frequency: 8000, gain: 0 },
      { frequency: 16000, gain: 0 },
    ],
  },
  {
    name: 'pop',
    label: '流行',
    bands: [
      { frequency: 32, gain: -1 },
      { frequency: 64, gain: 1 },
      { frequency: 125, gain: 2 },
      { frequency: 250, gain: 1 },
      { frequency: 500, gain: -1 },
      { frequency: 1000, gain: -1 },
      { frequency: 2000, gain: 0 },
      { frequency: 4000, gain: 2 },
      { frequency: 8000, gain: 3 },
      { frequency: 16000, gain: 3 },
    ],
  },
  {
    name: 'rock',
    label: '摇滚',
    bands: [
      { frequency: 32, gain: 4 },
      { frequency: 64, gain: 3 },
      { frequency: 125, gain: 1 },
      { frequency: 250, gain: -1 },
      { frequency: 500, gain: -2 },
      { frequency: 1000, gain: 1 },
      { frequency: 2000, gain: 3 },
      { frequency: 4000, gain: 5 },
      { frequency: 8000, gain: 5 },
      { frequency: 16000, gain: 4 },
    ],
  },
  {
    name: 'classical',
    label: '古典',
    bands: [
      { frequency: 32, gain: 3 },
      { frequency: 64, gain: 3 },
      { frequency: 125, gain: 2 },
      { frequency: 250, gain: 1 },
      { frequency: 500, gain: -1 },
      { frequency: 1000, gain: -1 },
      { frequency: 2000, gain: 0 },
      { frequency: 4000, gain: 2 },
      { frequency: 8000, gain: 3 },
      { frequency: 16000, gain: 4 },
    ],
  },
  {
    name: 'jazz',
    label: '爵士',
    bands: [
      { frequency: 32, gain: 2 },
      { frequency: 64, gain: 2 },
      { frequency: 125, gain: 1 },
      { frequency: 250, gain: 0 },
      { frequency: 500, gain: 1 },
      { frequency: 1000, gain: -1 },
      { frequency: 2000, gain: -1 },
      { frequency: 4000, gain: 1 },
      { frequency: 8000, gain: 2 },
      { frequency: 16000, gain: 3 },
    ],
  },
  {
    name: 'bass',
    label: '重低音',
    bands: [
      { frequency: 32, gain: 6 },
      { frequency: 64, gain: 5 },
      { frequency: 125, gain: 4 },
      { frequency: 250, gain: 2 },
      { frequency: 500, gain: 0 },
      { frequency: 1000, gain: 0 },
      { frequency: 2000, gain: 0 },
      { frequency: 4000, gain: 0 },
      { frequency: 8000, gain: 0 },
      { frequency: 16000, gain: 0 },
    ],
  },
  {
    name: 'treble',
    label: '高音增强',
    bands: [
      { frequency: 32, gain: 0 },
      { frequency: 64, gain: 0 },
      { frequency: 125, gain: 0 },
      { frequency: 250, gain: 0 },
      { frequency: 500, gain: 0 },
      { frequency: 1000, gain: 1 },
      { frequency: 2000, gain: 2 },
      { frequency: 4000, gain: 3 },
      { frequency: 8000, gain: 5 },
      { frequency: 16000, gain: 6 },
    ],
  },
  {
    name: 'vocal',
    label: '人声增强',
    bands: [
      { frequency: 32, gain: -2 },
      { frequency: 64, gain: -2 },
      { frequency: 125, gain: -1 },
      { frequency: 250, gain: 1 },
      { frequency: 500, gain: 3 },
      { frequency: 1000, gain: 3 },
      { frequency: 2000, gain: 2 },
      { frequency: 4000, gain: 1 },
      { frequency: 8000, gain: 0 },
      { frequency: 16000, gain: -1 },
    ],
  },
]

/** 当前均衡器设置 */
let currentEQ: EQBand[] = EQ_PRESETS[0].bands
let currentPreset = 'flat'

/** 应用均衡器 */
export const applyEQ = async (bands: EQBand[]) => {
  currentEQ = bands
  try {
    // 尝试使用 TrackPlayer 的均衡器
    // @ts-ignore
    if (TrackPlayer.setEqualizer) {
      // @ts-ignore
      await TrackPlayer.setEqualizer(bands)
    }
  } catch (e) {
    console.warn('均衡器设置失败，可能设备不支持:', e)
  }
}

/** 应用预设 */
export const applyPreset = (presetName: string) => {
  const preset = EQ_PRESETS.find(p => p.name === presetName)
  if (preset) {
    currentPreset = presetName
    applyEQ(preset.bands)
  }
}

/** 获取当前均衡器 */
export const getCurrentEQ = () => currentEQ
export const getCurrentPreset = () => currentPreset

/** 重置均衡器 */
export const resetEQ = () => {
  applyPreset('flat')
}

/** 更新单个频段 */
export const updateBand = (index: number, gain: number) => {
  if (index >= 0 && index < currentEQ.length) {
    currentEQ[index] = { ...currentEQ[index], gain: Math.max(-12, Math.min(12, gain)) }
    applyEQ([...currentEQ])
  }
}