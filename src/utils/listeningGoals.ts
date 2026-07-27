/**
 * 听歌目标打卡模块
 * 用户自定义听歌目标，每日打卡完成
 */
import { getData, saveData } from '@/plugins/storage'
import { getPlayHistoryByRange } from '@/core/player/playHistory'
import { addDevLog } from './devKit'

export type GoalPeriod = 'daily' | 'weekly' | 'monthly'
export type GoalMetric = 'songs' | 'minutes' | 'artists' | 'genres'

export interface ListeningGoal {
  id: string
  period: GoalPeriod
  metric: GoalMetric
  target: number
  enabled: boolean
  createdAt: number
  /** 历史完成记录 */
  history: Array<{
    date: string
    actual: number
    target: number
    completed: boolean
  }>
}

export interface GoalProgress {
  goal: ListeningGoal
  current: number
  target: number
  progress: number // 0-100
  completed: boolean
  remaining: number
  remainingDays: number
}

const STORAGE_KEY = '@listening_goals_v1'

const formatDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** 获取周期开始时间 */
const getPeriodStart = (period: GoalPeriod): number => {
  const now = new Date()
  if (period === 'daily') {
    now.setHours(0, 0, 0, 0)
  } else if (period === 'weekly') {
    const day = now.getDay() || 7
    now.setDate(now.getDate() - day + 1)
    now.setHours(0, 0, 0, 0)
  } else {
    now.setDate(1)
    now.setHours(0, 0, 0, 0)
  }
  return now.getTime()
}

/** 获取周期结束时间 */
const getPeriodEnd = (period: GoalPeriod): number => {
  const now = new Date()
  if (period === 'daily') {
    now.setHours(23, 59, 59, 999)
  } else if (period === 'weekly') {
    const day = now.getDay() || 7
    now.setDate(now.getDate() - day + 7)
    now.setHours(23, 59, 59, 999)
  } else {
    now.setMonth(now.getMonth() + 1, 0)
    now.setHours(23, 59, 59, 999)
  }
  return now.getTime()
}

/** 获取所有目标 */
export const getAllGoals = async (): Promise<ListeningGoal[]> => {
  const data = await getData<ListeningGoal[]>(STORAGE_KEY)
  return data || []
}

/** 创建听歌目标 */
export const createGoal = async (
  period: GoalPeriod,
  metric: GoalMetric,
  target: number,
): Promise<string> => {
  const all = await getAllGoals()
  const id = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  const goal: ListeningGoal = {
    id,
    period,
    metric,
    target,
    enabled: true,
    createdAt: Date.now(),
    history: [],
  }

  all.push(goal)
  await saveData(STORAGE_KEY, all)
  addDevLog('info', 'Goals', `创建目标: ${period} ${metric} ${target}`)
  return id
}

/** 删除目标 */
export const deleteGoal = async (id: string): Promise<void> => {
  const all = await getAllGoals()
  await saveData(STORAGE_KEY, all.filter((g) => g.id !== id))
}

/** 切换目标启用状态 */
export const toggleGoal = async (id: string, enabled: boolean): Promise<void> => {
  const all = await getAllGoals()
  const goal = all.find((g) => g.id === id)
  if (goal) {
    goal.enabled = enabled
    await saveData(STORAGE_KEY, all)
  }
}

/** 更新目标 */
export const updateGoal = async (id: string, updates: Partial<ListeningGoal>): Promise<void> => {
  const all = await getAllGoals()
  const idx = all.findIndex((g) => g.id === id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates }
    await saveData(STORAGE_KEY, all)
  }
}

/** 获取目标进度 */
export const getGoalProgress = async (goal: ListeningGoal): Promise<GoalProgress> => {
  const start = getPeriodStart(goal.period)
  const end = getPeriodEnd(goal.period)
  const history = await getPlayHistoryByRange(start, end)

  let current = 0
  switch (goal.metric) {
    case 'songs':
      current = history.length
      break
    case 'minutes':
      current = Math.floor(history.reduce((sum, h) => sum + h.playTime, 0) / 60)
      break
    case 'artists': {
      const artists = new Set(history.map((h) => h.musicInfo.singer))
      current = artists.size
      break
    }
    case 'genres': {
      // 简化处理：按歌手分组
      const genres = new Set(history.map((h) => h.musicInfo.singer))
      current = genres.size
      break
    }
  }

  const progress = Math.min(100, Math.round((current / goal.target) * 100))
  const completed = current >= goal.target
  const remaining = Math.max(0, goal.target - current)

  // 计算剩余天数
  const now = Date.now()
  const remainingMs = end - now
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))

  return {
    goal,
    current,
    target: goal.target,
    progress,
    completed,
    remaining,
    remainingDays,
  }
}

/** 获取所有目标进度 */
export const getAllGoalsProgress = async (): Promise<GoalProgress[]> => {
  const all = await getAllGoals()
  const enabled = all.filter((g) => g.enabled)
  return Promise.all(enabled.map((g) => getGoalProgress(g)))
}

/** 归档已完成的目标到历史 */
export const archiveCompletedGoals = async (): Promise<void> => {
  const all = await getAllGoals()
  const today = formatDate(new Date())

  for (const goal of all) {
    const progress = await getGoalProgress(goal)
    // 检查今天是否已记录
    const todayRecord = goal.history.find((h) => h.date === today)
    if (!todayRecord) {
      goal.history.push({
        date: today,
        actual: progress.current,
        target: goal.target,
        completed: progress.completed,
      })
      // 保留最近 90 天
      goal.history = goal.history.slice(-90)
    }
  }

  await saveData(STORAGE_KEY, all)
}

/** 获取连续打卡天数 */
export const getStreakDays = async (goalId: string): Promise<number> => {
  const all = await getAllGoals()
  const goal = all.find((g) => g.id === goalId)
  if (!goal) return 0

  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = formatDate(date)
    const record = goal.history.find((h) => h.date === dateStr)
    if (record?.completed) {
      streak++
    } else if (i > 0) {
      // 今天还没完成不算断
      break
    }
  }
  return streak
}

/** 获取目标完成率 */
export const getCompletionRate = async (goalId: string, days = 30): Promise<number> => {
  const all = await getAllGoals()
  const goal = all.find((g) => g.id === goalId)
  if (!goal || goal.history.length === 0) return 0

  const recent = goal.history.slice(-days)
  const completed = recent.filter((h) => h.completed).length
  return Math.round((completed / recent.length) * 100)
}

/** 预设目标模板 */
export const GOAL_TEMPLATES: Array<{
  period: GoalPeriod
  metric: GoalMetric
  target: number
  name: string
  icon: string
}> = [
  { period: 'daily', metric: 'songs', target: 10, name: '每日听10首歌', icon: '🎵' },
  { period: 'daily', metric: 'minutes', target: 30, name: '每日听30分钟', icon: '⏱️' },
  { period: 'daily', metric: 'artists', target: 3, name: '每日听3位新歌手', icon: '🎤' },
  { period: 'weekly', metric: 'songs', target: 50, name: '每周听50首歌', icon: '📚' },
  { period: 'weekly', metric: 'minutes', target: 300, name: '每周听5小时', icon: '⏰' },
  { period: 'weekly', metric: 'artists', target: 5, name: '每周探索5位歌手', icon: '🌍' },
  { period: 'monthly', metric: 'songs', target: 200, name: '每月听200首歌', icon: '🏆' },
  { period: 'monthly', metric: 'minutes', target: 1200, name: '每月听20小时', icon: '👑' },
]
