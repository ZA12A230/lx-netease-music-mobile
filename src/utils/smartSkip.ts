/**
 * 智能跳过模块
 * 基于用户行为自动跳过不喜欢的歌曲
 */
import TrackPlayer from 'react-native-track-player'
import { getData, saveData } from '@/plugins/storage'
import playerState from '@/store/player/state'
import { addDevLog } from './devKit'

export interface SkipRule {
  id: string
  enabled: boolean
  type: 'artist' | 'song' | 'genre' | 'duration' | 'time'
  /** 规则值 */
  value: string
  /** 规则描述 */
  description: string
  /** 跳过次数 */
  skipCount: number
  /** 创建时间 */
  createdAt: number
}

export interface SkipStats {
  totalSkips: number
  todaySkips: number
  topSkippedArtists: Array<{ artist: string; count: number }>
  topSkippedSongs: Array<{ name: string; singer: string; count: number }>
  /** 自动跳过节省的时间（秒） */
  timeSaved: number
}

interface SkipRecord {
  id: string
  songId: string
  songName: string
  singer: string
  timestamp: number
  /** 跳过前播放的秒数 */
  playedSeconds: number
  /** 总时长 */
  totalSeconds: number
  reason: 'manual' | 'auto' | 'rule'
  ruleId?: string
}

const RULES_KEY = '@skip_rules_v1'
const RECORDS_KEY = '@skip_records_v1'
const MAX_RECORDS = 2000

let autoSkipEnabled = true

/** 获取所有跳过规则 */
export const getAllSkipRules = async (): Promise<SkipRule[]> => {
  const data = await getData<SkipRule[]>(RULES_KEY)
  return data || []
}

/** 添加跳过规则 */
export const addSkipRule = async (
  type: SkipRule['type'],
  value: string,
  description?: string,
): Promise<string> => {
  const all = await getAllSkipRules()
  const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  // 避免重复规则
  const exists = all.some((r) => r.type === type && r.value === value)
  if (exists) {
    throw new Error('规则已存在')
  }

  const rule: SkipRule = {
    id,
    enabled: true,
    type,
    value,
    description: description || getDefaultDescription(type, value),
    skipCount: 0,
    createdAt: Date.now(),
  }

  all.push(rule)
  await saveData(RULES_KEY, all)
  addDevLog('info', 'SmartSkip', `添加跳过规则: ${rule.description}`)
  return id
}

const getDefaultDescription = (type: SkipRule['type'], value: string): string => {
  switch (type) {
    case 'artist': return `跳过 ${value} 的歌曲`
    case 'song': return `跳过歌曲: ${value}`
    case 'genre': return `跳过流派: ${value}`
    case 'duration': return `跳过时长超过 ${value} 秒的歌曲`
    case 'time': return `跳过 ${value} 时段`
    default: return `跳过规则: ${value}`
  }
}

/** 删除跳过规则 */
export const deleteSkipRule = async (id: string): Promise<void> => {
  const all = await getAllSkipRules()
  const filtered = all.filter((r) => r.id !== id)
  await saveData(RULES_KEY, filtered)
}

/** 切换规则启用状态 */
export const toggleSkipRule = async (id: string, enabled: boolean): Promise<void> => {
  const all = await getAllSkipRules()
  const rule = all.find((r) => r.id === id)
  if (rule) {
    rule.enabled = enabled
    await saveData(RULES_KEY, all)
  }
}

/** 检查当前歌曲是否应该被跳过 */
export const shouldSkipCurrentSong = async (): Promise<{ shouldSkip: boolean; rule?: SkipRule; reason?: string }> => {
  if (!autoSkipEnabled) return { shouldSkip: false }

  const musicInfo = playerState.playMusicInfo.musicInfo as any
  if (!musicInfo) return { shouldSkip: false }

  const rules = await getAllSkipRules()
  const enabledRules = rules.filter((r) => r.enabled)

  for (const rule of enabledRules) {
    let match = false
    switch (rule.type) {
      case 'artist':
        match = musicInfo.singer === rule.value ||
               musicInfo.singer?.includes(rule.value) ||
               rule.value.includes(musicInfo.singer)
        break
      case 'song':
        match = musicInfo.name === rule.value ||
               musicInfo.name?.includes(rule.value)
        break
      case 'genre':
        // 简单基于歌名匹配
        match = (musicInfo.name + ' ' + musicInfo.singer).toLowerCase().includes(rule.value.toLowerCase())
        break
      case 'duration':
        try {
          const duration = await TrackPlayer.getDuration()
          if (duration > parseInt(rule.value, 10)) match = true
        } catch (e) {
          // 静默处理
        }
        break
      case 'time': {
        const now = new Date()
        const hour = now.getHours()
        const parts = rule.value.split('-')
        if (parts.length === 2) {
          const start = parseInt(parts[0], 10)
          const end = parseInt(parts[1], 10)
          if (start <= end) {
            match = hour >= start && hour < end
          } else {
            match = hour >= start || hour < end
          }
        }
        break
      }
    }

    if (match) {
      return { shouldSkip: true, rule, reason: rule.description }
    }
  }

  return { shouldSkip: false }
}

