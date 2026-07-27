/**
 * 播放器崩溃自动恢复机制
 * 当播放器遇到错误时自动尝试恢复播放
 */
import playerState from '@/store/player/state'
import { isInitialized, initial as playerInitial } from '@/plugins/player'
import { setPlayMusicInfo, getList, setPlayListId } from '@/core/player/playInfo'
import { handlePlay } from '@/core/player/player'
import settingState from '@/store/setting/state'
import { checkNotificationPermission } from '@/utils/tools'
import { checkIgnoringBatteryOptimization } from '@/utils/tools'

/** 播放器错误类型 */
export enum PlayerErrorType {
  NETWORK = 'network',
  DECODE = 'decode',
  SOURCE = 'source',
  UNKNOWN = 'unknown',
}

/** 播放器错误记录 */
interface PlayerErrorRecord {
  type: PlayerErrorType
  message: string
  timestamp: number
  musicInfoId: string | null
}

/** 错误历史（用于判断是否需要跳过当前歌曲） */
const errorHistory: PlayerErrorRecord[] = []
const MAX_ERROR_HISTORY = 10
const MAX_SAME_SONG_ERRORS = 3

/** 恢复状态 */
let recoveryInProgress = false
let lastRecoveryTime = 0
const MIN_RECOVERY_INTERVAL = 5000 // 最小恢复间隔5秒

/**
 * 记录播放器错误
 */
export const recordPlayerError = (type: PlayerErrorType, message: string) => {
  const musicInfo = playerState.playMusicInfo.musicInfo
  const record: PlayerErrorRecord = {
    type,
    message,
    timestamp: Date.now(),
    musicInfoId: musicInfo?.id ?? null,
  }

  errorHistory.push(record)
  if (errorHistory.length > MAX_ERROR_HISTORY) {
    errorHistory.shift()
  }

  return record
}

/**
 * 检查当前歌曲是否错误过多（需要跳过）
 */
export const shouldSkipCurrentSong = (): boolean => {
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (!musicInfo) return false

  const currentSongErrors = errorHistory.filter(
    r => r.musicInfoId === musicInfo.id &&
      Date.now() - r.timestamp < 60000 // 1分钟内的错误
  )

  return currentSongErrors.length >= MAX_SAME_SONG_ERRORS
}

/**
 * 获取错误类型
 */
export const classifyError = (error: any): PlayerErrorType => {
  const msg = error?.message?.toLowerCase() || ''
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('too many')) {
    return PlayerErrorType.NETWORK
  }
  if (msg.includes('decode') || msg.includes('codec') || msg.includes('format')) {
    return PlayerErrorType.DECODE
  }
  if (msg.includes('source') || msg.includes('url') || msg.includes('not found') || msg.includes('404')) {
    return PlayerErrorType.SOURCE
  }
  return PlayerErrorType.UNKNOWN
}

/**
 * 尝试恢复播放
 * @returns 是否成功恢复
 */
export const tryRecoverPlayer = async (): Promise<boolean> => {
  if (recoveryInProgress) return false

  const now = Date.now()
  if (now - lastRecoveryTime < MIN_RECOVERY_INTERVAL) {
    console.log('恢复间隔太短，跳过本次恢复')
    return false
  }

  recoveryInProgress = true
  lastRecoveryTime = now

  try {
    console.log('[PlayerRecovery] 开始尝试恢复播放...')

    // 1. 检查是否需要重新初始化播放器
    if (!isInitialized()) {
      console.log('[PlayerRecovery] 播放器未初始化，重新初始化...')
      await checkNotificationPermission()
      void checkIgnoringBatteryOptimization()
      await playerInitial({
        volume: settingState.setting['player.volume'],
        playRate: settingState.setting['player.playbackRate'],
        cacheSize: settingState.setting['player.cacheSize']
          ? parseInt(settingState.setting['player.cacheSize'])
          : 0,
        isHandleAudioFocus: settingState.setting['player.isHandleAudioFocus'],
        isEnableAudioOffload: settingState.setting['player.isEnableAudioOffload'],
      })
    }

    // 2. 检查是否有当前播放的歌曲
    const musicInfo = playerState.playMusicInfo.musicInfo
    if (!musicInfo) {
      console.log('[PlayerRecovery] 没有正在播放的歌曲')
      return false
    }

    // 3. 检查是否需要跳过当前歌曲
    if (shouldSkipCurrentSong()) {
      console.log('[PlayerRecovery] 当前歌曲错误过多，跳过')
      global.lx.playerError = false
      // 触发下一曲
      const { playNext } = require('@/core/player/player')
      await playNext(true)
      return true
    }

    // 4. 尝试重新播放当前歌曲
    console.log('[PlayerRecovery] 尝试重新播放当前歌曲:', musicInfo.name)
    global.lx.playerError = false
    await handlePlay()
    console.log('[PlayerRecovery] 恢复播放成功')
    return true
  } catch (error: any) {
    console.error('[PlayerRecovery] 恢复播放失败:', error.message)
    return false
  } finally {
    recoveryInProgress = false
  }
}

/**
 * 清除错误历史
 */
export const clearErrorHistory = () => {
  errorHistory.length = 0
}

/**
 * 获取错误统计
 */
export const getErrorStats = () => {
  const now = Date.now()
  const recentErrors = errorHistory.filter(r => now - r.timestamp < 300000) // 5分钟内

  return {
    total: errorHistory.length,
    recent: recentErrors.length,
    byType: {
      network: recentErrors.filter(r => r.type === PlayerErrorType.NETWORK).length,
      decode: recentErrors.filter(r => r.type === PlayerErrorType.DECODE).length,
      source: recentErrors.filter(r => r.type === PlayerErrorType.SOURCE).length,
      unknown: recentErrors.filter(r => r.type === PlayerErrorType.UNKNOWN).length,
    },
    recoveryInProgress,
  }
}