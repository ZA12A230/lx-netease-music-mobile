// @ts-nocheck
/**
 * AI 工具调用模块
 * 让 AI 可以搜索歌曲、播放、下载、获取歌词、导航等
 */
import musicSdk from '@/utils/musicSdk'
import { searchMusic as sdkSearchMusic } from '@/utils/musicSdk'
import playerAction from '@/store/player/action'

// ============ 工具定义（供 AI function calling）============
export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, any>
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_music',
    description: '搜索歌曲。返回歌曲列表（歌名、歌手、专辑、时长、音源）。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '搜索关键词（歌名或歌手）' },
        limit: { type: 'number', description: '返回数量，默认10' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'play_music',
    description: '搜索并播放歌曲。会自动搜索匹配的歌曲并播放。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '歌曲关键词（歌名 歌手）' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'download_music',
    description: '搜索并下载歌曲。会自动搜索匹配的歌曲并添加到下载队列。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '歌曲关键词（歌名 歌手）' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'get_lyrics',
    description: '获取当前播放歌曲的歌词，或搜索指定歌曲的歌词。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '歌曲关键词（可选，不填则获取当前播放歌曲歌词）' },
      },
    },
  },
  {
    name: 'navigate',
    description: '导航到指定页面。支持：search(搜索)、play_history(播放历史)、songlist(歌单)、top(排行榜)、love(我喜欢)、setting(设置)、play_detail(播放详情)。',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: '目标页面：search/play_history/songlist/top/love/setting/play_detail' },
      },
      required: ['target'],
    },
  },
  {
    name: 'get_current_song',
    description: '获取当前正在播放的歌曲信息。',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'control_player',
    description: '控制播放器：播放、暂停、上一首、下一首、快进、快退。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: '操作：play/pause/prev/next/forward/backward' },
      },
      required: ['action'],
    },
  },
  {
    name: 'set_volume',
    description: '设置播放音量（0-100）。',
    parameters: {
      type: 'object',
      properties: {
        volume: { type: 'number', description: '音量值 0-100' },
      },
      required: ['volume'],
    },
  },
  {
    name: 'search_album',
    description: '搜索专辑。返回专辑列表。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '搜索关键词' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'search_artist',
    description: '搜索歌手。返回歌手列表。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '搜索关键词' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'add_to_love',
    description: '将当前播放的歌曲或指定歌曲添加到"我喜欢"列表。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '歌曲关键词（可选，不填则添加当前播放歌曲）' },
      },
    },
  },
  {
    name: 'execute_sequence',
    description: '批量执行多个操作（用于一句话全自动操控）。例如用户说"播放周杰伦的歌并下载"可以一次执行播放+下载。',
    parameters: {
      type: 'object',
      properties: {
        commands: {
          type: 'array',
          description: '操作序列',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string', description: '工具名' },
              args: { type: 'object', description: '工具参数' },
            },
          },
        },
      },
      required: ['commands'],
    },
  },
  {
    name: 'shazam',
    description: '听歌识曲：录制周围音乐并识别歌曲名称和歌手。使用前请告知用户需要麦克风权限。',
    parameters: {
      type: 'object',
      properties: {
        duration: { type: 'number', description: '录音时长（秒），默认5秒' },
      },
    },
  },
]

// ============ 工具执行函数 ============

/**
 * 搜索歌曲
 */
export const toolSearchMusic = async (keyword: string, limit: number = 10): Promise<string> => {
  try {
    const results = await sdkSearchMusic({ name: keyword, limit })
    const songs: any[] = []
    for (const result of results) {
      if (!result?.list) continue
      for (const song of result.list.slice(0, Math.ceil(limit / results.length))) {
        songs.push({
          name: song.name,
          singer: song.singer,
          album: song.albumName || '',
          interval: song.interval || '',
          source: song.source,
          songmid: song.songmid,
        })
      }
      if (songs.length >= limit) break
    }
    if (songs.length === 0) return `未找到与"${keyword}"相关的歌曲。`
    return `找到${songs.length}首歌曲：\n` + songs.slice(0, limit).map((s, i) =>
      `${i + 1}. 《${s.name}》- ${s.singer}（专辑：${s.album}，音源：${s.source}）`
    ).join('\n')
  } catch (err: any) {
    return `搜索失败：${err.message}`
  }
}

