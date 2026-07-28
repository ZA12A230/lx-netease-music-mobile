/**
 * 黑胶唱片模式
 * 复古黑胶播放界面，带黑胶噪声和唱针动画
 *
 * 功能特点：
 * - 模拟黑胶唱片旋转动画
 * - 唱针自动落下/抬起
 * - 黑胶底噪（白噪+爆豆声）
 * - 33/45 RPM 转速切换
 * - 唱片刮擦音效
 */
import { getData, setData } from '@/utils/data'
import { addDevLog } from '@/utils/devKit'

const VINYL_CONFIG_KEY = 'vinyl_mode_config'

export type VinylSpeed = 33 | 45    // 33 RPM 或 45 RPM

export interface VinylConfig {
  speed: VinylSpeed              // 转速
  noiseLevel: number             // 噪声强度（0-1）
  scratchEnabled: boolean        // 是否启用刮擦音效
  needleDrop: boolean            // 是否启用唱针落下音效
  wear: number                   // 唱片磨损度（0-1，影响噪声）
  /** 是否启用黑胶底噪 */
  backgroundNoise: boolean
}

const DEFAULT_CONFIG: VinylConfig = {
  speed: 33,
  noiseLevel: 0.3,
  scratchEnabled: true,
  needleDrop: true,
  wear: 0.2,
  backgroundNoise: true,
}

/** 获取黑胶模式配置 */
export const getVinylConfig = async (): Promise<VinylConfig> => {
  return (await getData<VinylConfig>(VINYL_CONFIG_KEY)) ?? DEFAULT_CONFIG
}

/** 更新黑胶模式配置 */
export const updateVinylConfig = async (updates: Partial<VinylConfig>): Promise<VinylConfig> => {
  const current = await getVinylConfig()
  const newConfig = { ...current, ...updates }
  await setData(VINYL_CONFIG_KEY, newConfig)
  return newConfig
}

/** 重置为默认配置 */
export const resetVinylConfig = async (): Promise<VinylConfig> => {
  await setData(VINYL_CONFIG_KEY, DEFAULT_CONFIG)
  return DEFAULT_CONFIG
}

/**
 * 根据转速计算旋转角度
 * - 33 RPM = 33 转/分钟 = 198 度/秒
 * - 45 RPM = 45 转/分钟 = 270 度/秒
 */
export const getRotationPerSecond = (speed: VinylSpeed): number => {
  return speed === 33 ? 198 : 270
}

/**
 * 生成模拟黑胶噪声音频参数
 * - 实际播放时叠加到底层音频
 * - 这里返回噪声参数，由播放器层处理实际音频生成
 */
export const generateVinylNoiseParams = (config: VinylConfig) => {
  return {
    /** 白噪强度（背景沙沙声） */
    whiteNoise: config.backgroundNoise ? config.noiseLevel * 0.15 * (1 + config.wear * 0.5) : 0,
    /** 爆豆声频率（次/分钟） */
    crackleRate: config.backgroundNoise ? Math.floor(config.noiseLevel * 30 * (1 + config.wear * 2)) : 0,
    /** 爆豆声强度 */
    crackleIntensity: config.noiseLevel * 0.3,
    /** 低频隆隆声（唱机电机声） */
    rumble: config.backgroundNoise ? config.noiseLevel * 0.1 : 0,
    /** 刮擦音效（仅在切歌时触发） */
    scratchEnabled: config.scratchEnabled,
    /** 唱针落下音效（仅在开始播放时触发） */
    needleDrop: config.needleDrop,
  }
}

/**
 * 黑胶播放时长校准
 * 由于转速不同，相同歌曲在不同转速下播放时长不同
 * - 33 RPM 是标准转速（原速）
 * - 45 RPM 速度更快（提升约 36.36%）
 */
export const calculatePlaybackDuration = (originalDuration: number, speed: VinylSpeed): number => {
  if (speed === 33) return originalDuration
  // 45 RPM 比 33 RPM 快 45/33 = 1.3636 倍
  return Math.floor(originalDuration * (33 / 45))
}

/** 唱片刮擦音效触发（切歌时） */
export const triggerScratch = (config: VinylConfig) => {
  if (!config.scratchEnabled) return null
  addDevLog('info', 'VinylMode', '触发刮擦音效')
  return {
    type: 'scratch' as const,
    duration: 800,       // 800ms
    intensity: config.noiseLevel * 0.5,
  }
}

/** 唱针落下音效触发（开始播放时） */
export const triggerNeedleDrop = (config: VinylConfig) => {
  if (!config.needleDrop) return null
  addDevLog('info', 'VinylMode', '触发唱针落下音效')
  return {
    type: 'needle_drop' as const,
    duration: 1500,      // 1.5秒
    intensity: config.noiseLevel * 0.4,
  }
}

/**
 * 唱片状态机
 * 管理 唱针落下→旋转→刮擦→唱针抬起 的完整流程
 */
export type VinylState =
  | 'idle'              // 待机
  | 'needle_dropping'   // 唱针落下中
  | 'playing'           // 播放中
  | 'scratching'        // 刮擦中（切歌）
  | 'needle_lifting'    // 唱针抬起中
  | 'paused'            // 暂停

export interface VinylStateMachine {
  state: VinylState
  /** 进入下一个状态 */
  transition: (event: 'play' | 'pause' | 'stop' | 'next' | 'drop_complete' | 'lift_complete' | 'scratch_complete') => VinylState
}

export const createVinylStateMachine = (): VinylStateMachine => {
  let state: VinylState = 'idle'

  const transition = (event: 'play' | 'pause' | 'stop' | 'next' | 'drop_complete' | 'lift_complete' | 'scratch_complete'): VinylState => {
    switch (event) {
      case 'play':
        if (state === 'idle' || state === 'paused') state = 'needle_dropping'
        break
      case 'drop_complete':
        if (state === 'needle_dropping') state = 'playing'
        break
      case 'pause':
        if (state === 'playing') state = 'needle_lifting'
        break
      case 'next':
        if (state === 'playing') state = 'scratching'
        break
      case 'scratch_complete':
        if (state === 'scratching') state = 'needle_dropping'
        break
      case 'stop':
        state = 'needle_lifting'
        break
      case 'lift_complete':
        state = 'idle'
        break
    }
    return state
  }

  return {
    get state() { return state },
    transition,
  }
}

/**
 * 模拟唱片视觉参数
 * 用于UI层渲染唱片的视觉样式
 */
export const getVinylVisualParams = (config: VinylConfig, progress: number) => {
  return {
    /** 唱片旋转角度（度） */
    rotation: progress * getRotationPerSecond(config.speed) * 360,
    /** 唱片半径（占容器宽度的比例） */
    radius: 0.45,
    /** 中心标签半径 */
    labelRadius: 0.15,
    /** 唱片纹路条数 */
    grooveCount: Math.floor(60 + config.wear * 40),
    /** 唱片颜色（深黑色） */
    vinylColor: '#0A0A0A',
    /** 标签颜色（中心圆） */
    labelColor: '#C62828',
    /** 唱针角度（度） */
    needleAngle: 30 + progress * 30,    // 从30度到60度
    /** 是否显示磨损效果 */
    showWear: config.wear > 0.3,
  }
}
