/**
 * BPM跑步模式
 * 根据步频匹配BPM，提供跑步配速音乐
 */
import TrackPlayer from 'react-native-track-player'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'
type MusicInfo = LX.Music.MusicInfo

export type RunningGoal =
  | 'warmup'      // 热身
  | 'jog'         // 慢跑
  | 'run'         // 快跑
  | 'sprint'      // 冲刺
  | 'cooldown'    // 放松
  | 'marathon'    // 马拉松

export interface RunningSession {
  id: string
  goal: RunningGoal
  startedAt: number
  endedAt: number
  duration: number // 秒
  stepsEstimated: number
  distanceEstimated: number // 米
  caloriesEstimated: number
  averageBPM: number
  songsPlayed: number
  completed: boolean
}

export interface RunningConfig {
  enabled: boolean
  goal: RunningGoal
  /** 目标步频 (步/分钟) */
  targetCadence: number
  /** 自动调整BPM匹配 */
  autoAdjustTempo: boolean
  /** BPM容差范围 */
  bpmTolerance: number
  /** 用户身高（用于步距估算） */
  userHeight: number // cm
  /** 用户体重（用于卡路里估算） */
  userWeight: number // kg
}

const SESSIONS_KEY = '@running_sessions_v1'

const GOAL_CONFIG: Record<RunningGoal, { cadence: number; bpmRange: [number, number]; name: string; icon: string }> = {
  warmup: { cadence: 100, bpmRange: [90, 110], name: '热身', icon: '🔥' },
  jog: { cadence: 140, bpmRange: [120, 140], name: '慢跑', icon: '🏃' },
  run: { cadence: 160, bpmRange: [140, 160], name: '快跑', icon: '💨' },
  sprint: { cadence: 180, bpmRange: [160, 200], name: '冲刺', icon: '⚡' },
  cooldown: { cadence: 110, bpmRange: [80, 100], name: '放松', icon: '🌿' },
  marathon: { cadence: 150, bpmRange: [130, 160], name: '马拉松', icon: '🏁' },
}

const DEFAULT_CONFIG: RunningConfig = {
  enabled: false,
  goal: 'jog',
  targetCadence: 140,
  autoAdjustTempo: true,
  bpmTolerance: 10,
  userHeight: 170,
  userWeight: 65,
}

let currentConfig: RunningConfig = { ...DEFAULT_CONFIG }
let activeSession: RunningSession | null = null

export const getRunningConfig = (): RunningConfig => ({ ...currentConfig })
export const updateRunningConfig = (config: Partial<RunningConfig>) => {
  currentConfig = { ...currentConfig, ...config }
}

export const getGoalInfo = (goal: RunningGoal) => GOAL_CONFIG[goal]

/** 开始跑步会话 */
export const startRunning = async (): Promise<RunningSession> => {
  const session: RunningSession = {
    id: `run_${Date.now()}`,
    goal: currentConfig.goal,
    startedAt: Date.now(),
    endedAt: 0,
    duration: 0,
    stepsEstimated: 0,
    distanceEstimated: 0,
    caloriesEstimated: 0,
    averageBPM: 0,
    songsPlayed: 0,
    completed: false,
  }
  activeSession = session
  addDevLog('info', 'RunningMode', `开始跑步: ${GOAL_CONFIG[currentConfig.goal].name}`)
  return session
}

/** 结束跑步会话 */
export const endRunning = async (songsPlayed: number): Promise<RunningSession | null> => {
  if (!activeSession) return null

  activeSession.endedAt = Date.now()
  activeSession.duration = (activeSession.endedAt - activeSession.startedAt) / 1000
  activeSession.completed = true
  activeSession.songsPlayed = songsPlayed

  // 估算步数、距离、卡路里
  const cadence = GOAL_CONFIG[activeSession.goal].cadence
  activeSession.stepsEstimated = Math.floor((activeSession.duration / 60) * cadence)
  const strideLength = currentConfig.userHeight * 0.4 / 100 // 步距=身高*0.4
  activeSession.distanceEstimated = activeSession.stepsEstimated * strideLength
  // 卡路里 = 体重 × 距离(km) × 系数
  activeSession.caloriesEstimated = Math.floor(currentConfig.userWeight * (activeSession.distanceEstimated / 1000) * 1.036)
  activeSession.averageBPM = GOAL_CONFIG[activeSession.goal].bpmRange[0]

  const sessions = await getAllSessions()
  sessions.unshift(activeSession)
  await saveData(SESSIONS_KEY, sessions.slice(0, 1000))

  const result = activeSession
  const durationMin = Math.floor((result.duration || 0) / 60)
  activeSession = null
  addDevLog('info', 'RunningMode', `结束跑步: ${durationMin}分钟`)
  return result
}