/**
 * 搜索并播放歌曲
 */
export const toolPlayMusic = async (keyword: string): Promise<string> => {
  try {
    const results = await sdkSearchMusic({ name: keyword, limit: 5 })
    let targetSong: any = null
    let targetSource = ''
    for (const result of results) {
      if (!result?.list || result.list.length === 0) continue
      targetSong = result.list[0]
      targetSource = result.source
      break
    }
    if (!targetSong) return `未找到与"${keyword}"匹配的歌曲，无法播放。`

    // 获取当前播放状态
    const playerState = (await import('@/store/player/state')).default
    const wasPlaying = playerState.isPlay
    const hadMusic = !!playerState.playMusicInfo?.musicInfo

    // 添加到临时播放列表（isTop=true 插入队列头部）
    playerAction.addTempPlayList([{
      musicInfo: targetSong,
      listId: null,
      isTop: true,
    }])

    // 强制触发播放：先确保切到新歌，再播放
    const { play, playNext } = await import('@/core/player/player')
    if (hadMusic) {
      // 已有歌曲在播放，直接切换到下一首（临时列表顶部就是这首歌）
      await playNext(false)
      // 如果之前在播放则恢复播放
      if (wasPlaying) play()
    }
    // 如果之前没有歌曲，addTempPlayList 已自动调用 playNext

    return `正在播放：《${targetSong.name}》- ${targetSong.singer}（音源：${targetSource}）`
  } catch (err: any) {
    return `播放失败：${err.message}`
  }
}

/**
 * 搜索并下载歌曲
 */
export const toolDownloadMusic = async (keyword: string): Promise<string> => {
  try {
    const results = await sdkSearchMusic({ name: keyword, limit: 5 })
    let targetSong: any = null
    for (const result of results) {
      if (!result?.list || result.list.length === 0) continue
      targetSong = result.list[0]
      break
    }
    if (!targetSong) return `未找到与"${keyword}"匹配的歌曲，无法下载。`

    // 动态导入 download 模块
    const { addTask } = await import('@/core/download')
    addTask(targetSong, '320k')

    return `已添加下载任务：《${targetSong.name}》- ${targetSong.singer}`
  } catch (err: any) {
    return `下载失败：${err.message}`
  }
}

/**
 * 获取歌词
 */
export const toolGetLyrics = async (keyword?: string): Promise<string> => {
  try {
    let musicInfo: any = null

    if (keyword) {
      // 搜索指定歌曲
      const results = await sdkSearchMusic({ name: keyword, limit: 1 })
      for (const result of results) {
        if (!result?.list || result.list.length === 0) continue
        musicInfo = result.list[0]
        break
      }
      if (!musicInfo) return `未找到与"${keyword}"匹配的歌曲。`
    } else {
      // 获取当前播放歌曲
      const playerState = (await import('@/store/player/state')).default
      if (!playerState.playMusicInfo?.musicInfo) return '当前没有正在播放的歌曲。'
      musicInfo = playerState.playMusicInfo.musicInfo
    }

    const source = musicInfo.source
    if (!musicSdk[source]?.getLyric) return `音源${source}不支持获取歌词。`

    const lyricResult = await musicSdk[source].getLyric(musicInfo)
    const lyric = typeof lyricResult === 'string' ? lyricResult : lyricResult?.lyric || ''
    if (!lyric) return '未获取到歌词。'

    // 返回纯文本歌词（去除时间标签）
    const cleanLyric = lyric.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim()
    return `《${musicInfo.name}》- ${musicInfo.singer} 的歌词：\n\n${cleanLyric}`
  } catch (err: any) {
    return `获取歌词失败：${err.message}`
  }
}

/**
 * 导航到页面
 */
