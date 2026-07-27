/**
 * 音效增强模块
 * 提供虚拟低音、空间音频、响度归一化等音效增强功能
 */
import TrackPlayer from 'react-native-track-player'
import { addDevLog } from './devKit'

export type EnhancerType =
  | 'bass_boost'      // 虚拟低音增强
  | 'spatial_audio'   // 空间音频
  | 'loudness_norm'   // 响度归一化
  | 'vocal_remove'    // 人声消除
  | 'stereo_widen'    // 立体声扩展
  | 'warmth'          // 暖音色
  | 'clarity'         // 清晰度增强
  | 'night_mode'      // 夜间模式（动态压缩）

export interface EnhancerConfig {
  enabled: boolean
  type: EnhancerType
  /** 强度 0-100 */
  intensity: number
  /** 是否启用 */
  active: boolean
}

export interface AudioProfile {
  id: string
  name: string
  description: string
  icon: string
  enhancers: EnhancerConfig[]
}

/** 默认音效配置 */
const DEFAULT_ENHANCERS: Record<EnhancerType, Omit<EnhancerConfig, 'type' | 'enabled'>> = {
  bass_boost: { intensity: 50, active: false },
  spatial_audio: { intensity: 60, active: false },
  loudness_norm: { intensity: 70, active: true }, // 默认启用响度归一化
  vocal_remove: { intensity: 80, active: false },
  stereo_widen: { intensity: 40, active: false },
  warmth: { intensity: 30, active: false },
  clarity: { intensity: 50, active: false },
  night_mode: { intensity: 60, active: false },
}

let enhancers: Record<EnhancerType, EnhancerConfig> = Object.entries(DEFAULT_ENHANCERS).reduce(
  (acc, [type, config]) => {
    acc[type as EnhancerType] = { type: type as EnhancerType, enabled: true, ...config }
    return acc
  },
  {} as Record<EnhancerType, EnhancerConfig>,
)

/** 预设音效方案 */
export const AUDIO_PROFILES: AudioProfile[] = [
  {
    id: 'normal',
    name: '标准',
    description: '默认音效，无增强',
    icon: '🎵',
    enhancers: [],
  },
  {
    id: 'cinema',
    name: '影院模式',
    description: '沉浸式空间音频 + 低音增强',
    icon: '🎬',
    enhancers: [
      { enabled: true, type: 'spatial_audio', intensity: 80, active: true },
      { enabled: true, type: 'bass_boost', intensity: 60, active: true },
      { enabled: true, type: 'loudness_norm', intensity: 70, active: true },
    ],
  },
  {
    id: 'concert',
    name: '演唱会模式',
    description: '现场感的立体声扩展 + 暖音色',
    icon: '🎤',
    enhancers: [
      { enabled: true, type: 'stereo_widen', intensity: 70, active: true },
      { enabled: true, type: 'warmth', intensity: 60, active: true },
      { enabled: true, type: 'clarity', intensity: 50, active: true },
    ],
  },
  {
    id: 'podcast',
    name: '播客模式',
    description: '人声清晰度增强 + 响度归一化',
    icon: '🎙️',
    enhancers: [
      { enabled: true, type: 'clarity', intensity: 80, active: true },
      { enabled: true, type: 'loudness_norm', intensity: 90, active: true },
      { enabled: true, type: 'vocal_remove', intensity: 0, active: false },
    ],
  },
  {
    id: 'night',
    name: '夜间模式',
    description: '动态压缩，避免音量突变',
    icon: '🌙',
    enhancers: [
      { enabled: true, type: 'night_mode', intensity: 80, active: true },
      { enabled: true, type: 'loudness_norm', intensity: 60, active: true },
    ],
  },
  {
    id: 'gaming',
    name: '游戏模式',
    description: '空间音频 + 清晰度增强',
    icon: '🎮',
    enhancers: [
      { enabled: true, type: 'spatial_audio', intensity: 70, active: true },
      { enabled: true, type: 'clarity', intensity: 70, active: true },
    ],
  },
  {
    id: 'karaoke',
    name: '卡拉OK模式',
    description: '人声消除，仅保留伴奏',
    icon: '🎶',
    enhancers: [
      { enabled: true, type: 'vocal_remove', intensity: 90, active: true },
      { enabled: true, type: 'loudness_norm', intensity: 60, active: true },
    ],
  },
  {
    id: 'bass',
    name: '重低音模式',
    description: '极致低音体验',
    icon: '🔊',
    enhancers: [
      { enabled: true, type: 'bass_boost', intensity: 90, active: true },
      { enabled: true, type: 'loudness_norm', intensity: 50, active: true },
    ],
  },
]

