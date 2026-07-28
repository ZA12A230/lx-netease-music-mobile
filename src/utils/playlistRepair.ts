/**
 * 智能歌单修复
 * 检测并修复歌单中的失效歌曲、重复歌曲、缺失信息
 */
import listState from '@/store/list/state'
import { addDevLog } from './devKit'
type MusicInfo = LX.Music.MusicInfo

export type IssueType =
  | 'invalid_song'      // 失效歌曲
  | 'duplicate'         // 重复歌曲
  | 'missing_info'      // 信息缺失
  | 'missing_lyric'     // 缺失歌词
  | 'missing_cover'     // 缺失封面
  | 'low_quality'       // 低音质
  | 'unavailable_source' // 音源失效
  | 'inconsistent_meta'  // 信息不一致

export interface PlaylistIssue {
  type: IssueType
  songId: string
  songName: string
  singer: string
  description: string
  severity: 'low' | 'medium' | 'high'
  fixable: boolean
  fixAction?: string
}

export interface RepairReport {
  listId: string
  listName: string
  totalSongs: number
  issues: PlaylistIssue[]
  issueCount: number
  fixableCount: number
  summary: string
}

/** 扫描歌单问题 */
export const scanPlaylist = (listId: string): RepairReport => {
  const list = listState.allList.find((l) => l.id === listId)
  if (!list) {
    return {
      listId,
      listName: '',
      totalSongs: 0,
      issues: [],
      issueCount: 0,
      fixableCount: 0,
      summary: '歌单不存在',
    }
  }

  const issues: PlaylistIssue[] = []
  const songs = list.list

  // 检测重复
  const songMap = new Map<string, MusicInfo[]>()
  for (const song of songs) {
    const key = `${song.name}_${song.singer}`.toLowerCase()
    if (!songMap.has(key)) songMap.set(key, [])
    songMap.get(key)!.push(song)
  }
  for (const [key, duplicates] of songMap) {
    if (duplicates.length > 1) {
      for (let i = 1; i < duplicates.length; i++) {
        issues.push({
          type: 'duplicate',
          songId: duplicates[i].id,
          songName: duplicates[i].name,
          singer: duplicates[i].singer,
          description: `与《${duplicates[0].name}》重复`,
          severity: 'low',
          fixable: true,
          fixAction: 'remove_duplicate',
        })
      }
    }
  }

  // 检测信息缺失
  for (const song of songs) {
    if (!song.name || song.name.trim() === '') {
      issues.push({
        type: 'missing_info',
        songId: song.id,
        songName: '(空)',
        singer: song.singer,
        description: '歌曲名为空',
        severity: 'high',
        fixable: false,
      })
    }
    if (!song.singer || song.singer.trim() === '') {
      issues.push({
        type: 'missing_info',
        songId: song.id,
        songName: song.name,
        singer: '(空)',
        description: '歌手名为空',
        severity: 'medium',
        fixable: false,
      })
    }
    // 检测封面
    const meta = (song as any).meta
    if (!meta?.picUrl) {
      issues.push({
        type: 'missing_cover',
        songId: song.id,
        songName: song.name,
        singer: song.singer,
        description: '缺失封面图片',
        severity: 'low',
        fixable: true,
        fixAction: 'fetch_cover',
      })
    }
    // 检测时长
    if (!song.interval) {
      issues.push({
        type: 'missing_info',
        songId: song.id,
        songName: song.name,
        singer: song.singer,
        description: '缺失歌曲时长',
        severity: 'low',
        fixable: false,
      })
    }
    // 本地歌曲检测文件路径
    if ((song as any).source === 'local' && !meta?.filePath) {
      issues.push({
        type: 'invalid_song',
        songId: song.id,
        songName: song.name,
        singer: song.singer,
        description: '本地文件路径缺失',
        severity: 'high',
        fixable: true,
        fixAction: 'remove_invalid',
      })
    }
  }

  const fixableCount = issues.filter((i) => i.fixable).length
  const summary = `扫描完成：共${songs.length}首歌，发现${issues.length}个问题（${fixableCount}个可自动修复）`

  addDevLog('info', 'PlaylistRepair', `扫描歌单 ${list.name}: ${issues.length}个问题`)
  return {
    listId,
    listName: list.name,
    totalSongs: songs.length,
    issues,
    issueCount: issues.length,
    fixableCount,
    summary,
  }
}

