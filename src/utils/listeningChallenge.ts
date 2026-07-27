/**
 * 听歌挑战模块
 * 提供每日/每周听歌挑战目标，激励用户探索新音乐
 */
import { getData, saveData } from '@/plugins/storage'
import { getPlayHistoryByRange } from '@/core/player/playHistory'
import { addDevLog } from './devKit'

export type ChallengeType =
  | 'daily_songs'    // 每日听 N 首歌
  | 'daily_minutes'  // 每日听 N 分钟
  | 'weekly_songs'   // 每周听 N 首歌
  | 'weekly_minutes' // 每周听 N 分钟
  | 'new_artists'    // 探索 N 位新歌手
  | 'new_genres'     // 探索 N 种新流派
  | 'marathon'       // 马拉松：连续听 N 小时
  | 'discovery'      // 发现 N 首未听过的歌

export interface Challenge {
  id: string
  type: ChallengeType
  title: string
  description: string
  icon: string
  target: number
  current: number
  unit: string
  startDate: string
  endDate: string
  completed: boolean
  reward: string
  /** 进度百分比 0-100 */
  progress: number
}

export interface ChallengeHistory {
  id: string
  type: ChallengeType
  title: string
  completedAt: number
  target: number
  actual: number
}

const STORAGE_KEY_ACTIVE = '@challenges_active_v1'
const STORAGE_KEY_HISTORY = '@challenges_history_v1'

const formatDate = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 生成每日挑战 */
const generateDailyChallenges = (): Omit<Challenge, 'current' | 'progress' | 'completed'>[] => {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return [
    {
      id: `daily_songs_${formatDate(today)}`,
      type: 'daily_songs',
      title: '今日听歌',
      description: '今天听完 10 首歌曲',
      icon: '🎵',
      target: 10,
      unit: '首',
      startDate: formatDate(today),
      endDate: formatDate(tomorrow),
      reward: '解锁"日听达人"徽章',
    },
    {
      id: `daily_minutes_${formatDate(today)}`,
      type: 'daily_minutes',
      title: '今日时长',
      description: '今天累计听歌 30 分钟',
      icon: '⏱️',
      target: 30,
      unit: '分钟',
      startDate: formatDate(today),
      endDate: formatDate(tomorrow),
      reward: '解锁"音乐时光"徽章',
    },
    {
      id: `daily_discovery_${formatDate(today)}`,
      type: 'discovery',
      title: '今日发现',
      description: '今天发现 5 首从未听过的歌曲',
      icon: '🔍',
      target: 5,
      unit: '首',
      startDate: formatDate(today),
      endDate: formatDate(tomorrow),
      reward: '解锁"音乐探险家"徽章',
    },
  ]
}

/** 生成每周挑战 */
const generateWeeklyChallenges = (): Omit<Challenge, 'current' | 'progress' | 'completed'>[] => {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  const nextMonday = new Date(monday)
  nextMonday.setDate(monday.getDate() + 7)

  return [
    {
      id: `weekly_songs_${formatDate(monday)}`,
      type: 'weekly_songs',
      title: '本周听歌',
      description: '本周听完 50 首歌曲',
      icon: '📚',
      target: 50,
      unit: '首',
      startDate: formatDate(monday),
      endDate: formatDate(nextMonday),
      reward: '解锁"周听王者"徽章',
    },
    {
      id: `weekly_minutes_${formatDate(monday)}`,
      type: 'weekly_minutes',
      title: '本周时长',
      description: '本周累计听歌 300 分钟',
      icon: '⏰',
      target: 300,
      unit: '分钟',
      startDate: formatDate(monday),
      endDate: formatDate(nextMonday),
      reward: '解锁"音乐迷"徽章',
    },
    {
      id: `weekly_artists_${formatDate(monday)}`,
      type: 'new_artists',
      title: '探索新歌手',
      description: '本周探索 5 位从未听过的歌手',
      icon: '🎤',
      target: 5,
      unit: '位',
      startDate: formatDate(monday),
      endDate: formatDate(nextMonday),
      reward: '解锁"音乐探险家"徽章',
    },
    {
      id: `weekly_marathon_${formatDate(monday)}`,
      type: 'marathon',
      title: '听歌马拉松',
      description: '本周连续听歌 2 小时（不间断）',
      icon: '🏃',
      target: 120,
      unit: '分钟',
      startDate: formatDate(monday),
      endDate: formatDate(nextMonday),
      reward: '解锁"马拉松选手"徽章',
    },
  ]
}

