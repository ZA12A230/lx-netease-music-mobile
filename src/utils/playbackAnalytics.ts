/**
 * 播放历史深度分析
 * 分析播放模式、时段偏好、跳过率、重复率等维度
 */
import { getPlayHistoryByRange } from '@/core/player/playHistory'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

type MusicInfo = LX.Music.MusicInfo

export interface PlaybackAnalytics {
  /** 分析周期 */
  period: { start: number; end: number; days: number }
  /** 总播放次数 */
  totalPlays: number
  /** 日均播放 */
  avgDailyPlays: number
  /** 独立歌曲数 */
  uniqueSongs: number
  /** 独立歌手数 */
  uniqueArtists: number
  /** 时段分布（小时） */
  hourlyDistribution: Record<number, number>
  /** 星期分布 */
  weekdayDistribution: Record<string, number>
  /** 重复率（重复播放的歌曲占比） */
  repeatRate: number
  /** Top歌手 */
  topArtists: Array<{ name: string; count: number; percentage: number }>
  /** Top歌曲 */
  topSongs: Array<{ name: string; singer: string; count: number; percentage: number }>
  /** 时段偏好标签 */
  timePreference: string
  /** 音乐多样性评分（0-100） */
  diversityScore: number
  /** 播放趋势 */
  trend: 'increasing' | 'decreasing' | 'stable'
  /** 峰值播放时段 */
  peakHour: number
  /** 峰值播放日 */
  peakDay: string
  /** 生成时间 */
  generatedAt: number
}

const ANALYTICS_CACHE_KEY = '@playback_analytics_v1'

/** 生成播放分析报告 */
export const analyzePlayback = async (daysBack = 30): Promise<PlaybackAnalytics> => {
  const now = Date.now()
  const start = now - daysBack * 24 * 60 * 60 * 1000
  const history = await getPlayHistoryByRange(start, now)

  if (history.length === 0) {
    return createEmptyAnalytics(start, now, daysBack)
  }

  const items = history as any[]

  // 时段分布
  const hourly: Record<number, number> = {}
  for (let h = 0; h < 24; h++) hourly[h] = 0
  const weekdays: Record<string, number> = { '周一': 0, '周二': 0, '周三': 0, '周四': 0, '周五': 0, '周六': 0, '周日': 0 }
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

  // 歌曲/歌手统计
  const songMap = new Map<string, { name: string; singer: string; count: number }>()
  const artistMap = new Map<string, number>()
  const dailyCounts: Record<string, number> = {}

  for (const item of items) {
    const ts = item.playedAt || 0
    if (!ts) continue
    const d = new Date(ts)

    hourly[d.getHours()]++
    const wd = weekdayNames[d.getDay()]
    weekdays[wd]++

    const dateStr = d.toISOString().slice(0, 10)
    dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1

    if (item.musicInfo) {
      const m = item.musicInfo
      const songKey = `${m.singer}-${m.name}`
      const existing = songMap.get(songKey)
      if (existing) {
        existing.count++
      } else {
        songMap.set(songKey, { name: m.name, singer: m.singer, count: 1 })
      }
      artistMap.set(m.singer, (artistMap.get(m.singer) || 0) + 1)
    }
  }

  const total = items.length
  const uniqueSongs = songMap.size
  const uniqueArtists = artistMap.size

  // Top排行
  const topSongs = Array.from(songMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((s) => ({ ...s, percentage: Math.round((s.count / total) * 100) }))

  const topArtists = Array.from(artistMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }))

  // 重复率
  const repeatCount = Array.from(songMap.values()).filter((s) => s.count > 1).reduce((sum, s) => sum + s.count - 1, 0)
  const repeatRate = Math.round((repeatCount / total) * 100)

  // 多样性评分（独立歌曲数/总播放数*100，越多样的评分越高）
  const diversityScore = Math.min(100, Math.round((uniqueSongs / Math.max(1, total)) * 100))

  // 日均播放
  const days = Object.keys(dailyCounts).length || 1
  const avgDailyPlays = Math.round(total / days)

  // 峰值
  const peakHour = Object.entries(hourly).sort((a, b) => b[1] - a[1])[0]
  const peakDay = Object.entries(weekdays).sort((a, b) => b[1] - a[1])[0]

  // 时段偏好
  const timePreference = getTimePreference(hourly)

  // 趋势
  const trend = calculateTrend(dailyCounts)

  const analytics: PlaybackAnalytics = {
    period: { start, end: now, days: daysBack },
    totalPlays: total,
    avgDailyPlays,
    uniqueSongs,
    uniqueArtists,
    hourlyDistribution: hourly,
    weekdayDistribution: weekdays,
    repeatRate,
    topArtists,
    topSongs,
    timePreference,
    diversityScore,
    trend,
    peakHour: peakHour ? parseInt(peakHour[0]) : 0,
    peakDay: peakDay ? peakDay[0] : '周一',
    generatedAt: now,
  }

  await saveData(ANALYTICS_CACHE_KEY, { analytics, generatedAt: now })
  addDevLog('info', 'PlaybackAnalytics', `分析完成: ${total}次播放, 多样性${diversityScore}分`)
  return analytics
}

