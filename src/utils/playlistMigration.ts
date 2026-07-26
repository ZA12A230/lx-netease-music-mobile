/**
 * 跨平台歌单迁移工具
 * 将歌单从一个平台迁移到另一个平台
 */
import settingState from '@/store/setting/state'
import music from '@/utils/musicSdk'
import { toast } from '@/utils/tools'

export type Platform = 'wy' | 'tx' | 'kg' | 'kw' | 'mg'

/** 平台信息 */
export const PLATFORM_INFO: Record<Platform, { name: string; color: string }> = {
  wy: { name: '网易云音乐', color: '#EC4141' },
  tx: { name: 'QQ音乐', color: '#31C27C' },
  kg: { name: '酷狗音乐', color: '#2D8CF0' },
  kw: { name: '酷我音乐', color: '#FFA800' },
  mg: { name: '咪咕音乐', color: '#FF3366' },
}

/** 获取平台Cookie */
const getPlatformCookie = (platform: Platform): string => {
  const cookieKey = `common.${platform}_cookie` as keyof LX.AppSetting
  return settingState.setting[cookieKey] as string || ''
}

/** 搜索迁移目标歌曲 */
const searchSongOnPlatform = async (
  platform: Platform,
  songName: string,
  singer: string,
): Promise<{ id: string | number; name: string; singer: string } | null> => {
  try {
    const sdk = music[platform]
    if (!sdk?.musicSearch) return null

    const query = `${songName} ${singer}`
    const result = await sdk.musicSearch.search(query, 1, 5)
    if (!result?.list?.length) return null

    // 找最佳匹配
    const bestMatch = result.list.find((item: any) => {
      const nameMatch = item.name?.toLowerCase().includes(songName.toLowerCase()) ||
        songName.toLowerCase().includes(item.name?.toLowerCase())
      const singerMatch = item.singer?.toLowerCase().includes(singer.toLowerCase()) ||
        singer.toLowerCase().includes(item.singer?.toLowerCase())
      return nameMatch && singerMatch
    })

    if (bestMatch) {
      return {
        id: bestMatch.songId || bestMatch.id,
        name: bestMatch.name,
        singer: bestMatch.singer,
      }
    }
    // 如果没有精确匹配，返回第一个结果
    if (result.list[0]) {
      return {
        id: result.list[0].songId || result.list[0].id,
        name: result.list[0].name,
        singer: result.list[0].singer,
      }
    }
    return null
  } catch (e) {
    console.warn(`搜索歌曲失败 [${platform}]:`, e)
    return null
  }
}

/** 迁移歌单 */
export const migratePlaylist = async (
  sourcePlatform: Platform,
  targetPlatform: Platform,
  songs: Array<{ name: string; singer: string }>,
  onProgress?: (current: number, total: number, song: string) => void,
): Promise<{
  success: number
  failed: number
  results: Array<{ original: string; migrated: string | null }>
}> => {
  const results: Array<{ original: string; migrated: string | null }> = []
  let success = 0
  let failed = 0

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i]
    onProgress?.(i + 1, songs.length, `${song.name} - ${song.singer}`)

    try {
      const match = await searchSongOnPlatform(targetPlatform, song.name, song.singer)
      if (match) {
        results.push({
          original: `${song.name} - ${song.singer}`,
          migrated: `${match.name} - ${match.singer} (${match.id})`,
        })
        success++
      } else {
        results.push({
          original: `${song.name} - ${song.singer}`,
          migrated: null,
        })
        failed++
      }
    } catch {
      results.push({
        original: `${song.name} - ${song.singer}`,
        migrated: null,
      })
      failed++
    }
  }

  return { success, failed, results }
}

/** 获取平台支持的歌单列表 */
export const getPlatformPlaylists = async (platform: Platform): Promise<Array<{
  id: string | number
  name: string
  trackCount: number
}>> => {
  const cookie = getPlatformCookie(platform)
  if (!cookie) return []

  try {
    const sdk = music[platform]
    if (!sdk?.user) return []

    const uid = await sdk.user.getUid(cookie)
    const playlists = await sdk.user.getUserPlaylists(uid, cookie)
    return playlists
  } catch {
    return []
  }
}