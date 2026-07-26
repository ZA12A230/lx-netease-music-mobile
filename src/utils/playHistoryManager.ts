/**
 * 播放历史管理工具
 * 支持清理旧历史、导出历史记录
 */
import { getPlayHistory, savePlayHistory } from '@/utils/data'
import { toast } from '@/utils/tools'

/**
 * 清除指定天数之前的播放历史
 * @param daysBefore 清除多少天之前的历史
 * @returns 清除的记录数
 */
export const clearOldPlayHistory = async (daysBefore: number = 30): Promise<number> => {
  const history = await getPlayHistory()
  const cutoff = Date.now() - daysBefore * 24 * 60 * 60 * 1000
  const newHistory = history.filter(item => item.playedAt >= cutoff)
  const removedCount = history.length - newHistory.length

  if (removedCount > 0) {
    await savePlayHistory(newHistory)
  }

  return removedCount
}

/**
 * 清除所有播放历史
 * @returns 清除的记录数
 */
export const clearAllPlayHistory = async (): Promise<number> => {
  const history = await getPlayHistory()
  if (history.length > 0) {
    await savePlayHistory([])
  }
  return history.length
}

/**
 * 导出播放历史为JSON
 * @returns JSON格式的历史记录
 */
export const exportPlayHistory = async (): Promise<string> => {
  const history = await getPlayHistory()
  const exportData = history.map(item => ({
    name: item.musicInfo.name,
    singer: item.musicInfo.singer,
    source: item.source,
    playedAt: new Date(item.playedAt).toISOString(),
    playTime: item.playTime,
  }))
  return JSON.stringify(exportData, null, 2)
}

/**
 * 获取播放历史统计信息
 */
export const getPlayHistoryStats = async (): Promise<{
  totalCount: number
  oldestDate: Date | null
  newestDate: Date | null
  daysCovered: number
}> => {
  const history = await getPlayHistory()
  if (history.length === 0) {
    return {
      totalCount: 0,
      oldestDate: null,
      newestDate: null,
      daysCovered: 0,
    }
  }

  const timestamps = history.map(h => h.playedAt)
  const oldest = Math.min(...timestamps)
  const newest = Math.max(...timestamps)
  const daysCovered = Math.ceil((newest - oldest) / (24 * 60 * 60 * 1000))

  return {
    totalCount: history.length,
    oldestDate: new Date(oldest),
    newestDate: new Date(newest),
    daysCovered: Math.max(1, daysCovered),
  }
}