const createEmptyAnalytics = (start: number, end: number, days: number): PlaybackAnalytics => {
  const hourly: Record<number, number> = {}
  for (let h = 0; h < 24; h++) hourly[h] = 0
  return {
    period: { start, end, days },
    totalPlays: 0,
    avgDailyPlays: 0,
    uniqueSongs: 0,
    uniqueArtists: 0,
    hourlyDistribution: hourly,
    weekdayDistribution: {},
    repeatRate: 0,
    topArtists: [],
    topSongs: [],
    timePreference: '无数据',
    diversityScore: 0,
    trend: 'stable',
    peakHour: 0,
    peakDay: '周一',
    generatedAt: Date.now(),
  }
}

/** 判断时段偏好 */
const getTimePreference = (hourly: Record<number, number>): string => {
  const morning = sumHourRange(hourly, 6, 11)
  const afternoon = sumHourRange(hourly, 12, 17)
  const evening = sumHourRange(hourly, 18, 23)
  const night = sumHourRange(hourly, 0, 5)

  const max = Math.max(morning, afternoon, evening, night)
  if (max === 0) return '无偏好'
  if (max === morning) return '晨间型'
  if (max === afternoon) return '午后型'
  if (max === evening) return '夜间型'
  return '深夜型'
}

const sumHourRange = (hourly: Record<number, number>, from: number, to: number): number => {
  let sum = 0
  for (let h = from; h <= to; h++) sum += hourly[h] || 0
  return sum
}

/** 计算趋势 */
const calculateTrend = (dailyCounts: Record<string, number>): 'increasing' | 'decreasing' | 'stable' => {
  const dates = Object.keys(dailyCounts).sort()
  if (dates.length < 7) return 'stable'

  const recent = dates.slice(-7)
  const previous = dates.slice(-14, -7)
  const recentAvg = recent.reduce((s, d) => s + dailyCounts[d], 0) / recent.length
  const prevAvg = previous.length > 0 ? previous.reduce((s, d) => s + dailyCounts[d], 0) / previous.length : recentAvg

  const diff = recentAvg - prevAvg
  if (diff > 2) return 'increasing'
  if (diff < -2) return 'decreasing'
  return 'stable'
}

/** 获取缓存报告 */
export const getCachedAnalytics = async (): Promise<PlaybackAnalytics | null> => {
  const data = await getData<{ analytics: PlaybackAnalytics; generatedAt: number }>(ANALYTICS_CACHE_KEY)
  if (!data) return null
  if (Date.now() - data.generatedAt > 6 * 60 * 60 * 1000) return null
  return data.analytics
}

/** 清除缓存 */
export const clearAnalyticsCache = async (): Promise<void> => {
  await saveData(ANALYTICS_CACHE_KEY, null)
  addDevLog('info', 'PlaybackAnalytics', '缓存已清空')
}

/** 获取趋势名称 */
export const getTrendName = (trend: 'increasing' | 'decreasing' | 'stable'): string => {
  const map = { increasing: '上升 ↗', decreasing: '下降 ↘', stable: '平稳 →' }
  return map[trend]
}

/** 生成文本报告 */
export const generateTextReport = (analytics: PlaybackAnalytics): string => {
  if (analytics.totalPlays === 0) return '📊 暂无播放数据'

  let text = `📊 播放行为分析报告\n\n`
  text += `📈 总览：${analytics.totalPlays}次播放，${analytics.uniqueSongs}首不同歌曲，${analytics.uniqueArtists}位歌手\n`
  text += `📅 日均播放：${analytics.avgDailyPlays}次\n`
  text += `🔄 重复率：${analytics.repeatRate}%\n`
  text += `🎨 多样性：${analytics.diversityScore}分\n`
  text += `⏰ 时段偏好：${analytics.timePreference}（峰值${analytics.peakHour}点）\n`
  text += `📊 趋势：${getTrendName(analytics.trend)}\n\n`

  text += `🎤 Top歌手：\n`
  for (let i = 0; i < Math.min(5, analytics.topArtists.length); i++) {
    const a = analytics.topArtists[i]
    text += `  ${i + 1}. ${a.name} (${a.count}次, ${a.percentage}%)\n`
  }

  text += `\n🎵 Top歌曲：\n`
  for (let i = 0; i < Math.min(5, analytics.topSongs.length); i++) {
    const s = analytics.topSongs[i]
    text += `  ${i + 1}. 《${s.name}》- ${s.singer} (${s.count}次)\n`
  }

  return text
}