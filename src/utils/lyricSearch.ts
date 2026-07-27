/**
 * 歌词搜索工具
 * 通过歌词片段搜索歌曲，支持多平台搜索
 */
import musicSdk from '@/utils/musicSdk'

export interface LyricSearchResult {
  musicInfo: LX.Music.MusicInfoOnline
  source: string
  score: number
}

/**
 * 通过歌词搜索歌曲
 * @param lyricText 歌词片段
 * @param sources 搜索平台，默认全部
 * @param limit 每个平台返回数量
 */
export const searchByLyric = async (
  lyricText: string,
  sources: string[] = ['wy', 'tx', 'kg', 'kw', 'mg'],
  limit: number = 10,
): Promise<LyricSearchResult[]> => {
  if (!lyricText.trim()) return []

  const allResults: LyricSearchResult[] = []
  const tasks = sources.map(async (source) => {
    const sdk = musicSdk[source as keyof typeof musicSdk]
    if (!sdk?.musicSearch) return []

    try {
      // 使用歌词文本作为搜索关键词
      const result = await sdk.musicSearch.search(lyricText.trim(), 1, limit)
      if (!result?.list?.length) return []

      return result.list.map((item: LX.Music.MusicInfoOnline) => ({
        musicInfo: item,
        source,
        score: 0, // 基础分数，后续可通过歌词匹配度调整
      }))
    } catch (e) {
      console.warn(`歌词搜索 [${source}] 失败:`, e)
      return []
    }
  })

  const results = await Promise.all(tasks)
  for (const list of results) {
    allResults.push(...list)
  }

  // 按歌曲名与歌词文本的相关性排序
  const query = lyricText.trim().toLowerCase()
  allResults.sort((a, b) => {
    const aNameMatch = a.musicInfo.name.toLowerCase().includes(query) ? 1 : 0
    const bNameMatch = b.musicInfo.name.toLowerCase().includes(query) ? 1 : 0
    return bNameMatch - aNameMatch
  })

  return allResults.slice(0, limit * 2)
}

/**
 * 获取歌词内容并搜索匹配的歌曲
 * 用于听歌识曲场景：从歌词中提取关键词搜索
 */
export const extractKeywordsFromLyric = (lyric: string): string[] => {
  if (!lyric) return []

  // 提取有意义的歌词行（过滤掉元数据行）
  const lines = lyric
    .split('\n')
    .map(line => line.replace(/\[.*?\]/g, '').trim())
    .filter(line => line.length > 3 && !line.startsWith('作词') && !line.startsWith('作曲') && !line.startsWith('编曲'))

  // 从每行提取关键词（取前几个字作为搜索词）
  const keywords: string[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    // 取每行的前8-15个字符作为搜索关键词
    const keyword = line.slice(0, 15).trim()
    if (keyword.length >= 4 && !seen.has(keyword)) {
      seen.add(keyword)
      keywords.push(keyword)
    }
    if (keywords.length >= 5) break
  }

  return keywords
}

/**
 * 从歌词中搜索歌曲（高级搜索）
 * 提取歌词关键词，分别搜索，综合结果
 */
export const searchByLyricAdvanced = async (
  lyric: string,
  sources: string[] = ['wy', 'tx', 'kg', 'kw', 'mg'],
): Promise<LyricSearchResult[]> => {
  const keywords = extractKeywordsFromLyric(lyric)
  if (keywords.length === 0) return []

  // 用每个关键词搜索
  const allResults: LyricSearchResult[] = []
  const seenIds = new Set<string>()

  for (const keyword of keywords.slice(0, 3)) {
    const results = await searchByLyric(keyword, sources, 5)
    for (const result of results) {
      const id = `${result.source}_${result.musicInfo.id}`
      if (!seenIds.has(id)) {
        seenIds.add(id)
        result.score = 1 // 增加匹配分数
        allResults.push(result)
      }
    }
    if (allResults.length >= 20) break
  }

  return allResults.slice(0, 15)
}