/** 获取所有挑战 */
export const getAllChallenges = async (): Promise<Challenge[]> => {
  const data = await getData<Challenge[]>(STORAGE_KEY_ACTIVE)
  return data || []
}

/** 初始化今日挑战 */
export const initDailyChallenges = async (): Promise<void> => {
  const all = await getAllChallenges()
  const today = formatDate(new Date())

  // 移除过期的挑战（移到历史）
  const active: Challenge[] = []
  const expired: Challenge[] = []
  for (const c of all) {
    if (c.endDate < today && !c.completed) {
      expired.push(c)
    } else {
      active.push(c)
    }
  }

  // 把过期的存到历史
  if (expired.length > 0) {
    const history = await getChallengeHistory()
    for (const c of expired) {
      history.push({
        id: c.id,
        type: c.type,
        title: c.title,
        completedAt: Date.now(),
        target: c.target,
        actual: c.current,
      })
    }
    await saveData(STORAGE_KEY_HISTORY, history.slice(-500))
  }

  // 检查今日挑战是否已存在
  const todayChallenges = active.filter((c) => c.startDate === today)
  if (todayChallenges.length === 0) {
    // 生成新挑战
    const dailyTemplates = generateDailyChallenges()
    const weeklyTemplates = generateWeeklyChallenges()

    // 检查本周挑战是否已存在
    const monday = new Date()
    const day = monday.getDay() || 7
    monday.setDate(monday.getDate() - day + 1)
    const mondayStr = formatDate(monday)
    const weeklyExists = active.some((c) => c.startDate === mondayStr && c.type.startsWith('weekly'))

    const newChallenges: Challenge[] = [
      ...dailyTemplates.map((t) => ({ ...t, current: 0, progress: 0, completed: false })),
      ...(weeklyExists ? [] : weeklyTemplates.map((t) => ({ ...t, current: 0, progress: 0, completed: false }))),
    ]

    await saveData(STORAGE_KEY_ACTIVE, [...active, ...newChallenges])
    addDevLog('info', 'Challenge', `初始化了${newChallenges.length}个新挑战`)
  }
}

/** 更新挑战进度 */
export const updateChallengeProgress = async (): Promise<Challenge[]> => {
  const all = await getAllChallenges()
  if (all.length === 0) return []

  const today = formatDate(new Date())
  const now = Date.now()

  for (const challenge of all) {
    if (challenge.completed) continue

    try {
      // 根据挑战类型计算进度
      if (challenge.type === 'daily_songs' || challenge.type === 'weekly_songs') {
        const isDaily = challenge.type === 'daily_songs'
        const start = isDaily ? new Date(today).getTime() : new Date(challenge.startDate).getTime()
        const end = isDaily ? start + 24 * 60 * 60 * 1000 : new Date(challenge.endDate).getTime()
        const history = await getPlayHistoryByRange(start, end)
        challenge.current = history.length
      } else if (challenge.type === 'daily_minutes' || challenge.type === 'weekly_minutes') {
        const isDaily = challenge.type === 'daily_minutes'
        const start = isDaily ? new Date(today).getTime() : new Date(challenge.startDate).getTime()
        const end = isDaily ? start + 24 * 60 * 60 * 1000 : new Date(challenge.endDate).getTime()
        const history = await getPlayHistoryByRange(start, end)
        challenge.current = Math.floor(history.reduce((sum, h) => sum + h.playTime, 0) / 60)
      } else if (challenge.type === 'discovery') {
        // 今日发现的新歌
        const start = new Date(today).getTime()
        const end = start + 24 * 60 * 60 * 1000
        const history = await getPlayHistoryByRange(start, end)
        // 获取所有听过的歌
        const allHistory = await getPlayHistoryByRange(0, start)
        const heardIds = new Set(allHistory.map((h) => h.musicInfo.id))
        const newSongs = history.filter((h) => !heardIds.has(h.musicInfo.id))
        challenge.current = newSongs.length
      } else if (challenge.type === 'new_artists') {
        // 本周新歌手
        const start = new Date(challenge.startDate).getTime()
        const end = new Date(challenge.endDate).getTime()
        const history = await getPlayHistoryByRange(start, end)
        const prevHistory = await getPlayHistoryByRange(0, start)
        const prevArtists = new Set(prevHistory.map((h) => h.musicInfo.singer))
        const newArtists = new Set(history.map((h) => h.musicInfo.singer))
        let count = 0
        for (const artist of newArtists) {
          if (!prevArtists.has(artist)) count++
        }
        challenge.current = count
      }
      // marathon 需要实时监测，这里简化处理

      challenge.progress = Math.min(100, Math.round((challenge.current / challenge.target) * 100))
      if (challenge.current >= challenge.target) {
        challenge.completed = true
        addDevLog('info', 'Challenge', `挑战完成: ${challenge.title}`)
      }
    } catch (e) {
      // 静默处理
    }
  }

  await saveData(STORAGE_KEY_ACTIVE, all)
  return all
}