/** 根据BPM筛选适合的歌曲 */
export const filterSongsByBPM = (
  songs: MusicInfo[],
  goal: RunningGoal,
): Array<{ song: MusicInfo; bpm: number; match: number }> => {
  const config = GOAL_CONFIG[goal]
  const [minBPM, maxBPM] = config.bpmRange
  const targetBPM = (minBPM + maxBPM) / 2

  const results: Array<{ song: MusicInfo; bpm: number; match: number }> = []

  for (const song of songs) {
    const bpm = estimateBPM(song)
    if (bpm >= minBPM - currentConfig.bpmTolerance && bpm <= maxBPM + currentConfig.bpmTolerance) {
      const match = 1 - Math.abs(bpm - targetBPM) / (maxBPM - minBPM)
      results.push({ song, bpm, match: Math.max(0, match) })
    }
  }

  results.sort((a, b) => b.match - a.match)
  return results
}

/** 估算歌曲BPM（简化版） */
const estimateBPM = (song: MusicInfo): number => {
  const text = (song.name + song.singer).toLowerCase()
  // 基于歌曲名特征估算
  if (/摇滚|rock|metal|punk|快|fast/.test(text)) return 170
  if (/舞|dance|电子|electronic|dj/.test(text)) return 128
  if (/慢|slow|抒情|ballad|情歌/.test(text)) return 70
  if (/流行|pop/.test(text)) return 120
  if (/民谣|folk|轻音乐/.test(text)) return 90
  if (/说唱|rap|hiphop/.test(text)) return 95
  // 默认中等节奏
  return 120
}

/** 获取所有跑步会话 */
export const getAllSessions = async (): Promise<RunningSession[]> => {
  const data = await getData<RunningSession[]>(SESSIONS_KEY)
  return data || []
}

/** 获取跑步统计 */
export const getRunningStats = async () => {
  const sessions = await getAllSessions()
  const totalDistance = sessions.reduce((sum, s) => sum + s.distanceEstimated, 0)
  const totalCalories = sessions.reduce((sum, s) => sum + s.caloriesEstimated, 0)
  const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0)
  const totalSteps = sessions.reduce((sum, s) => sum + s.stepsEstimated, 0)

  return {
    totalSessions: sessions.length,
    totalDistance, // 米
    totalCalories,
    totalDuration, // 秒
    totalSteps,
    averageDistance: sessions.length > 0 ? totalDistance / sessions.length : 0,
    averageDuration: sessions.length > 0 ? totalDuration / sessions.length : 0,
  }
}

/** 推荐配速 */
export const recommendPace = (level: 'beginner' | 'intermediate' | 'advanced'): {
  goal: RunningGoal
  cadence: number
  reason: string
} => {
  switch (level) {
    case 'beginner':
      return { goal: 'jog', cadence: 140, reason: '初学者推荐慢跑，步频140' }
    case 'intermediate':
      return { goal: 'run', cadence: 160, reason: '中级跑者推荐快跑，步频160' }
    case 'advanced':
      return { goal: 'sprint', cadence: 180, reason: '高级跑者推荐冲刺，步频180' }
  }
}

/** 调整播放速度匹配步频 */
export const adjustPlaybackRate = async (songBPM: number, targetCadence: number): Promise<number> => {
  if (!currentConfig.autoAdjustTempo) return 1
  const rate = targetCadence / songBPM
  // 限制在 0.5 - 2.0 之间
  const clampedRate = Math.max(0.5, Math.min(2.0, rate))
  try {
    await TrackPlayer.setRate(clampedRate)
  } catch {
    // 静默处理
  }
  return clampedRate
}

export const getActiveSession = (): RunningSession | null => activeSession
