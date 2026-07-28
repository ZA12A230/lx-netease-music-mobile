/**
 * 音乐心情日历
 * 按日历形式展示每日心情和对应的听歌记录，形成心情热力图
 */
import { getPlayHistoryByRange } from '@/core/player/playHistory'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

type MusicInfo = LX.Music.MusicInfo

export type MoodLevel = 'very_sad' | 'sad' | 'neutral' | 'happy' | 'very_happy'

export interface DayMood {
  /** 日期 YYYY-MM-DD */
  date: string
  /** 心情等级 */
  mood: MoodLevel
  /** 心情分数 0-100 */
  score: number
  /** 当日播放次数 */
  playCount: number
  /** 当日独立歌曲数 */
  uniqueSongs: number
  /** Top 歌曲 */
  topSong?: { name: string; singer: string }
  /** 主导情绪关键词 */
  emotionTags: string[]
  /** 心情描述 */
  description: string
}

export interface MonthMood {
  /** 月份 YYYY-MM */
  month: string
  days: DayMood[]
  /** 月度平均心情 */
  avgScore: number
  /** 月度主调心情 */
  dominantMood: MoodLevel
  /** 月度总播放 */
  totalPlays: number
  /** 月度最佳日 */
  bestDay?: DayMood
  /** 月度最低日 */
  worstDay?: DayMood
}

export interface MoodCalendarReport {
  months: MonthMood[]
  totalTimeRange: { start: number; end: number }
  totalDays: number
  avgScore: number
  dominantMood: MoodLevel
  /** 心情热力图数据（按日排列） */
  heatmap: Array<{ date: string; score: number; mood: MoodLevel }>
  /** 心情趋势（升/降/平） */
  trend: 'improving' | 'stable' | 'declining'
  generatedAt: number
}

const CALENDAR_CACHE_KEY = '@mood_calendar_cache_v1'

const MOOD_NAMES: Record<MoodLevel, string> = {
  very_sad: '非常低落',
  sad: '低落',
  neutral: '平静',
  happy: '愉快',
  very_happy: '非常愉快',
}

const MOOD_EMOJI: Record<MoodLevel, string> = {
  very_sad: '😢',
  sad: '😕',
  neutral: '😐',
  happy: '😊',
  very_happy: '😄',
}

const MOOD_COLORS: Record<MoodLevel, string> = {
  very_sad: '#5B7FFF',
  sad: '#7F9FFF',
  neutral: '#BFBFBF',
  happy: '#FFD966',
  very_happy: '#FF9F40',
}

/** 生成心情日历报告 */
export const generateCalendar = async (daysBack = 90): Promise<MoodCalendarReport> => {
  const now = Date.now()
  const start = now - daysBack * 24 * 60 * 60 * 1000
  const history = await getPlayHistoryByRange(start, now)

  if (history.length === 0) {
    return createEmptyReport()
  }

  // 按日分组
  const dailyMap = new Map<string, Array<{ musicInfo?: MusicInfo; playedAt?: number }>>()
  for (const item of history as any[]) {
    const ts = item.playedAt || 0
    if (!ts) continue
    const d = new Date(ts)
    const dateStr = formatDate(d)
    if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, [])
    dailyMap.get(dateStr)!.push(item)
  }

  // 构建每日心情
  const dayMoods: DayMood[] = []
  for (const [date, items] of dailyMap.entries()) {
    dayMoods.push(buildDayMood(date, items))
  }
  dayMoods.sort((a, b) => a.date.localeCompare(b.date))

  // 按月分组
  const monthMap = new Map<string, DayMood[]>()
  for (const day of dayMoods) {
    const month = day.date.slice(0, 7)
    if (!monthMap.has(month)) monthMap.set(month, [])
    monthMap.get(month)!.push(day)
  }

  const months: MonthMood[] = []
  for (const [month, days] of monthMap.entries()) {
    months.push(buildMonthMood(month, days))
  }
  months.sort((a, b) => a.month.localeCompare(b.month))

  // 总统计
  const totalDays = dayMoods.length
  const avgScore = totalDays > 0 ? Math.round(dayMoods.reduce((s, d) => s + d.score, 0) / totalDays) : 0
  const dominantMood = scoreToMood(avgScore)
  const heatmap = dayMoods.map((d) => ({ date: d.date, score: d.score, mood: d.mood }))
  const trend = calculateTrend(dayMoods)

  const report: MoodCalendarReport = {
    months,
    totalTimeRange: { start, end: now },
    totalDays,
    avgScore,
    dominantMood,
    heatmap,
    trend,
    generatedAt: now,
  }

  await saveData(CALENDAR_CACHE_KEY, { report, generatedAt: now })
  addDevLog('info', 'MoodCalendar', `生成心情日历: ${totalDays}天, 均分${avgScore}`)
  return report
}