/** 获取挑战历史 */
export const getChallengeHistory = async (): Promise<ChallengeHistory[]> => {
  const data = await getData<ChallengeHistory[]>(STORAGE_KEY_HISTORY)
  return data || []
}

/** 获取完成统计 */
export const getCompletionStats = async (): Promise<{
  totalCompleted: number
  thisMonthCompleted: number
  thisWeekCompleted: number
  byType: Record<ChallengeType, number>
}> => {
  const history = await getChallengeHistory()
  const now = Date.now()
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const weekStart = new Date()
  const day = weekStart.getDay() || 7
  weekStart.setDate(weekStart.getDate() - day + 1)
  weekStart.setHours(0, 0, 0, 0)

  const byType: Record<ChallengeType, number> = {
    daily_songs: 0, daily_minutes: 0, weekly_songs: 0, weekly_minutes: 0,
    new_artists: 0, new_genres: 0, marathon: 0, discovery: 0,
  }

  for (const h of history) {
    byType[h.type]++
  }

  return {
    totalCompleted: history.length,
    thisMonthCompleted: history.filter((h) => h.completedAt >= monthStart.getTime()).length,
    thisWeekCompleted: history.filter((h) => h.completedAt >= weekStart.getTime()).length,
    byType,
  }
}

/** 重置所有挑战（开发者功能） */
export const resetAllChallenges = async (): Promise<void> => {
  await saveData(STORAGE_KEY_ACTIVE, [])
  await saveData(STORAGE_KEY_HISTORY, [])
  addDevLog('info', 'Challenge', '所有挑战已重置')
}

/** 获取徽章列表 */
export const getBadges = async (): Promise<Array<{ id: string; name: string; icon: string; unlocked: boolean }>> => {
  const history = await getChallengeHistory()
  const completedTypes = new Set(history.map((h) => h.type))

  return [
    { id: 'daily_master', name: '日听达人', icon: '🎖️', unlocked: completedTypes.has('daily_songs') },
    { id: 'time_master', name: '音乐时光', icon: '⏰', unlocked: completedTypes.has('daily_minutes') },
    { id: 'explorer', name: '音乐探险家', icon: '🗺️', unlocked: completedTypes.has('discovery') },
    { id: 'weekly_king', name: '周听王者', icon: '👑', unlocked: completedTypes.has('weekly_songs') },
    { id: 'music_fan', name: '音乐迷', icon: '💖', unlocked: completedTypes.has('weekly_minutes') },
    { id: 'artist_explorer', name: '歌手探索者', icon: '🎤', unlocked: completedTypes.has('new_artists') },
    { id: 'marathon_runner', name: '马拉松选手', icon: '🏃', unlocked: completedTypes.has('marathon') },
    { id: 'all_round', name: '全能音乐家', icon: '🏆', unlocked: completedTypes.size >= 6 },
  ]
}
