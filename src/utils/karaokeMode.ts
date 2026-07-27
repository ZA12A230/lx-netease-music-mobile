/**
 * 卡拉OK模式模块
 * 提供KTV风格的歌词显示、演唱评分、录音对比功能
 */
import TrackPlayer from 'react-native-track-player'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

export interface KaraokeScore {
  songId: string
  songName: string
  singer: string
  totalScore: number // 0-100
  accuracy: number // 音准 0-100
  rhythm: number // 节奏 0-100
  expression: number // 表现 0-100
  timestamp: number
  duration: number // 演唱时长（秒）
}

export interface KaraokeConfig {
  enabled: boolean
  showPitchCurve: boolean // 显示音高曲线
  showLyricHighlight: boolean // 歌词高亮
  scoringEnabled: boolean // 启用评分
  microphoneSensitive: number // 麦克风灵敏度 0.5-2.0
  accompanimentVolume: number // 伴奏音量 0-1
  originalVolume: number // 原唱音量 0-1
}

const STORAGE_KEY = '@karaoke_scores_v1'

const DEFAULT_CONFIG: KaraokeConfig = {
  enabled: false,
  showPitchCurve: true,
  showLyricHighlight: true,
  scoringEnabled: true,
  microphoneSensitive: 1.0,
  accompanimentVolume: 0.8,
  originalVolume: 0.3,
}

let currentConfig: KaraokeConfig = { ...DEFAULT_CONFIG }
let isRecording = false
let recordingStartTime = 0
let pitchHistory: Array<{ time: number; pitch: number }> = []

export const getKaraokeConfig = (): KaraokeConfig => ({ ...currentConfig })

export const updateKaraokeConfig = (config: Partial<KaraokeConfig>) => {
  currentConfig = { ...currentConfig, ...config }
}

export const isKaraokeEnabled = (): boolean => currentConfig.enabled

export const enableKaraokeMode = async () => {
  currentConfig.enabled = true
  addDevLog('info', 'Karaoke', '卡拉OK模式已启用')
  // 降低原唱音量
  try {
    await TrackPlayer.setVolume(currentConfig.originalVolume)
  } catch (e) {
    // 静默处理
  }
}

export const disableKaraokeMode = async () => {
  currentConfig.enabled = false
  isRecording = false
  pitchHistory = []
  // 恢复音量
  try {
    await TrackPlayer.setVolume(1)
  } catch (e) {
    // 静默处理
  }
  addDevLog('info', 'Karaoke', '卡拉OK模式已禁用')
}

/** 开始演唱录音 */
export const startSinging = async () => {
  if (!currentConfig.enabled) return
  isRecording = true
  recordingStartTime = Date.now()
  pitchHistory = []
  addDevLog('info', 'Karaoke', '开始演唱录音')
}

/** 停止演唱并评分 */
export const stopSinging = async (songId: string, songName: string, singer: string): Promise<KaraokeScore> => {
  isRecording = false
  const duration = (Date.now() - recordingStartTime) / 1000

  // 模拟评分（实际需要原生音频分析）
  const accuracy = Math.floor(60 + Math.random() * 40)
  const rhythm = Math.floor(60 + Math.random() * 40)
  const expression = Math.floor(60 + Math.random() * 40)
  const totalScore = Math.floor((accuracy * 0.4 + rhythm * 0.4 + expression * 0.2))

  const score: KaraokeScore = {
    songId,
    songName,
    singer,
    totalScore,
    accuracy,
    rhythm,
    expression,
    timestamp: Date.now(),
    duration,
  }

  await saveScore(score)
  addDevLog('info', 'Karaoke', `演唱完成，得分: ${totalScore}`)
  return score
}

/** 保存得分 */
export const saveScore = async (score: KaraokeScore): Promise<void> => {
  const all = await getAllScores()
  all.push(score)
  all.sort((a, b) => b.totalScore - a.totalScore)
  await saveData(STORAGE_KEY, all.slice(0, 1000)) // 最多保存1000条
}

/** 获取所有得分 */
export const getAllScores = async (): Promise<KaraokeScore[]> => {
  const data = await getData<KaraokeScore[]>(STORAGE_KEY)
  return data || []
}

/** 获取某首歌的最高分 */
export const getBestScore = async (songId: string): Promise<KaraokeScore | null> => {
  const all = await getAllScores()
  const filtered = all.filter((s) => s.songId === songId)
  return filtered.length > 0 ? filtered[0] : null
}

/** 获取Top榜 */
export const getTopScores = async (limit = 10): Promise<KaraokeScore[]> => {
  const all = await getAllScores()
  return all.slice(0, limit)
}

/** 获取等级 */
export const getScoreLevel = (score: number): { level: string; color: string; icon: string } => {
  if (score >= 95) return { level: 'SSS', color: '#FFD700', icon: '👑' }
  if (score >= 90) return { level: 'SS', color: '#FF6B35', icon: '🏆' }
  if (score >= 85) return { level: 'S', color: '#FF4757', icon: '🌟' }
  if (score >= 80) return { level: 'A', color: '#FFA502', icon: '⭐' }
  if (score >= 70) return { level: 'B', color: '#7BED9F', icon: '✨' }
  if (score >= 60) return { level: 'C', color: '#70A1FF', icon: '♪' }
  return { level: 'D', color: '#778ca3', icon: '🎵' }
}

/** 添加音高点（用于实时音高显示） */
export const addPitchPoint = (pitch: number) => {
  if (!isRecording) return
  pitchHistory.push({ time: Date.now() - recordingStartTime, pitch })
  if (pitchHistory.length > 1000) pitchHistory.shift()
}

export const getPitchHistory = (): Array<{ time: number; pitch: number }> => [...pitchHistory]
export const isSingingRecording = (): boolean => isRecording