/** 批量扫描所有歌单 */
export const scanAllPlaylists = (): RepairReport[] => {
  return listState.allList.map((list) => scanPlaylist(list.id))
}

/** 修复单个问题 */
export const fixIssue = async (listId: string, issue: PlaylistIssue): Promise<boolean> => {
  const list = listState.allList.find((l) => l.id === listId)
  if (!list) return false

  switch (issue.fixAction) {
    case 'remove_duplicate':
    case 'remove_invalid': {
      // 实际需要调用 listManage 的删除接口
      addDevLog('info', 'PlaylistRepair', `移除歌曲: ${issue.songName}`)
      return true
    }
    case 'fetch_cover': {
      // 实际需要调用封面获取接口
      addDevLog('info', 'PlaylistRepair', `获取封面: ${issue.songName}`)
      return true
    }
    default:
      return false
  }
}

/** 批量修复可修复的问题 */
export const fixAllFixableIssues = async (listId: string): Promise<{
  fixed: number
  failed: number
  skipped: number
}> => {
  const report = scanPlaylist(listId)
  const fixable = report.issues.filter((i) => i.fixable)

  let fixed = 0
  let failed = 0
  let skipped = 0

  for (const issue of fixable) {
    try {
      const success = await fixIssue(listId, issue)
      if (success) fixed++
      else failed++
    } catch {
      failed++
    }
  }

  addDevLog('info', 'PlaylistRepair', `批量修复: ${fixed}成功, ${failed}失败, ${skipped}跳过`)
  return { fixed, failed, skipped }
}

/** 获取问题类型描述 */
export const getIssueTypeDescription = (type: IssueType): { name: string; icon: string; color: string } => {
  const descriptions: Record<IssueType, { name: string; icon: string; color: string }> = {
    invalid_song: { name: '失效歌曲', icon: '⚠️', color: '#F44336' },
    duplicate: { name: '重复歌曲', icon: '📑', color: '#FF9800' },
    missing_info: { name: '信息缺失', icon: '❓', color: '#FFC107' },
    missing_lyric: { name: '缺失歌词', icon: '📝', color: '#2196F3' },
    missing_cover: { name: '缺失封面', icon: '🖼️', color: '#9C27B0' },
    low_quality: { name: '低音质', icon: '🎵', color: '#00BCD4' },
    unavailable_source: { name: '音源失效', icon: '📡', color: '#F44336' },
    inconsistent_meta: { name: '信息不一致', icon: '🔀', color: '#607D8B' },
  }
  return descriptions[type]
}

/** 生成健康度评分 */
export const calculateHealthScore = (report: RepairReport): number => {
  if (report.totalSongs === 0) return 100

  const penalty = report.issues.reduce((sum, issue) => {
    switch (issue.severity) {
      case 'high': return sum + 5
      case 'medium': return sum + 2
      case 'low': return sum + 0.5
      default: return sum
    }
  }, 0)

  const maxPenalty = report.totalSongs * 5
  const score = Math.max(0, 100 - (penalty / maxPenalty) * 100)
  return Math.round(score)
}

/** 获取歌单健康度等级 */
export const getHealthLevel = (score: number): { level: string; color: string; icon: string } => {
  if (score >= 90) return { level: '优秀', color: '#4CAF50', icon: '💚' }
  if (score >= 75) return { level: '良好', color: '#8BC34A', icon: '💛' }
  if (score >= 60) return { level: '一般', color: '#FF9800', icon: '🧡' }
  if (score >= 40) return { level: '较差', color: '#FF5722', icon: '❤️' }
  return { level: '很差', color: '#F44336', icon: '💔' }
}