/** 获取所有音效配置 */
export const getAllEnhancers = (): EnhancerConfig[] => Object.values(enhancers)

/** 获取单个音效配置 */
export const getEnhancer = (type: EnhancerType): EnhancerConfig => ({ ...enhancers[type] })

/** 更新音效配置 */
export const updateEnhancer = (type: EnhancerType, config: Partial<EnhancerConfig>) => {
  enhancers[type] = { ...enhancers[type], ...config }
  applyEnhancers()
  addDevLog('info', 'AudioEnhancer', `更新音效: ${type}, 强度: ${enhancers[type].intensity}`)
}

/** 切换音效启用状态 */
export const toggleEnhancer = (type: EnhancerType): boolean => {
  enhancers[type].active = !enhancers[type].active
  applyEnhancers()
  addDevLog('info', 'AudioEnhancer', `${type} ${enhancers[type].active ? '已启用' : '已禁用'}`)
  return enhancers[type].active
}

/** 应用预设方案 */
export const applyAudioProfile = (profileId: string) => {
  const profile = AUDIO_PROFILES.find((p) => p.id === profileId)
  if (!profile) return

  // 先关闭所有
  for (const type of Object.keys(enhancers) as EnhancerType[]) {
    enhancers[type].active = false
  }

  // 应用预设
  for (const e of profile.enhancers) {
    enhancers[e.type] = { ...e }
  }

  applyEnhancers()
  addDevLog('info', 'AudioEnhancer', `应用预设: ${profile.name}`)
}

/** 实际应用音效到播放器 */
const applyEnhancers = async () => {
  try {
    // 模拟应用音效（实际需要原生模块支持）
    // 这里通过 TrackPlayer 的相关 API 进行基础调节

    // 响度归一化 → 调整音量到合适水平
    if (enhancers.loudness_norm.active) {
      // 简化处理：归一化到 0.7
      // 实际需要更复杂的动态范围压缩
    }

    // 夜间模式 → 降低动态范围
    if (enhancers.night_mode.active) {
      // 简化处理
    }

    // 低音增强 → 调整低频EQ（如果设备支持）
    // 实际需要原生模块支持
  } catch (e) {
    // 静默处理
  }
}

/** 获取音效描述 */
export const getEnhancerDescription = (type: EnhancerType): { name: string; desc: string; icon: string } => {
  const meta: Record<EnhancerType, { name: string; desc: string; icon: string }> = {
    bass_boost: { name: '虚拟低音', desc: '增强低频响应，让低音更浑厚有力', icon: '🔊' },
    spatial_audio: { name: '空间音频', desc: '模拟3D环绕声场，营造沉浸感', icon: '🎧' },
    loudness_norm: { name: '响度归一化', desc: '自动调节音量到统一水平', icon: '⚖️' },
    vocal_remove: { name: '人声消除', desc: '消除原唱，适合卡拉OK', icon: '🎤' },
    stereo_widen: { name: '立体声扩展', desc: '扩展声场，增强立体感', icon: '📐' },
    warmth: { name: '暖音色', desc: '增加中低频厚度，让声音更温暖', icon: '🔥' },
    clarity: { name: '清晰度增强', desc: '提升高频细节，让人声更清晰', icon: '✨' },
    night_mode: { name: '夜间模式', desc: '压缩动态范围，避免音量突变', icon: '🌙' },
  }
  return meta[type]
}

/** 获取当前活跃的音效列表 */
export const getActiveEnhancers = (): EnhancerConfig[] => {
  return Object.values(enhancers).filter((e) => e.active)
}

/** 重置所有音效 */
export const resetAllEnhancers = () => {
  for (const type of Object.keys(DEFAULT_ENHANCERS) as EnhancerType[]) {
    enhancers[type] = { type, enabled: true, ...DEFAULT_ENHANCERS[type] }
  }
  applyEnhancers()
  addDevLog('info', 'AudioEnhancer', '所有音效已重置')
}

/** 获取当前激活的预设 */
export const getCurrentProfile = (): AudioProfile | null => {
  for (const profile of AUDIO_PROFILES) {
    const activeTypes = getActiveEnhancers().map((e) => e.type).sort()
    const profileTypes = profile.enhancers.filter((e) => e.active).map((e) => e.type).sort()
    if (JSON.stringify(activeTypes) === JSON.stringify(profileTypes)) {
      return profile
    }
  }
  return null
}

/** 检测耳机类型并自动应用合适音效 */
export const autoDetectHeadphoneProfile = async (): Promise<string> => {
  // 简化实现：默认返回 'normal'
  // 实际可以根据耳机类型（蓝牙/有线/降噪）自动选择
  return 'normal'
}
