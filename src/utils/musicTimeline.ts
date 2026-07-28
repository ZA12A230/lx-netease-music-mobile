/**
 * 音乐时间轴
 * 按时间线展示你的听歌历程，回顾不同时期的音乐偏好变化
 */
import { getPlayHistoryByRange } from '@/core/player/playHistory'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

type MusicInfo = LX.Music.MusicInfo

export type TimelineGranularity = 'day' | 'week' | 'month' | 'year'

export interface TimelineEntry {
  /** 时间标签（如 "2024-03" / "2024-W12" / "2024-03-15"） */
  label: string
  /** 起始时间戳 */
  start: number
  /** 结束时间戳 */
  end: number
  /** 总播放次数 */
  playCount: number
  /** 独立歌曲数 */
  uniqueSongs: number
  /** 独立歌手数 */
  uniqueArtists: number
  /** Top 歌曲 */
  topSongs: Array<{ name: string; singer: string; count: number }>
  /** Top 歌手 */
  topArtists: Array<{ name: string; count: number }>
  /** 主导风格 */
  dominantGenres: string[]
  /** 主导情绪 */
  mood: string
  /** 该时期的音乐阶段名称 */
  phaseName: string
  /** 摘要 */
  summary: string
}

export interface TimelineReport {
  entries: TimelineEntry[]
  totalTimeRange: { start: number; end: number }
  totalPlays: number
  totalUniqueSongs: number
  /** 阶段变化列表 */
  phaseChanges: Array<{ from: string; to: string; time: number; desc: string }>
  /** 时间跨度（天） */
  spanDays: number
  /** 生成时间 */
  generatedAt: number
}

const TIMELINE_CACHE_KEY = '@music_timeline_cache_v1'

/** 生成时间轴报告 */
export const generateTimeline = async (
  granularity: TimelineGranularity = 'month',
  daysBack = 365,
): Promise<TimelineReport> => {
  const now = Date.now()
  const start = now - daysBack * 24 * 60 * 60 * 1000
  const history = await getPlayHistoryByRange(start, now)

  if (history.length === 0) {
    return createEmptyReport()
  }

  // 按粒度分组
  const groups = groupByGranularity(history as any[], granularity)

  // 生成每个时间段的条目
  const entries: TimelineEntry[] = []
  for (const [label, items] of groups.entries()) {
    entries.push(buildEntry(label, items, granularity))
  }

  // 按时间排序
  entries.sort((a, b) => a.start - b.start)

  // 检测阶段变化
  const phaseChanges = detectPhaseChanges(entries)

  // 统计总数
  const totalPlays = entries.reduce((sum, e) => sum + e.playCount, 0)
  const songSet = new Set<string>()
  for (const e of entries) {
    for (const s of e.topSongs) {
      songSet.add(`${s.singer}-${s.name}`)
    }
  }

  const report: TimelineReport = {
    entries,
    totalTimeRange: { start, end: now },
    totalPlays,
    totalUniqueSongs: songSet.size,
    phaseChanges,
    spanDays: daysBack,
    generatedAt: now,
  }

  await saveData(TIMELINE_CACHE_KEY, { report, generatedAt: now })
  addDevLog('info', 'MusicTimeline', `生成时间轴: ${entries.length}个时段, ${totalPlays}次播放`)
  return report
}

const createEmptyReport = (): TimelineReport => ({
  entries: [],
  totalTimeRange: { start: 0, end: 0 },
  totalPlays: 0,
  totalUniqueSongs: 0,
  phaseChanges: [],
  spanDays: 0,
  generatedAt: Date.now(),
})

