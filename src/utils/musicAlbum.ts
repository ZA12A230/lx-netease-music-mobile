/**
 * 音乐相册
 * 把音乐和本地照片关联，生成回忆相册
 *
 * 功能特点：
 * - 把照片与歌曲关联，形成"音乐相册"
 * - 按时间线展示照片+对应歌曲
 * - 自动生成"那年今日"回忆
 * - 支持为相册添加备注文字
 * - 可导出为长图分享
 */
import { getData, setData } from '@/utils/data'
import { addDevLog } from '@/utils/devKit'

const ALBUMS_KEY = 'music_albums'
const PHOTO_LINKS_KEY = 'music_photo_links'

export interface PhotoLink {
  id: string                // 链接ID
  photoUri: string          // 本地照片URI
  musicId: string           // 关联的歌曲ID
  musicName: string         // 歌曲名
  singer: string            // 歌手
  note: string              // 备注
  location?: string         // 拍摄地点（可选）
  createdAt: number         // 创建时间
  /** 拍摄时间（用于那年今日） */
  takenAt?: number
}

export interface MusicAlbum {
  id: string
  name: string              // 相册名
  description: string       // 描述
  coverPhotoUri?: string    // 封面照片
  musicIds: string[]        // 关联的歌曲ID列表
  photoLinks: string[]      // 包含的PhotoLink ID列表
  createdAt: number
  updatedAt: number
}

/** 创建新的照片-音乐关联 */
export const createPhotoLink = async (
  photoUri: string,
  musicInfo: { id: string; name: string; singer: string },
  note: string = '',
  location?: string,
  takenAt?: number
): Promise<PhotoLink> => {
  const link: PhotoLink = {
    id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    photoUri,
    musicId: musicInfo.id,
    musicName: musicInfo.name,
    singer: musicInfo.singer,
    note,
    location,
    createdAt: Date.now(),
    takenAt: takenAt ?? Date.now(),
  }

  const links = await getAllPhotoLinks()
  links.unshift(link)
  await setData(PHOTO_LINKS_KEY, links)

  addDevLog('info', 'MusicAlbum', `创建照片关联: ${link.musicName}`)
  return link
}

/** 获取所有照片-音乐关联 */
export const getAllPhotoLinks = async (): Promise<PhotoLink[]> => {
  return (await getData<PhotoLink[]>(PHOTO_LINKS_KEY)) ?? []
}

/** 删除照片-音乐关联 */
export const deletePhotoLink = async (id: string) => {
  const links = await getAllPhotoLinks()
  const newLinks = links.filter((l) => l.id !== id)
  await setData(PHOTO_LINKS_KEY, newLinks)

  // 同时从所有相册中移除
  const albums = await getAllAlbums()
  for (const album of albums) {
    if (album.photoLinks.includes(id)) {
      album.photoLinks = album.photoLinks.filter((pid) => pid !== id)
      album.updatedAt = Date.now()
    }
  }
  await setData(ALBUMS_KEY, albums)
}

/** 更新照片-音乐关联 */
export const updatePhotoLink = async (id: string, updates: Partial<PhotoLink>) => {
  const links = await getAllPhotoLinks()
  const idx = links.findIndex((l) => l.id === id)
  if (idx >= 0) {
    links[idx] = { ...links[idx], ...updates }
    await setData(PHOTO_LINKS_KEY, links)
  }
}