/** 记录跳过行为 */
export const recordSkip = async (
  songId: string,
  songName: string,
  singer: string,
  playedSeconds: number,
  totalSeconds: number,
  reason: SkipRecord['reason'] = 'manual',
  ruleId?: string,
): Promise<void> => {
  const data = await getData<SkipRecord[]>(RECORDS_KEY)
  const records = data || []

  const record: SkipRecord = {
    id: `skip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    songId,
    songName,
    singer,
    timestamp: Date.now(),
    playedSeconds,
    totalSeconds,
    reason,
    ruleId,
  }

  records.unshift(record)
  if (records.length > MAX_RECORDS) records.length = MAX_RECORDS

  await saveData(RECORDS_KEY, records)

  // 如果触发了规则，增加规则计数
  if (ruleId) {
    const all = await getAllSkipRules()
    const rule = all.find((r) => r.id === ruleId)
    if (rule) {
      rule.skipCount++
      await saveData(RULES_KEY, all)
    }
  }
}

/** 自动学习：当用户多次手动跳过同一首歌/歌手时自动添加规则 */
export const autoLearnFromSkips = async (): Promise<SkipRule[]> => {
  const data = await getData<SkipRecord[]>(RECORDS_KEY)
  const records = (data || []).filter((r) => r.reason === 'manual')

  const artistSkips = new Map<string, number>()
  const songSkips = new Map<string, { name: string; singer: string; count: number }>()

  for (const r of records) {
    if (r.playedSeconds < 5) { // 5秒内跳过表示强烈不喜欢
      artistSkips.set(r.singer, (artistSkips.get(r.singer) || 0) + 1)
      const key = `${r.songName}_${r.singer}`
      if (songSkips.has(key)) {
        songSkips.get(key)!.count++
      } else {
        songSkips.set(key, { name: r.songName, singer: r.singer, count: 1 })
      }
    }
  }

  const newRules: SkipRule[] = []
  const existingRules = await getAllSkipRules()

  // 同一歌手被跳过 3 次以上自动添加规则
  for (const [artist, count] of artistSkips) {
    if (count >= 3 && !existingRules.some((r) => r.type === 'artist' && r.value === artist)) {
      try {
        const id = await addSkipRule('artist', artist, `自动学习：跳过 ${artist}（已跳过${count}次）`)
        const rule = (await getAllSkipRules()).find((r) => r.id === id)
        if (rule) newRules.push(rule)
      } catch (e) {
        // 静默处理
      }
    }
  }

  // 同一首歌被跳过 2 次以上自动添加规则
  for (const [, info] of songSkips) {
    if (info.count >= 2 && !existingRules.some((r) => r.type === 'song' && r.value === info.name)) {
      try {
        const id = await addSkipRule('song', info.name, `自动学习：跳过《${info.name}》（已跳过${info.count}次）`)
        const rule = (await getAllSkipRules()).find((r) => r.id === id)
        if (rule) newRules.push(rule)
      } catch (e) {
        // 静默处理
      }
    }
  }

  if (newRules.length > 0) {
    addDevLog('info', 'SmartSkip', `自动学习添加了${newRules.length}条规则`)
  }

  return newRules
}

/** 获取跳过统计 */
export const getSkipStats = async (): Promise<SkipStats> => {
  const data = await getData<SkipRecord[]>(RECORDS_KEY)
  const records = data || []

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const artistMap = new Map<string, number>()
  const songMap = new Map<string, { name: string; singer: string; count: number }>()
  let timeSaved = 0

  for (const r of records) {
    // 估算节省的时间（总时长 - 已播放时长）
    timeSaved += Math.max(0, r.totalSeconds - r.playedSeconds)

    artistMap.set(r.singer, (artistMap.get(r.singer) || 0) + 1)
    const key = `${r.songName}_${r.singer}`
    if (songMap.has(key)) {
      songMap.get(key)!.count++
    } else {
      songMap.set(key, { name: r.songName, singer: r.singer, count: 1 })
    }
  }

  return {
    totalSkips: records.length,
    todaySkips: records.filter((r) => r.timestamp >= today.getTime()).length,
    topSkippedArtists: Array.from(artistMap.entries())
      .map(([artist, count]) => ({ artist, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topSkippedSongs: Array.from(songMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    timeSaved,
  }
}

/** 启用/禁用自动跳过 */
export const setAutoSkipEnabled = (enabled: boolean) => {
  autoSkipEnabled = enabled
  addDevLog('info', 'SmartSkip', `自动跳过${enabled ? '已启用' : '已禁用'}`)
}

export const isAutoSkipEnabled = (): boolean => autoSkipEnabled

/** 清空跳过记录 */
export const clearSkipRecords = async (): Promise<void> => {
  await saveData(RECORDS_KEY, [])
  addDevLog('info', 'SmartSkip', '跳过记录已清空')
}
