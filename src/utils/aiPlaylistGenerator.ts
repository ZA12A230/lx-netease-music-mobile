/**
 * AI 歌单生成器模块
 * 用自然语言描述生成歌单
 */
import { chat } from '@/core/ai'
import listState from '@/store/list/state'
import { addDevLog } from './devKit'
type MusicInfo = LX.Music.MusicInfo

export interface PlaylistGenerationResult {
  success: boolean
  description: string
  songs: MusicInfo[]
  reasoning?: string
  error?: string
}

/**
 * 用自然语言生成歌单
 * @param prompt 用户的自然语言描述，如"适合学习时听的轻音乐"
 * @param allSongs 可选的候选歌曲池
 */
export const generatePlaylist = async (
  prompt: string,
  allSongs?: MusicInfo[]
): Promise<PlaylistGenerationResult> => {
  try {
    // 如果没有提供候选歌曲池，使用我的列表中的所有歌曲
    if (!allSongs) {
      allSongs = []
      // allList 包含所有列表（默认、收藏、用户列表等）
      for (const list of listState.allList) {
        const songs = (list as any).list || []
        allSongs.push(...songs)
      }
    }

    if (allSongs.length === 0) {
      return {
        success: false,
        description: '没有可用的歌曲',
        songs: [],
        error: '歌曲库为空，请先添加歌曲到我的列表',
      }
    }

    // 构造 AI 提示
    const songList = allSongs
      .slice(0, 200) // 限制数量避免上下文过长
      .map((s, i) => `${i + 1}. ${s.name} - ${s.singer}`)
      .join('\n')

    const aiPrompt = `用户想要一个歌单，描述是："${prompt}"

请从以下歌曲中选出最匹配的 15-30 首，并按推荐顺序排列。只需返回 JSON 格式，不要其他文字：
{"indices": [数字索引数组], "reasoning": "简短说明选择理由"}

可选歌曲：
${songList}`

    addDevLog('info', 'AIPlaylist', `开始生成歌单: ${prompt}, 候选${allSongs.length}首`)

    // 调用 AI
    const response = await chat(aiPrompt, [], undefined)

    // 解析 AI 返回的 JSON
    let parsed: { indices?: number[]; reasoning?: string }
    try {
      // 尝试从响应中提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('AI 响应中未找到 JSON')
      }
    } catch (e) {
      // 解析失败，使用简单关键词匹配
      return fallbackGenerate(prompt, allSongs)
    }

    if (!parsed.indices || !Array.isArray(parsed.indices) || parsed.indices.length === 0) {
      return fallbackGenerate(prompt, allSongs)
    }

    // 根据索引获取歌曲
    const selectedSongs = parsed.indices
      .filter((i) => i >= 1 && i <= allSongs!.length)
      .map((i) => allSongs![i - 1])
      .filter(Boolean)

    if (selectedSongs.length === 0) {
      return fallbackGenerate(prompt, allSongs)
    }

    addDevLog('info', 'AIPlaylist', `生成成功，共${selectedSongs.length}首`)

    return {
      success: true,
      description: prompt,
      songs: selectedSongs,
      reasoning: parsed.reasoning || `AI 根据你的描述精选了 ${selectedSongs.length} 首歌曲`,
    }
  } catch (e: any) {
    addDevLog('error', 'AIPlaylist', `生成失败: ${e?.message}`)
    return {
      success: false,
      description: prompt,
      songs: [],
      error: e?.message || '生成失败',
    }
  }
}

/** 关键词匹配的兜底方案 */
const fallbackGenerate = (prompt: string, allSongs: MusicInfo[]): PlaylistGenerationResult => {
  const keywords = prompt.toLowerCase().split(/\s+/).filter((k) => k.length > 0)

  const scored = allSongs.map((song) => {
    const text = (song.name + ' ' + song.singer).toLowerCase()
    let score = 0
    for (const kw of keywords) {
      if (text.includes(kw)) score += 10
    }
    score += Math.random() * 5 // 增加随机性
    return { song, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const selected = scored.slice(0, 20).map((s) => s.song)

  return {
    success: true,
    description: prompt,
    songs: selected,
    reasoning: '基于关键词匹配生成的歌单（AI 不可用时的兜底方案）',
  }
}

/** 预设的歌单模板 */
export const PLAYLIST_TEMPLATES = [
  { prompt: '适合学习时听的轻音乐', icon: '📚' },
  { prompt: '适合运动时的动感音乐', icon: '🏃' },
  { prompt: '适合睡前听的舒缓音乐', icon: '🌙' },
  { prompt: '适合开车时听的流行音乐', icon: '🚗' },
  { prompt: '适合派对的舞曲', icon: '🎉' },
  { prompt: '怀旧经典老歌', icon: '📻' },
  { prompt: '失恋时听的伤感歌曲', icon: '💔' },
  { prompt: '快乐的心情歌曲', icon: '☀️' },
  { prompt: '适合冥想的纯音乐', icon: '🧘' },
  { prompt: '华语流行金曲', icon: '🎤' },
]