export const toolNavigate = async (target: string): Promise<string> => {
  const targetMap: Record<string, string> = {
    search: 'nav_search',
    play_history: 'nav_play_history',
    songlist: 'nav_songlist',
    top: 'nav_top',
    love: 'nav_love',
    setting: 'nav_setting',
  }
  const navId = targetMap[target]
  if (!navId) return `不支持的页面：${target}。支持：search/play_history/songlist/top/love/setting。`

  try {
    const { setNavActiveId } = await import('@/core/common')
    setNavActiveId(navId as any)
    return `已导航到：${target}`
  } catch {
    return `导航失败`
  }
}

/**
 * 获取当前播放歌曲
 */
export const toolGetCurrentSong = async (): Promise<string> => {
  try {
    const playerState = (await import('@/store/player/state')).default
    const info = playerState.playMusicInfo?.musicInfo as any
    if (!info) return '当前没有正在播放的歌曲。'
    const isPlaying = playerState.isPlay ? '正在播放' : '已暂停'
    return `当前${isPlaying}：《${info.name}》- ${info.singer || '未知'}（音源：${info.source}）`
  } catch (err: any) {
    return `获取失败：${err.message}`
  }
}

/**
 * 控制播放器
 */
export const toolControlPlayer = async (action: string): Promise<string> => {
  try {
    const { play, pause, playPrev, playNext } = await import('@/core/player/player')
    const { setCurrentTime } = await import('@/plugins/player/utils')
    switch (action) {
      case 'play':
        play()
        return '已开始播放'
      case 'pause':
        await pause()
        return '已暂停播放'
      case 'prev':
        await playPrev()
        return '已切换到上一首'
      case 'next':
        await playNext()
        return '已切换到下一首'
      case 'forward': {
        const playerState = (await import('@/store/player/state')).default
        const cur = playerState.progress?.nowPlayTime || 0
        await setCurrentTime(cur + 15)
        return '已快进15秒'
      }
      case 'backward': {
        const playerState = (await import('@/store/player/state')).default
        const cur = playerState.progress?.nowPlayTime || 0
        await setCurrentTime(Math.max(0, cur - 15))
        return '已快退15秒'
      }
      default:
        return `不支持的操作：${action}。支持：play/pause/prev/next/forward/backward`
    }
  } catch (err: any) {
    return `操作失败：${err.message}`
  }
}

/**
 * 设置音量
 */
export const toolSetVolume = async (volume: number): Promise<string> => {
  try {
    const { setVolume } = await import('@/plugins/player/utils')
    const v = Math.max(0, Math.min(100, volume))
    await setVolume(v / 100)
    return `音量已设置为 ${v}%`
  } catch (err: any) {
    return `设置音量失败：${err.message}`
  }
}

/**
 * 搜索专辑
 */
export const toolSearchAlbum = async (keyword: string): Promise<string> => {
  try {
    // 通过搜索歌曲提取专辑信息
    const results = await sdkSearchMusic({ name: keyword, limit: 20 })
    const albumMap = new Map<string, { singer: string; source: string }>()
    for (const result of results) {
      if (!result?.list) continue
      for (const song of result.list) {
        const album = song.albumName || '未知专辑'
        if (!albumMap.has(album)) {
          albumMap.set(album, { singer: song.singer || '未知', source: result.source })
        }
      }
    }
    if (albumMap.size === 0) return `未找到与"${keyword}"相关的专辑。`
    const albums = Array.from(albumMap.entries()).slice(0, 10)
    return `找到${albums.length}个相关专辑：\n` + albums.map(([name, info], i) =>
      `${i + 1}. 《${name}》- ${info.singer}（音源：${info.source}）`
    ).join('\n')
  } catch (err: any) {
    return `搜索专辑失败：${err.message}`
  }
}

/**
 * 搜索歌手
 */
