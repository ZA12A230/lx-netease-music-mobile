/**
 * 音乐统计仪表盘数据模块
 * 提供可视化听歌数据：时长趋势、风格分布、活跃时段等
 */
import { getPlayHistoryByRange } from '@/core/player/playHistory'
import { formatDuration } from './statsReport'

export interface DashboardData {
  // 总览
  totalPlays: number
  totalDuration: string
  uniqueSongs: number
  uniqueArtists: number
  // 趋势
  dailyTrend: Array<{ date: string; plays: number; duration: number }>
  hourlyActive: number[] // 24小时活跃度
  // Top榜单
  topSongs: Array<{ name: string; singer: string; count: number; duration: number }>
  topArtists: Array<{ name: string; count: number; duration: number }>
  topSources: Array<{ source: string; count: number }>
  // 心情分布
  moodDistribution: Record<string, number>
  // 元数据
  startDate: string
  endDate: string
  range: 'week' | 'month' | 'year'
}

/** 格式化日期 */
const formatDate = (timestamp: number): string => {
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 格式化完整日期 */
const formatFullDate = (timestamp: number): string => {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 获取范围开始时间 */
const getRangeStart = (range: 'week' | 'month' | 'year'): number => {
  const now = new Date()
  if (range === 'week') {
    const day = now.getDay() || 7
    now.setDate(now.getDate() - day + 1)
  } else if (range === 'month') {
    now.setDate(1)
  } else {
    now.setMonth(0, 1)
  }
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

/** 根据歌名推断心情 */
const inferMood = (name: string): string => {
  const text = name.toLowerCase()
  if (/快乐|阳光|happy|舞|dance|sunshine|晴天/.test(text)) return '愉悦'
  if (/伤心|泪|sad|cry|孤独|lonely|miss|想念|离开|分手/.test(text)) return '忧伤'
  if (/rock|热血|战斗|fight|power|燃|激烈/.test(text)) return '活力'
  if (/夜|moon|安静|silent|宁静|钢琴|piano|sleep/.test(text)) return '宁静'
  if (/爱|love|心|heart|玫瑰|浪漫|romantic|温柔|甜蜜/.test(text)) return '浪漫'
  return '其他'
}

/** 生成仪表盘数据 */
export const generateDashboard = async (range: 'week' | 'month' | 'year' = 'week'): Promise<DashboardData | null> => {
  const endTime = Date.now()
  const startTime = getRangeStart(range)
  const history = await getPlayHistoryByRange(startTime, endTime)

  if (history.length === 0) return null

  // 总览统计
  const songSet = new Set<string>()
  const artistSet = new Set<string>()
  const songMap = new Map<string, { name: string; singer: string; count: number; duration: number }>()
  const artistMap = new Map<string, { name: string; count: number; duration: number }>()
  const sourceMap = new Map<string, number>()
  const moodMap: Record<string, number> = {}
  let totalDuration = 0

  // 趋势和活跃时段
  const dayMs = 24 * 60 * 60 * 1000
  const totalDays = Math.max(1, Math.ceil((endTime - startTime) / dayMs))
  const dailyTrend: Array<{ date: string; plays: number; duration: number }> = []
  const hourlyActive = new Array(24).fill(0)

  // 初始化每日趋势
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(startTime + i * dayMs)
    dailyTrend.push({ date: formatDate(date.getTime()), plays: 0, duration: 0 })
  }

  for (const item of history) {
    // 总览
    const songKey = `${item.musicInfo.name}_${item.musicInfo.singer}`
    songSet.add(songKey)
    artistSet.add(item.musicInfo.singer)
    totalDuration += item.playTime

    // 歌曲统计
    if (songMap.has(songKey)) {
      const s = songMap.get(songKey)!
      s.count++
      s.duration += item.playTime
    } else {
      songMap.set(songKey, {
        name: item.musicInfo.name,
        singer: item.musicInfo.singer,
        count: 1,
        duration: item.playTime,
      })
    }

    // 歌手统计
    if (artistMap.has(item.musicInfo.singer)) {
      const a = artistMap.get(item.musicInfo.singer)!
      a.count++
      a.duration += item.playTime
    } else {
      artistMap.set(item.musicInfo.singer, {
        name: item.musicInfo.singer,
        count: 1,
        duration: item.playTime,
      })
    }

    // 来源统计
    const source = item.source || '未知'
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1)

    // 心情分布
    const mood = inferMood(item.musicInfo.name)
    moodMap[mood] = (moodMap[mood] || 0) + 1

    // 每日趋势
    const itemTime = new Date(item.playedAt || endTime)
    const dayIndex = Math.floor((itemTime.getTime() - startTime) / dayMs)
    if (dayIndex >= 0 && dayIndex < totalDays) {
      dailyTrend[dayIndex].plays++
      dailyTrend[dayIndex].duration += item.playTime
    }

    // 小时活跃度
    hourlyActive[itemTime.getHours()]++
  }

  return {
    totalPlays: history.length,
    totalDuration: formatDuration(Math.floor(totalDuration)),
    uniqueSongs: songSet.size,
    uniqueArtists: artistSet.size,
    dailyTrend,
    hourlyActive,
    topSongs: Array.from(songMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topArtists: Array.from(artistMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topSources: Array.from(sourceMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    moodDistribution: moodMap,
    startDate: formatFullDate(startTime),
    endDate: formatFullDate(endTime),
    range,
  }
}

/** 获取活跃时段描述 */
export const getPeakHour = (hourlyActive: number[]): { hour: number; label: string } => {
  let maxHour = 0
  let maxValue = 0
  for (let i = 0; i < hourlyActive.length; i++) {
    if (hourlyActive[i] > maxValue) {
      maxValue = hourlyActive[i]
      maxHour = i
    }
  }
  let label = ''
  if (maxHour >= 6 && maxHour < 12) label = '上午'
  else if (maxHour >= 12 && maxHour < 18) label = '下午'
  else if (maxHour >= 18 && maxHour < 22) label = '傍晚'
  else label = '深夜'
  return { hour: maxHour, label }
}