/** 创建新相册 */
export const createAlbum = async (
  name: string,
  description: string = '',
  musicIds: string[] = [],
  photoLinkIds: string[] = []
): Promise<MusicAlbum> => {
  const album: MusicAlbum = {
    id: `album_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    description,
    musicIds,
    photoLinks: photoLinkIds,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const albums = await getAllAlbums()
  albums.unshift(album)
  await setData(ALBUMS_KEY, albums)

  addDevLog('info', 'MusicAlbum', `创建相册: ${name}`)
  return album
}

/** 获取所有相册 */
export const getAllAlbums = async (): Promise<MusicAlbum[]> => {
  return (await getData<MusicAlbum[]>(ALBUMS_KEY)) ?? []
}

/** 删除相册 */
export const deleteAlbum = async (id: string) => {
  const albums = await getAllAlbums()
  const newAlbums = albums.filter((a) => a.id !== id)
  await setData(ALBUMS_KEY, newAlbums)
}

/** 更新相册 */
export const updateAlbum = async (id: string, updates: Partial<MusicAlbum>) => {
  const albums = await getAllAlbums()
  const idx = albums.findIndex((a) => a.id === id)
  if (idx >= 0) {
    albums[idx] = { ...albums[idx], ...updates, updatedAt: Date.now() }
    await setData(ALBUMS_KEY, albums)
  }
}

/**
 * 获取"那年今日"的回忆
 * - 查找历史上今天创建的照片-音乐关联
 * - 支持查找1年前、2年前...的今天
 */
export const getMemoriesOnThisDay = async (yearsAgo: number = 1): Promise<PhotoLink[]> => {
  const now = new Date()
  const targetYear = now.getFullYear() - yearsAgo
  const targetMonth = now.getMonth()
  const targetDate = now.getDate()

  const links = await getAllPhotoLinks()
  return links.filter((link) => {
    const linkDate = new Date(link.takenAt ?? link.createdAt)
    return linkDate.getFullYear() === targetYear &&
           linkDate.getMonth() === targetMonth &&
           linkDate.getDate() === targetDate
  })
}

/** 获取所有可用年份的回忆 */
export const getAvailableMemoryYears = async (): Promise<number[]> => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const links = await getAllPhotoLinks()
  const years = new Set<number>()

  for (const link of links) {
    const linkDate = new Date(link.takenAt ?? link.createdAt)
    const linkYear = linkDate.getFullYear()
    // 同月同日，但年份更早
    if (linkYear < currentYear &&
        linkDate.getMonth() === now.getMonth() &&
        linkDate.getDate() === now.getDate()) {
      years.add(currentYear - linkYear)
    }
  }

  return Array.from(years).sort((a, b) => a - b)
}

/**
 * 按时间线分组照片-音乐关联
 * - 按月分组
 * - 返回 [{month: '2024-01', links: [...]}]
 */
export const getPhotoLinksTimeline = async (): Promise<Array<{ month: string; links: PhotoLink[] }>> => {
  const links = await getAllPhotoLinks()
  const groups: Record<string, PhotoLink[]> = {}

  for (const link of links) {
    const date = new Date(link.takenAt ?? link.createdAt)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!groups[month]) groups[month] = []
    groups[month].push(link)
  }

  return Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, links]) => ({ month, links }))
}

/** 按歌曲统计照片数量 */
export const getPhotoCountByMusic = async (): Promise<Array<{ musicId: string; musicName: string; singer: string; count: number }>> => {
  const links = await getAllPhotoLinks()
  const stats: Record<string, { musicId: string; musicName: string; singer: string; count: number }> = {}

  for (const link of links) {
    if (!stats[link.musicId]) {
      stats[link.musicId] = {
        musicId: link.musicId,
        musicName: link.musicName,
        singer: link.singer,
        count: 0,
      }
    }
    stats[link.musicId].count++
  }

  return Object.values(stats).sort((a, b) => b.count - a.count)
}

/** 导出相册为可分享格式 */
export const exportAlbum = async (albumId: string): Promise<{
  album: MusicAlbum | undefined
  photoLinks: PhotoLink[]
  exportText: string
}> => {
  const albums = await getAllAlbums()
  const album = albums.find((a) => a.id === albumId)
  if (!album) {
    return { album: undefined, photoLinks: [], exportText: '' }
  }

  const allLinks = await getAllPhotoLinks()
  const photoLinks = album.photoLinks
    .map((id) => allLinks.find((l) => l.id === id))
    .filter((l): l is PhotoLink => !!l)

  const exportText = `# ${album.name}\n\n${album.description}\n\n## 包含的音乐记忆：\n${
    photoLinks.map((l, i) =>
      `${i + 1}. ${l.musicName} - ${l.singer}\n   ${l.note}\n   ${new Date(l.takenAt ?? l.createdAt).toLocaleDateString('zh-CN')}`
    ).join('\n\n')
  }\n\n— Generated by Gyou LX Music`

  return { album, photoLinks, exportText }
}