export const toolSearchArtist = async (keyword: string): Promise<string> => {
  try {
    // 复用搜索接口，过滤歌手
    const results = await sdkSearchMusic({ name: keyword, limit: 20 })
    const artistMap = new Map<string, number>()
    for (const result of results) {
      if (!result?.list) continue
      for (const song of result.list) {
        const singer = song.singer || '未知'
        artistMap.set(singer, (artistMap.get(singer) || 0) + 1)
      }
    }
    if (artistMap.size === 0) return `未找到与"${keyword}"相关的歌手。`
    const artists = Array.from(artistMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
    return `找到${artists.length}位相关歌手：\n` + artists.map((a, i) =>
      `${i + 1}. ${a[0]}（${a[1]}首相关歌曲）`
    ).join('\n')
  } catch (err: any) {
    return `搜索歌手失败：${err.message}`
  }
}

/**
 * 听歌识曲（Shazam）
 */
export const toolShazam = async (duration: number = 5): Promise<string> => {
  try {
    const { recognizeFromMic } = await import('@/core/shazam')
    const result = await recognizeFromMic(duration)
    if (result) {
      return `识别成功！\n\n歌曲：《${result.title}》\n歌手：${result.artist}\n\n需要我播放这首歌吗？`
    } else {
      return '未能识别到歌曲，可能环境太嘈杂或歌曲不在 Shazam 曲库中，请重试。'
    }
  } catch (err: any) {
    if (err.message?.includes('未安装音频录制库') || err.message?.includes('PERMISSION_DENIED')) {
      return '听歌识曲需要麦克风权限，请在设置中授予麦克风权限后重试。'
    }
    return `识别失败：${err.message}`
  }
}

/**
 * 添加到我喜欢
 */
export const toolAddToLove = async (keyword?: string): Promise<string> => {
  try {
    let musicInfo: any = null
    if (keyword) {
      const results = await sdkSearchMusic({ name: keyword, limit: 1 })
      for (const result of results) {
        if (!result?.list || result.list.length === 0) continue
        musicInfo = result.list[0]
        break
      }
      if (!musicInfo) return `未找到与"${keyword}"匹配的歌曲。`
    } else {
      const playerState = (await import('@/store/player/state')).default
      if (!playerState.playMusicInfo?.musicInfo) return '当前没有正在播放的歌曲。'
      musicInfo = playerState.playMusicInfo.musicInfo
    }

    const { addListMusics } = await import('@/core/list')
    await addListMusics('love', [musicInfo], 'bottom')
    return `已将《${musicInfo.name}》- ${musicInfo.singer} 添加到"我喜欢"`
  } catch (err: any) {
    return `添加失败：${err.message}`
  }
}

/**
 * 批量执行操作序列（一句话全自动操控）
 */
export const toolExecuteSequence = async (commands: Array<{ tool: string; args: any }>): Promise<string> => {
  const results: string[] = []
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i]
    if (!cmd?.tool) continue
    // 限制最多 8 个操作，防止失控
    if (i >= 8) {
      results.push(`已达到最大操作数（8），剩余操作已跳过。`)
      break
    }
    try {
      const result = await executeTool(cmd.tool, cmd.args || {})
      results.push(`[步骤${i + 1}] ${result}`)
    } catch (err: any) {
      results.push(`[步骤${i + 1}] 执行失败：${err.message}`)
    }
  }
  return results.join('\n')
}

// ============ 工具调度 ============
export const executeTool = async (toolName: string, args: any): Promise<string> => {
  switch (toolName) {
    case 'search_music':
      return toolSearchMusic(args.keyword, args.limit || 10)
    case 'play_music':
      return toolPlayMusic(args.keyword)
    case 'download_music':
      return toolDownloadMusic(args.keyword)
    case 'get_lyrics':
      return toolGetLyrics(args.keyword)
    case 'navigate':
      return toolNavigate(args.target)
    case 'get_current_song':
      return toolGetCurrentSong()
    case 'control_player':
      return toolControlPlayer(args.action)
    case 'set_volume':
      return toolSetVolume(args.volume)
    case 'search_album':
      return toolSearchAlbum(args.keyword)
    case 'search_artist':
      return toolSearchArtist(args.keyword)
    case 'add_to_love':
      return toolAddToLove(args.keyword)
    case 'shazam':
      return toolShazam(args.duration || 5)
    case 'execute_sequence':
      return toolExecuteSequence(args.commands || [])
    default:
      return `未知工具：${toolName}`
  }
}