/** 按粒度分组 */
const groupByGranularity = (
  history: Array<{ musicInfo?: MusicInfo; playedAt?: number }>,
  granularity: TimelineGranularity,
): Map<string, Array<{ musicInfo?: MusicInfo; playedAt?: number }>> => {
  const groups = new Map<string, Array<{ musicInfo?: MusicInfo; playedAt?: number }>>()

  for (const item of history) {
    const ts = item.playedAt || 0
    if (!ts) continue
    const d = new Date(ts)
    let label = ''
    switch (granularity) {
      case 'day':
        label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        break
      case 'week': {
        // ISO 周数
        const tmp = new Date(d)
        tmp.setHours(0, 0, 0, 0)
        tmp.setDate(tmp.getDate() - (tmp.getDay() || 7) + 1)
        const weekNum = Math.ceil((((tmp.getTime() - new Date(tmp.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7)
        label = `${tmp.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
        break
      }
      case 'month':
        label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        break
      case 'year':
        label = `${d.getFullYear()}`
        break
    }
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(item)
  }

  return groups
}

/** 构建单个时间轴条目 */
const buildEntry = (
  label: string,
  items: Array<{ musicInfo?: MusicInfo; playedAt?: number }>,
  granularity: TimelineGranularity,
): TimelineEntry => {
  // 计算时间范围
  const timestamps = items.map((i) => i.playedAt || 0).filter(Boolean)
  const start = timestamps.length ? Math.min(...timestamps) : Date.now()
  const end = timestamps.length ? Math.max(...timestamps) : Date.now()

  // 歌曲统计
  const songMap = new Map<string, { name: string; singer: string; count: number }>()
  const artistMap = new Map<string, number>()

  for (const item of items) {
    const m = item.musicInfo
    if (!m) continue
    const songKey = `${m.singer}-${m.name}`
    const existing = songMap.get(songKey)
    if (existing) {
      existing.count++
    } else {
      songMap.set(songKey, { name: m.name, singer: m.singer, count: 1 })
    }
    artistMap.set(m.singer, (artistMap.get(m.singer) || 0) + 1)
  }

  const topSongs = Array.from(songMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const topArtists = Array.from(artistMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // 主导风格
  const dominantGenres = guessGenres(topArtists.map((a) => a.name))

  // 主导情绪
  const mood = guessMoodFromSongs(topSongs)

  // 阶段名称
  const phaseName = determinePhaseName(dominantGenres, mood, topArtists[0]?.name)

  // 摘要
  const summary = buildSummary(label, topSongs[0], topArtists[0], items.length, granularity)

  return {
    label,
    start,
    end,
    playCount: items.length,
    uniqueSongs: songMap.size,
    uniqueArtists: artistMap.size,
    topSongs,
    topArtists,
    dominantGenres,
    mood,
    phaseName,
    summary,
  }
}

/** 启发式猜测风格 */
const guessGenres = (artists: string[]): string[] => {
  const genres = new Set<string>()
  for (const a of artists) {
    const text = a.toLowerCase()
    if (/摇滚|rock|乐队|band/.test(text)) genres.add('摇滚')
    if (/流行|pop/.test(text)) genres.add('流行')
    if (/民谣|folk/.test(text)) genres.add('民谣')
    if (/说唱|rap|hip.?hop/.test(text)) genres.add('说唱')
    if (/电子|dj|electronic|edm/.test(text)) genres.add('电子')
    if (/古风|古典|classical/.test(text)) genres.add('古典')
    if (/r&b| soul/.test(text)) genres.add('R&B')
  }
  return Array.from(genres).slice(0, 3)
}

/** 启发式猜测情绪 */
const guessMoodFromSongs = (songs: Array<{ name: string; singer: string; count: number }>): string => {
  let happy = 0, sad = 0, energetic = 0, calm = 0
  for (const s of songs) {
    const text = (s.name + s.singer).toLowerCase()
    if (/快乐|happy|欢|笑|阳光|sun/.test(text)) happy += s.count
    if (/悲|伤|哭|泪|sad|心碎/.test(text)) sad += s.count
    if (/摇滚|rock|舞|dance|dj|快|燃|热血/.test(text)) energetic += s.count
    if (/慢|slow|静|夜|moon|抒情/.test(text)) calm += s.count
  }
  const max = Math.max(happy, sad, energetic, calm)
  if (max === 0) return '平静'
  if (max === happy) return '欢快'
  if (max === sad) return '感伤'
  if (max === energetic) return '活力'
  return '宁静'
}

/** 确定阶段名称 */
const determinePhaseName = (genres: string[], mood: string, topArtist?: string): string => {
  if (genres.length === 0 && !topArtist) return '探索期'
  const mainGenre = genres[0]
  if (mainGenre) {
    const map: Record<string, string> = {
      摇滚: '摇滚热血期',
      流行: '流行追逐期',
      民谣: '民谣沉思期',
      说唱: '说唱律动期',
      电子: '电子迷幻期',
      古典: '古典雅致期',
      'R&B': 'R&B 沉醉期',
    }
    return map[mainGenre] || '多元发展期'
  }
  return `${mood}时期`
}

/** 构建摘要 */
const buildSummary = (
  label: string,
  topSong: { name: string; singer: string; count: number } | undefined,
  topArtist: { name: string; count: number } | undefined,
  totalPlays: number,
  granularity: TimelineGranularity,
): string => {
  const unit = granularity === 'day' ? '当天' : granularity === 'week' ? '本周' : granularity === 'month' ? '本月' : '本年'
  let summary = `${label} ${unit}共播放 ${totalPlays} 次`
  if (topSong) summary += `，最常听《${topSong.name}》(${topSong.count}次)`
  if (topArtist) summary += `，最爱歌手 ${topArtist.name}`
  return summary
}

/** 检测阶段变化 */
const detectPhaseChanges = (entries: TimelineEntry[]): Array<{ from: string; to: string; time: number; desc: string }> => {
  const changes: Array<{ from: string; to: string; time: number; desc: string }> = []
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1]
    const cur = entries[i]
    if (prev.phaseName !== cur.phaseName) {
      changes.push({
        from: prev.phaseName,
        to: cur.phaseName,
        time: cur.start,
        desc: `${prev.label}的"${prev.phaseName}"→ ${cur.label}的"${cur.phaseName}"`,
      })
    }
  }
  return changes
}

/** 获取缓存的报告 */
export const getCachedTimeline = async (): Promise<TimelineReport | null> => {
  const data = await getData<{ report: TimelineReport; generatedAt: number }>(TIMELINE_CACHE_KEY)
  if (!data) return null
  // 缓存24小时有效
  if (Date.now() - data.generatedAt > 24 * 60 * 60 * 1000) return null
  return data.report
}

/** 清除缓存 */
export const clearTimelineCache = async (): Promise<void> => {
  await saveData(TIMELINE_CACHE_KEY, null)
  addDevLog('info', 'MusicTimeline', '缓存已清空')
}

/** 获取时间段描述 */
export const getGranularityName = (g: TimelineGranularity): string => {
  const map: Record<TimelineGranularity, string> = {
    day: '按日',
    week: '按周',
    month: '按月',
    year: '按年',
  }
  return map[g]
}

/** 获取所有粒度选项 */
export const getAllGranularities = (): Array<{ key: TimelineGranularity; name: string; desc: string }> => [
  { key: 'day', name: '按日', desc: '每天的听歌详情' },
  { key: 'week', name: '按周', desc: '每周的听歌聚合' },
  { key: 'month', name: '按月', desc: '每月的听歌趋势（推荐）' },
  { key: 'year', name: '按年', desc: '每年的听歌概览' },
]

/** 生成时间轴文本报告 */
export const generateTextReport = (report: TimelineReport): string => {
  if (report.entries.length === 0) return '📅 暂无听歌历史数据'

  let text = `📅 音乐时间轴报告\n\n`
  text += `📊 总览：${report.entries.length}个时段，共${report.totalPlays}次播放，跨度${report.spanDays}天\n\n`

  if (report.phaseChanges.length > 0) {
    text += `🎭 阶段变化（${report.phaseChanges.length}次）：\n`
    for (const c of report.phaseChanges.slice(0, 5)) {
      text += `  • ${c.desc}\n`
    }
    text += '\n'
  }

  text += `📋 各时段详情：\n`
  for (const e of report.entries) {
    text += `\n【${e.label}】${e.phaseName}\n`
    text += `  ${e.summary}\n`
    if (e.topSongs[0]) {
      text += `  🎵 最爱：《${e.topSongs[0].name}》- ${e.topSongs[0].singer}\n`
    }
    if (e.topArtists[0]) {
      text += `  🎤 歌手：${e.topArtists[0].name} (${e.topArtists[0].count}次)\n`
    }
    text += `  💭 情绪：${e.mood}\n`
  }

  return text
}
