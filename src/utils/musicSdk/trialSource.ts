/**
 * 试听接口兜底音源
 * 当所有自定义音源都失败时，作为最后兜底尝试获取播放URL
 * 基于公共音乐外链API（不稳定，仅作兜底）
 *
 * 维护说明：
 * - 端点列表按优先级排序，从前往后依次尝试
 * - 所有端点都是公开免登录接口，不保证稳定
 * - 如发现某个端点失效，可从列表中移除
 */
import { addDevLog } from '@/utils/devKit'

type MusicInfo = LX.Music.MusicInfoOnline

export interface TrialResult {
  url: string
  quality: string
  source: string
}

/**
 * 公共音乐外链端点列表（按优先级排序）
 * - music.163.com 外链：网易云官方外链，最稳定
 * - link.hhtjim.com：第三方解析服务
 * - api.injahow.cn/meting：第三方 Meting 服务
 */
const TRIAL_ENDPOINTS = [
  'https://music.163.com/song/media/outer/url',
  'https://link.hhtjim.com/163',
  'https://api.injahow.cn/meting',
]

/**
 * 构建外链URL
 * 根据端点ID和歌曲ID构建不同格式的URL
 */
const buildTrialUrl = (endpoint: string, songId: string | number): string => {
  if (endpoint.includes('music.163.com')) {
    // 网易云外链格式：?id=xxx
    return `${endpoint}?id=${songId}`
  } else if (endpoint.includes('link.hhtjim.com')) {
    // hhtjim 格式：/163/xxx.mp3
    return `${endpoint}/${songId}.mp3`
  } else if (endpoint.includes('api.injahow.cn')) {
    // Meting 格式：?type=url&id=xxx
    return `${endpoint}/?type=url&id=${songId}`
  }
  return `${endpoint}?id=${songId}`
}

/**
 * 尝试通过试听接口获取播放URL
 * 优先尝试网易云外链（仅wy源），失败后跨源搜索
 */
export const getTrialUrl = async (musicInfo: MusicInfo): Promise<TrialResult | null> => {
  // 1. 若是网易云源歌曲，直接用歌曲ID尝试所有端点
  if (musicInfo.source === 'wy') {
    for (const endpoint of TRIAL_ENDPOINTS) {
      try {
        const url = buildTrialUrl(endpoint, musicInfo.id)
        const finalUrl = await resolveFinalUrl(url)
        if (finalUrl) {
          addDevLog('info', 'TrialSource', `外链成功(wy): ${musicInfo.name} via ${endpoint}`)
          return { url: finalUrl, quality: '128k', source: 'trial_wy' }
        }
      } catch (e) {
        addDevLog('warn', 'TrialSource', `外链失败(wy, ${endpoint}): ${(e as Error)?.message}`)
      }
    }
  }

  // 2. 跨源搜索：用歌名+歌手搜索网易云，找到匹配的歌曲ID再用外链
  try {
    const searchResult = await searchAndGuess(musicInfo)
    if (searchResult) {
      addDevLog('info', 'TrialSource', `跨源搜索成功: ${musicInfo.name}`)
      return { url: searchResult, quality: '128k', source: 'trial_search' }
    }
  } catch (e) {
    addDevLog('warn', 'TrialSource', `跨源搜索失败: ${(e as Error)?.message}`)
  }

  return null
}

/**
 * 解析URL的最终可用地址
 * - GET 请求并跟随重定向（最多5次）
 * - 检查响应状态码
 * - 避免下载完整文件，遇到音频流立即返回
 */
const resolveFinalUrl = async (url: string): Promise<string | null> => {
  let currentUrl = url
  const MAX_REDIRECTS = 5

  for (let i = 0; i < MAX_REDIRECTS; i++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual', // 手动处理重定向，便于拿到最终URL
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
          'Referer': 'https://music.163.com/',
        },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      // 处理重定向
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        if (location) {
          // 处理相对路径
          if (location.startsWith('http')) {
            currentUrl = location
          } else {
            const origin = new URL(currentUrl).origin
            currentUrl = location.startsWith('/') ? `${origin}${location}` : `${origin}/${location}`
          }
          continue
        }
        return null
      }

      // 200 状态：检查内容是否为音频
      if (response.ok) {
        const contentType = response.headers.get('content-type') || ''
        // 音频流或二进制数据
        if (contentType.includes('audio') ||
            contentType.includes('octet-stream') ||
            contentType.includes('mpeg') ||
            contentType.includes('mp3')) {
          // 立即关闭，避免下载完整文件
          try { await response.blob?.() } catch { /* ignore */ }
          return currentUrl
        }
        // 有些服务器返回 text/plain 但实际是音频
        if (contentType.includes('text/plain') || contentType.includes('text/html')) {
          // 可能是错误页，跳过
          try { await response.blob?.() } catch { /* ignore */ }
          return null
        }
        return currentUrl
      }

      // 403/404 等错误状态
      return null
    } catch (e) {
      // 超时或网络错误
      return null
    }
  }

  return null
}

/** 跨源搜索并猜测URL */
const searchAndGuess = async (musicInfo: MusicInfo): Promise<string | null> => {
  // 构建搜索关键词
  const keyword = `${musicInfo.name} ${musicInfo.singer}`.trim()
  if (!keyword) return null

  // 使用网易云搜索API（公开接口）
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const searchUrl = `https://music.163.com/api/search/get/web?s=${encodeURIComponent(keyword)}&type=1&offset=0&total=true&limit=5`
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Referer': 'https://music.163.com',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
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
    const targetSinger = (musicInfo.singer || '').toLowerCase()

    // 优先完全匹配，其次模糊匹配
    const matchSong = songs.find((song) => {
      const songName = (song.name || '').toLowerCase()
      const songArtists = (song.artists || []).map((a) => (a.name || '').toLowerCase()).join(' ')
      const nameMatch = songName === targetName || songName.includes(targetName) || targetName.includes(songName)
      const singerMatch = !targetSinger ||
        songArtists.includes(targetSinger) ||
        targetSinger.includes(songArtists)
      return nameMatch && singerMatch
    }) || songs[0] // 实在不行用第一个结果

    if (!matchSong) return null

    // 用找到的歌曲ID尝试所有外链端点
    for (const endpoint of TRIAL_ENDPOINTS) {
      try {
        const url = buildTrialUrl(endpoint, matchSong.id)
        const finalUrl = await resolveFinalUrl(url)
        if (finalUrl) return finalUrl
      } catch (e) {
        // 继续尝试下一个端点
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