const createEmptyReport = (): MoodCalendarReport => ({
  months: [],
  totalTimeRange: { start: 0, end: 0 },
  totalDays: 0,
  avgScore: 50,
  dominantMood: 'neutral',
  heatmap: [],
  trend: 'stable',
  generatedAt: Date.now(),
})

/** 构建单日心情 */
const buildDayMood = (date: string, items: Array<{ musicInfo?: MusicInfo; playedAt?: number }>): DayMood => {
  const songMap = new Map<string, { name: string; singer: string; count: number; score: number }>()

  let totalMoodScore = 0
  let songCount = 0

  for (const item of items) {
    const m = item.musicInfo
    if (!m) continue
    const key = `${m.singer}-${m.name}`
    const songScore = guessSongMood(m)
    totalMoodScore += songScore
    songCount++

    const existing = songMap.get(key)
    if (existing) {
      existing.count++
    } else {
      songMap.set(key, { name: m.name, singer: m.singer, count: 1, score: songScore })
    }
  }

  const avgSongScore = songCount > 0 ? totalMoodScore / songCount : 50
  // 播放次数加成：听得越多心情可能越好（活动性）
  const activityBonus = Math.min(15, items.length / 5)
  const score = Math.max(0, Math.min(100, Math.round(avgSongScore + activityBonus)))

  const mood = scoreToMood(score)
  const topSongEntry = Array.from(songMap.values()).sort((a, b) => b.count - a.count)[0]
  const emotionTags = extractEmotionTags(Array.from(songMap.keys()))
  const description = buildDayDescription(mood, items.length, topSongEntry)

  return {
    date,
    mood,
    score,
    playCount: items.length,
    uniqueSongs: songMap.size,
    topSong: topSongEntry ? { name: topSongEntry.name, singer: topSongEntry.singer } : undefined,
    emotionTags,
    description,
  }
}

/** 启发式歌曲心情评分 */
const guessSongMood = (song: MusicInfo): number => {
  const text = (song.name + song.singer).toLowerCase()
  let score = 50
  if (/快乐|happy|欢|笑|阳光|sun|舞|dance|dj|快|燃|热血|摇滚|rock/.test(text)) score += 25
  if (/爱|love|心|甜|美/.test(text)) score += 15
  if (/悲|伤|哭|泪|sad|心碎|痛|miss|思/.test(text)) score -= 25
  if (/慢|slow|静|夜|moon|抒情|孤独|lonely/.test(text)) score -= 15
  if (/愤怒|angry|恨|怒/.test(text)) score -= 10
  return Math.max(0, Math.min(100, score))
}

/** 分数转心情等级 */
const scoreToMood = (score: number): MoodLevel => {
  if (score >= 80) return 'very_happy'
  if (score >= 60) return 'happy'
  if (score >= 40) return 'neutral'
  if (score >= 20) return 'sad'
  return 'very_sad'
}

/** 提取情绪标签 */
const extractEmotionTags = (songKeys: string[]): string[] => {
  const tags = new Set<string>()
  for (const key of songKeys) {
    if (/爱|love|心/.test(key)) tags.add('爱情')
    if (/悲|伤|泪|sad/.test(key)) tags.add('感伤')
    if (/欢|快|happy|笑/.test(key)) tags.add('欢快')
    if (/思|念|miss/.test(key)) tags.add('思念')
    if (/夜|moon|静/.test(key)) tags.add('夜晚')
    if (/燃|热血|rock/.test(key)) tags.add('热血')
  }
  return Array.from(tags).slice(0, 4)
}

