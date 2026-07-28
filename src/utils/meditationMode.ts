/**
 * 冥想模式
 * 提供冥想配乐、呼吸引导、专注计时
 */
import TrackPlayer from 'react-native-track-player'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

export type MeditationType =
  | 'breathing'    // 呼吸冥想
  | 'focus'        // 专注冥想
  | 'sleep'        // 睡眠冥想
  | 'relax'        // 放松冥想
  | 'mindfulness'  // 正念冥想
  | 'body_scan'    // 身体扫描

export type BreathingPattern =
  | '4_7_8'    // 吸气4秒-屏息7秒-呼气8秒（助眠）
  | 'box'      // 方形呼吸：4-4-4-4
  | '4_8'      // 吸气4秒-呼气8秒（放松）
  | 'coherent' // 5-5 心率协调
  | 'custom'

export interface MeditationSession {
  id: string
  type: MeditationType
  duration: number // 秒
  startedAt: number
  endedAt: number
  completed: boolean
  breathingPattern?: BreathingPattern
  notes?: string
  moodBefore?: string
  moodAfter?: string
}

export interface MeditationConfig {
  enabled: boolean
  type: MeditationType
  duration: number // 分钟
  breathingPattern: BreathingPattern
  customBreathing: { inhale: number; hold: number; exhale: number; hold2: number }
  backgroundMusic: boolean
  musicVolume: number
  voiceGuidance: boolean
  bellSound: boolean
}

const SESSIONS_KEY = '@meditation_sessions_v1'
const STATS_KEY = '@meditation_stats_v1'

const DEFAULT_CONFIG: MeditationConfig = {
  enabled: false,
  type: 'breathing',
  duration: 10,
  breathingPattern: '4_7_8',
  customBreathing: { inhale: 4, hold: 7, exhale: 8, hold2: 0 },
  backgroundMusic: true,
  musicVolume: 0.3,
  voiceGuidance: true,
  bellSound: true,
}

let currentConfig: MeditationConfig = { ...DEFAULT_CONFIG }
let activeSession: MeditationSession | null = null
let sessionTimer: any = null

export const getMeditationConfig = (): MeditationConfig => ({ ...currentConfig })

export const updateMeditationConfig = (config: Partial<MeditationConfig>) => {
  currentConfig = { ...currentConfig, ...config }
}

/** 开始冥想会话 */
export const startSession = async (
  moodBefore?: string,
): Promise<MeditationSession> => {
  const session: MeditationSession = {
    id: `med_${Date.now()}`,
    type: currentConfig.type,
    duration: currentConfig.duration * 60,
    startedAt: Date.now(),
    endedAt: 0,
    completed: false,
    breathingPattern: currentConfig.type === 'breathing' ? currentConfig.breathingPattern : undefined,
    moodBefore,
  }

  activeSession = session

  // 降低音乐音量
  if (currentConfig.backgroundMusic) {
    try {
      await TrackPlayer.setVolume(currentConfig.musicVolume)
    } catch {
      // 静默处理
    }
  }

  // 设置定时器
  sessionTimer = setTimeout(async () => {
    await endSession(true, moodBefore)
  }, session.duration * 1000)

  addDevLog('info', 'Meditation', `开始冥想: ${currentConfig.type}, ${currentConfig.duration}分钟`)
  return session
}

/** 结束冥想会话 */
export const endSession = async (
  completed: boolean,
  moodAfter?: string,
): Promise<MeditationSession | null> => {
  if (!activeSession) return null

  if (sessionTimer) {
    clearTimeout(sessionTimer)
    sessionTimer = null
  }

  activeSession.endedAt = Date.now()
  activeSession.completed = completed
  activeSession.moodAfter = moodAfter

  // 恢复音量
  try {
    await TrackPlayer.setVolume(1)
  } catch {
    // 静默处理
  }

  // 保存会话
  const sessions = await getAllSessions()
  sessions.unshift(activeSession)
  await saveData(SESSIONS_KEY, sessions.slice(0, 1000))

  // 更新统计
  await updateStats(activeSession)

  const result = activeSession
  activeSession = null
  addDevLog('info', 'Meditation', `结束冥想: ${completed ? '完成' : '中断'}`)
  return result
}

/** 获取当前会话 */
export const getActiveSession = (): MeditationSession | null => activeSession

/** 获取所有会话 */
export const getAllSessions = async (): Promise<MeditationSession[]> => {
  const data = await getData<MeditationSession[]>(SESSIONS_KEY)
  return data || []
}

