/**
 * 试听接口兜底音源
 * 当所有自定义音源都失败时，作为最后兜底尝试获取播放URL
 * 基于公共音乐搜索API（不稳定，仅作兜底）
 */
import { addDevLog } from '@/utils/devKit'

type MusicInfo = LX.Music.MusicInfoOnline

export interface TrialResult {
  url: string
  quality: string
  source: string
}

/** 公共音乐搜索API端点（多个备选） */
const TRIAL_ENDPOINTS = [
  'https://music.163.com/song/media/outer/url',
  'https://api.injahow.cn/meting',
]

/**
 * 尝试通过试听接口获取播放URL
 * 使用网易云外链接口作为兜底
 */
export const getTrialUrl = async (musicInfo: MusicInfo): Promise<TrialResult | null> => {
  // 仅对网易云源的歌曲尝试外链
  if (musicInfo.source === 'wy') {
    try {
      const url = `${TRIAL_ENDPOINTS[0]}?id=${musicInfo.id}.mp3`
      // 简单验证URL可用性（HEAD请求）
      const available = await checkUrlAvailable(url)
      if (available) {
        addDevLog('info', 'TrialSource', `外链成功: ${musicInfo.name} (wy)`)
        return { url, quality: '128k', source: 'trial_wy' }
      }
    } catch (e) {
      addDevLog('warn', 'TrialSource', `外链失败: ${(e as Error)?.message}`)
    }
  }

  // 尝试跨源搜索（用歌名+歌手搜索网易云）
  try {
    const searchUrl = await searchAndGuess(musicInfo)
    if (searchUrl) {
      addDevLog('info', 'TrialSource', `跨源搜索成功: ${musicInfo.name}`)
      return { url: searchUrl, quality: '128k', source: 'trial_search' }
    }
  } catch (e) {
    addDevLog('warn', 'TrialSource', `跨源搜索失败: ${(e as Error)?.message}`)
  }

  return null
}

/** 检查URL是否可用 */
const checkUrlAvailable = async (url: string): Promise<boolean> => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeout)
    return response.ok || response.status === 302 || response.status === 301
  } catch {
    return false
  }
}

/** 跨源搜索并猜测URL */
const searchAndGuess = async (musicInfo: MusicInfo): Promise<string | null> => {
  // 构建搜索关键词
  const keyword = `${musicInfo.name} ${musicInfo.singer}`.trim()
  if (!keyword) return null

  // 使用网易云搜索API
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const searchUrl = `https://music.163.com/api/search/get/web?s=${encodeURIComponent(keyword)}&type=1&offset=0&total=true&limit=5`
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Referer': 'https://music.163.com',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) return null
    const data = await response.json()
    if (!data?.result?.songs?.length) return null

    // 找最匹配的歌曲
    const songs = data.result.songs as Array<{ id: number; name: string; artists: Array<{ name: string }> }>
    const targetName = musicInfo.name.toLowerCase()
    const targetSinger = musicInfo.singer.toLowerCase()

    for (const song of songs) {
      const songName = song.name.toLowerCase()
      const songArtists = song.artists.map((a) => a.name.toLowerCase()).join(' ')

      // 名称和歌手都匹配
      if (songName.includes(targetName) || targetName.includes(songName)) {
        if (songArtists.includes(targetSinger) || targetSinger.includes(songArtists)) {
          const url = `${TRIAL_ENDPOINTS[0]}?id=${song.id}.mp3`
          if (await checkUrlAvailable(url)) {
            return url
          }
        }
      }
    }
  } catch {
    // 搜索失败，静默
  }

  return null
}

/** 是否启用试听兜底 */
export const isTrialEnabled = (): boolean => {
  // 默认启用试听兜底
  return true
}

/** 获取试听音源信息 */
export const getTrialInfo = (): { name: string; desc: string; quality: string } => {
  return {
    name: '试听接口',
    desc: '作为最后兜底，尝试通过公共接口获取试听URL（仅128k音质，不稳定）',
    quality: '128k',
  }
}