/** 构建单日描述 */
const buildDayDescription = (
  mood: MoodLevel,
  playCount: number,
  topSong?: { name: string; singer: string },
): string => {
  const moodName = MOOD_NAMES[mood]
  let desc = `${MOOD_EMOJI[mood]} ${moodName}的一天，听了${playCount}首歌`
  if (topSong) {
    desc += `，最爱《${topSong.name}》`
  }
  return desc
}

/** 构建月度心情 */
const buildMonthMood = (month: string, days: DayMood[]): MonthMood => {
  const avgScore = Math.round(days.reduce((s, d) => s + d.score, 0) / days.length)
  const dominantMood = scoreToMood(avgScore)
  const totalPlays = days.reduce((s, d) => s + d.playCount, 0)
  const sorted = [...days].sort((a, b) => b.score - a.score)
  return {
    month,
    days,
    avgScore,
    dominantMood,
    totalPlays,
    bestDay: sorted[0],
    worstDay: sorted[sorted.length - 1],
  }
}

/** 计算心情趋势 */
const calculateTrend = (days: DayMood[]): 'improving' | 'stable' | 'declining' => {
  if (days.length < 7) return 'stable'
  const recent = days.slice(-7)
  const previous = days.slice(-14, -7)
  if (previous.length === 0) return 'stable'
  const recentAvg = recent.reduce((s, d) => s + d.score, 0) / recent.length
  const prevAvg = previous.reduce((s, d) => s + d.score, 0) / previous.length
  const diff = recentAvg - prevAvg
  if (diff > 5) return 'improving'
  if (diff < -5) return 'declining'
  return 'stable'
}

/** 格式化日期 */
const formatDate = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 获取缓存的报告 */
export const getCachedCalendar = async (): Promise<MoodCalendarReport | null> => {
  const data = await getData<{ report: MoodCalendarReport; generatedAt: number }>(CALENDAR_CACHE_KEY)
  if (!data) return null
  if (Date.now() - data.generatedAt > 12 * 60 * 60 * 1000) return null
  return data.report
}

/** 清除缓存 */
export const clearCalendarCache = async (): Promise<void> => {
  await saveData(CALENDAR_CACHE_KEY, null)
  addDevLog('info', 'MoodCalendar', '缓存已清空')
}

/** 获取心情名称 */
export const getMoodName = (mood: MoodLevel): string => MOOD_NAMES[mood]

/** 获取心情emoji */
export const getMoodEmoji = (mood: MoodLevel): string => MOOD_EMOJI[mood]

/** 获取心情颜色 */
export const getMoodColor = (mood: MoodLevel): string => MOOD_COLORS[mood]

/** 获取趋势名称 */
export const getTrendName = (trend: 'improving' | 'stable' | 'declining'): string => {
  const map = { improving: '上升 ↗', stable: '平稳 →', declining: '下降 ↘' }
  return map[trend]
}

/** 生成日历文本报告 */
export const generateTextReport = (report: MoodCalendarReport): string => {
  if (report.totalDays === 0) return '📅 暂无听歌数据'

  let text = `📅 音乐心情日历报告\n\n`
  text += `📊 总览：${report.totalDays}天，平均心情${getMoodName(report.dominantMood)}(${report.avgScore}分)\n`
  text += `📈 趋势：${getTrendName(report.trend)}\n\n`

  for (const month of report.months) {
    text += `\n【${month.month}】均分${month.avgScore} ${getMoodEmoji(month.dominantMood)}\n`
    text += `  播放${month.totalPlays}次，共${month.days.length}天\n`
    if (month.bestDay) {
      text += `  最佳：${month.bestDay.date} (${month.bestDay.score}分)\n`
    }
    if (month.worstDay) {
      text += `  最低：${month.worstDay.date} (${month.worstDay.score}分)\n`
    }
  }

  return text
}