/** 获取呼吸模式描述 */
export const getBreathingPatternInfo = (pattern: BreathingPattern): {
  name: string
  description: string
  phases: Array<{ name: string; seconds: number }>
  totalSeconds: number
} => {
  const patterns: Record<BreathingPattern, {
    name: string
    description: string
    phases: Array<{ name: string; seconds: number }>
  }> = {
    '4_7_8': {
      name: '4-7-8 助眠呼吸法',
      description: '吸气4秒，屏息7秒，呼气8秒。有助于快速入睡和减轻焦虑',
      phases: [
        { name: '吸气', seconds: 4 },
        { name: '屏息', seconds: 7 },
        { name: '呼气', seconds: 8 },
      ],
    },
    'box': {
      name: '方形呼吸法',
      description: '吸气4秒，屏息4秒，呼气4秒，屏息4秒。增强专注力和稳定性',
      phases: [
        { name: '吸气', seconds: 4 },
        { name: '屏息', seconds: 4 },
        { name: '呼气', seconds: 4 },
        { name: '屏息', seconds: 4 },
      ],
    },
    '4_8': {
      name: '4-8 放松呼吸',
      description: '吸气4秒，呼气8秒。快速放松身心',
      phases: [
        { name: '吸气', seconds: 4 },
        { name: '呼气', seconds: 8 },
      ],
    },
    'coherent': {
      name: '5-5 协调呼吸',
      description: '吸气5秒，呼气5秒。平衡心率变异性',
      phases: [
        { name: '吸气', seconds: 5 },
        { name: '呼气', seconds: 5 },
      ],
    },
    'custom': {
      name: '自定义呼吸',
      description: '根据个人需求自定义呼吸节奏',
      phases: [
        { name: '吸气', seconds: currentConfig.customBreathing.inhale },
        { name: '屏息', seconds: currentConfig.customBreathing.hold },
        { name: '呼气', seconds: currentConfig.customBreathing.exhale },
        { name: '屏息', seconds: currentConfig.customBreathing.hold2 },
      ].filter((p) => p.seconds > 0),
    },
  }

  const info = patterns[pattern]
  return {
    ...info,
    totalSeconds: info.phases.reduce((sum, p) => sum + p.seconds, 0),
  }
}

/** 获取冥想类型描述 */
export const getMeditationTypeInfo = (type: MeditationType): { name: string; description: string; icon: string } => {
  const types: Record<MeditationType, { name: string; description: string; icon: string }> = {
    breathing: { name: '呼吸冥想', description: '专注于呼吸节奏，平静心灵', icon: '🌬️' },
    focus: { name: '专注冥想', description: '提升注意力和集中力', icon: '🎯' },
    sleep: { name: '睡眠冥想', description: '帮助入睡，提升睡眠质量', icon: '😴' },
    relax: { name: '放松冥想', description: '释放压力，放松身心', icon: '🌿' },
    mindfulness: { name: '正念冥想', description: '觉察当下，培养正念', icon: '🧘' },
    body_scan: { name: '身体扫描', description: '逐部位放松身体', icon: '💆' },
  }
  return types[type]
}

/** 更新统计 */
const updateStats = async (session: MeditationSession) => {
  const stats = await getStats()
  stats.totalSessions++
  stats.totalMinutes += session.duration / 60
  stats.completedSessions += session.completed ? 1 : 0
  stats.lastSessionAt = session.startedAt

  if (!stats.typeStats[session.type]) stats.typeStats[session.type] = 0
  stats.typeStats[session.type]++

  // 连续天数
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  if (stats.lastSessionDate === today) {
    // 同一天，不增加
  } else if (stats.lastSessionDate === yesterday) {
    stats.currentStreak++
  } else {
    stats.currentStreak = 1
  }
  stats.lastSessionDate = today
  stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak)

  await saveData(STATS_KEY, stats)
}

/** 获取统计 */
export const getStats = async (): Promise<{
  totalSessions: number
  totalMinutes: number
  completedSessions: number
  currentStreak: number
  longestStreak: number
  lastSessionAt: number
  lastSessionDate: string
  typeStats: Record<MeditationType, number>
}> => {
  const data = await getData<any>(STATS_KEY)
  return data || {
    totalSessions: 0,
    totalMinutes: 0,
    completedSessions: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastSessionAt: 0,
    lastSessionDate: '',
    typeStats: {
      breathing: 0,
      focus: 0,
      sleep: 0,
      relax: 0,
      mindfulness: 0,
      body_scan: 0,
    },
  }
}

/** 推荐冥想方案 */
export const recommendMeditation = (hour: number, stress: 'low' | 'medium' | 'high'): {
  type: MeditationType
  duration: number
  pattern: BreathingPattern
  reason: string
} => {
  if (hour >= 22 || hour < 6) {
    return { type: 'sleep', duration: 15, pattern: '4_7_8', reason: '深夜推荐睡眠冥想，使用4-7-8呼吸法助眠' }
  }
  if (hour >= 6 && hour < 10) {
    return { type: 'focus', duration: 10, pattern: 'box', reason: '早晨推荐专注冥想，使用方形呼吸法提升专注力' }
  }
  if (stress === 'high') {
    return { type: 'relax', duration: 20, pattern: '4_8', reason: '压力较高，推荐放松冥想和4-8呼吸法' }
  }
  if (hour >= 12 && hour < 14) {
    return { type: 'mindfulness', duration: 15, pattern: 'coherent', reason: '午休时间推荐正念冥想' }
  }
  return { type: 'breathing', duration: 10, pattern: 'coherent', reason: '推荐基础呼吸冥想，使用协调呼吸法' }
}
