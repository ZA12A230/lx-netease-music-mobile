/**
 * 音乐心情日记模块
 * 记录每天的心情和对应的歌曲，形成音乐情感时间线
 */
import { getData, saveData } from '@/plugins/storage'
type MusicInfo = LX.Music.MusicInfo

export type MoodLevel = 'great' | 'good' | 'normal' | 'bad' | 'terrible'

export interface DiaryEntry {
  id: string
  date: string // YYYY-MM-DD
  timestamp: number
  mood: MoodLevel
  note: string
  songs: Array<{
    name: string
    singer: string
    source?: string
  }>
  weather?: string
  location?: string
}

const STORAGE_KEY = '@mood_diary_v1'

const MOOD_META: Record<MoodLevel, { name: string; emoji: string; color: string; score: number }> = {
  great: { name: '超棒', emoji: '😄', color: '#4CAF50', score: 5 },
  good: { name: '不错', emoji: '🙂', color: '#8BC34A', score: 4 },
  normal: { name: '一般', emoji: '😐', color: '#FFC107', score: 3 },
  bad: { name: '不太好', emoji: '😕', color: '#FF9800', score: 2 },
  terrible: { name: '糟糕', emoji: '😢', color: '#F44336', score: 1 },
}

export const getMoodMeta = (mood: MoodLevel) => MOOD_META[mood]

/** 获取所有日记 */
export const getAllDiaries = async (): Promise<DiaryEntry[]> => {
  const data = await getData<DiaryEntry[]>(STORAGE_KEY)
  return data || []
}

/** 获取指定日期的日记 */
export const getDiaryByDate = async (date: string): Promise<DiaryEntry | null> => {
  const all = await getAllDiaries()
  return all.find((d) => d.date === date) || null
}

/** 获取今日日记 */
export const getTodayDiary = async (): Promise<DiaryEntry | null> => {
  const today = new Date().toISOString().split('T')[0]
  return getDiaryByDate(today)
}

/** 添加/更新日记 */
export const saveDiary = async (entry: Omit<DiaryEntry, 'id' | 'timestamp'> & { id?: string }): Promise<string> => {
  const all = await getAllDiaries()
  const id = entry.id || `diary_${Date.now()}`
  const timestamp = Date.now()

  const newEntry: DiaryEntry = {
    ...entry,
    id,
    timestamp,
  }

  // 同一天的日记覆盖
  const existingIndex = all.findIndex((d) => d.date === entry.date)
  if (existingIndex >= 0) {
    newEntry.id = all[existingIndex].id
    newEntry.timestamp = all[existingIndex].timestamp
    all[existingIndex] = newEntry
  } else {
    all.push(newEntry)
  }

  // 按日期排序
  all.sort((a, b) => b.timestamp - a.timestamp)
  await saveData(STORAGE_KEY, all)
  return id
}

/** 删除日记 */
export const deleteDiary = async (id: string): Promise<void> => {
  const all = await getAllDiaries()
  const filtered = all.filter((d) => d.id !== id)
  await saveData(STORAGE_KEY, filtered)
}

/** 获取日期范围内的日记 */
export const getDiariesByRange = async (startDate: string, endDate: string): Promise<DiaryEntry[]> => {
  const all = await getAllDiaries()
  return all.filter((d) => d.date >= startDate && d.date <= endDate)
}

/** 获取心情统计 */
export const getMoodStats = async (days = 30): Promise<{
  total: number
  averageScore: number
  distribution: Record<MoodLevel, number>
  trend: Array<{ date: string; score: number; mood: MoodLevel }>
}> => {
  const all = await getAllDiaries()
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const recent = all.filter((d) => d.timestamp >= cutoff)

  const distribution: Record<MoodLevel, number> = {
    great: 0, good: 0, normal: 0, bad: 0, terrible: 0,
  }
  let totalScore = 0

  for (const d of recent) {
    distribution[d.mood]++
    totalScore += MOOD_META[d.mood].score
  }

  const trend = recent
    .map((d) => ({
      date: d.date,
      score: MOOD_META[d.mood].score,
      mood: d.mood,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    total: recent.length,
    averageScore: recent.length > 0 ? totalScore / recent.length : 0,
    distribution,
    trend,
  }
}

/** 自动从当前播放歌曲生成日记草稿 */
export const createDiaryDraftFromCurrentSong = (song: MusicInfo): Partial<DiaryEntry> => {
  const today = new Date().toISOString().split('T')[0]
  return {
    date: today,
    mood: 'normal',
    note: '',
    songs: [{
      name: song.name,
      singer: song.singer,
      source: song.source,
    }],
  }
}
