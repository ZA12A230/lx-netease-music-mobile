/**
 * 音频缓存管理工具
 * 管理应用缓存文件，支持自动清理过期缓存和手动清理
 */
import RNFetchBlob from 'rn-fetch-blob'
import { toast } from '@/utils/tools'

/** 缓存项信息 */
interface CacheItem {
  path: string
  name: string
  size: number
  lastModified: number
  isExpired: boolean
}

/** 缓存统计 */
interface CacheStats {
  itemCount: number
  totalSize: number
  expiredCount: number
  expiredSize: number
}

/** 缓存目录 */
const CACHE_DIRS = {
  audio: RNFetchBlob.fs.dirs.CacheDir,
  image: RNFetchBlob.fs.dirs.CacheDir,
  data: RNFetchBlob.fs.dirs.DocumentDir,
}

/** 缓存过期时间（毫秒） */
const CACHE_EXPIRATION = {
  audio: 24 * 60 * 60 * 1000,    // 音频缓存 24小时
  image: 7 * 24 * 60 * 60 * 1000, // 图片缓存 7天
  data: 30 * 24 * 60 * 60 * 1000, // 数据缓存 30天
}

/** 格式化文件大小 */
const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * 扫描指定目录中的缓存文件
 */
const scanCacheDir = async (
  dirPath: string,
  expirationMs: number,
  pattern?: RegExp,
): Promise<CacheItem[]> => {
  try {
    const exists = await RNFetchBlob.fs.exists(dirPath)
    if (!exists) return []

    const files = await RNFetchBlob.fs.ls(dirPath)
    const items: CacheItem[] = []
    const now = Date.now()

    for (const file of files) {
      if (pattern && !pattern.test(file.filename)) continue

      try {
        const stat = await RNFetchBlob.fs.stat(file.path)
        if (stat.type === 'file') {
          items.push({
            path: file.path,
            name: file.filename,
            size: Number(stat.size),
            lastModified: Number(stat.lastModified),
            isExpired: now - Number(stat.lastModified) > expirationMs,
          })
        }
      } catch {
        // 跳过无法读取的文件
      }
    }

    return items
  } catch (error) {
    console.warn(`[CacheManager] 扫描目录失败: ${dirPath}`, error)
    return []
  }
}

/**
 * 获取缓存统计
 */
export const getCacheStats = async (): Promise<CacheStats> => {
  let itemCount = 0
  let totalSize = 0
  let expiredCount = 0
  let expiredSize = 0

  // 扫描音频缓存
  const audioFiles = await scanCacheDir(CACHE_DIRS.audio, CACHE_EXPIRATION.audio, /\.(mp3|flac|wav|m4a|ogg)$/i)
  for (const item of audioFiles) {
    itemCount++
    totalSize += item.size
    if (item.isExpired) {
      expiredCount++
      expiredSize += item.size
    }
  }

  // 扫描图片缓存
  const imageFiles = await scanCacheDir(CACHE_DIRS.image, CACHE_EXPIRATION.image, /\.(jpg|jpeg|png|webp|gif)$/i)
  for (const item of imageFiles) {
    itemCount++
    totalSize += item.size
    if (item.isExpired) {
      expiredCount++
      expiredSize += item.size
    }
  }

  return { itemCount, totalSize, expiredCount, expiredSize }
}

/**
 * 清除过期缓存
 * @returns 清除的文件数和释放的空间
 */
export const clearExpiredCache = async (): Promise<{ count: number; freedSize: number }> => {
  let count = 0
  let freedSize = 0

  const clearDir = async (dirPath: string, expirationMs: number, pattern?: RegExp) => {
    const files = await scanCacheDir(dirPath, expirationMs, pattern)
    for (const file of files) {
      if (!file.isExpired) continue
      try {
        await RNFetchBlob.fs.unlink(file.path)
        count++
        freedSize += file.size
      } catch (e) {
        console.warn(`[CacheManager] 删除过期文件失败: ${file.path}`, e)
      }
    }
  }

  await clearDir(CACHE_DIRS.audio, CACHE_EXPIRATION.audio, /\.(mp3|flac|wav|m4a|ogg)$/i)
  await clearDir(CACHE_DIRS.image, CACHE_EXPIRATION.image, /\.(jpg|jpeg|png|webp|gif)$/i)

  if (count > 0) {
    toast(`已清理 ${count} 个过期缓存文件，释放 ${formatSize(freedSize)}`)
  }

  return { count, freedSize }
}

/**
 * 清除所有缓存
 * @returns 清除的文件数和释放的空间
 */
export const clearAllCache = async (): Promise<{ count: number; freedSize: number }> => {
  let count = 0
  let freedSize = 0

  const clearDir = async (dirPath: string, pattern?: RegExp) => {
    const files = await scanCacheDir(dirPath, 0, pattern)
    for (const file of files) {
      try {
        await RNFetchBlob.fs.unlink(file.path)
        count++
        freedSize += file.size
      } catch (e) {
        console.warn(`[CacheManager] 删除缓存文件失败: ${file.path}`, e)
      }
    }
  }

  await clearDir(CACHE_DIRS.audio, /\.(mp3|flac|wav|m4a|ogg)$/i)
  await clearDir(CACHE_DIRS.image, /\.(jpg|jpeg|png|webp|gif)$/i)

  if (count > 0) {
    toast(`已清除 ${count} 个缓存文件，释放 ${formatSize(freedSize)}`)
  }

  return { count, freedSize }
}

/**
 * 获取格式化后的缓存统计信息
 */
export const getFormattedCacheStats = async (): Promise<string> => {
  const stats = await getCacheStats()
  const parts: string[] = []
  parts.push(`缓存文件: ${stats.itemCount} 个`)
  parts.push(`占用空间: ${formatSize(stats.totalSize)}`)
  if (stats.expiredCount > 0) {
    parts.push(`过期文件: ${stats.expiredCount} 个 (${formatSize(stats.expiredSize)})`)
  }
  return parts.join('\n')
}

/**
 * 自动清理缓存（仅在WiFi环境下）
 * 可被应用启动时调用
 */
export const autoCleanCache = async (minFreeMB = 50) => {
  try {
    const stat = await RNFetchBlob.fs.df(CACHE_DIRS.audio)
    const freeMB = stat.free / (1024 * 1024)

    if (freeMB < minFreeMB) {
      console.log(`[CacheManager] 剩余空间不足 ${minFreeMB}MB，自动清理过期缓存`)
      await clearExpiredCache()
    }
  } catch (error) {
    console.warn('[CacheManager] 自动清理缓存失败:', error)
  }
}