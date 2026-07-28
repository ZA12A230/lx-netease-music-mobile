/**
 * 语音控制
 * 通过语音/文本指令控制播放、切歌、搜索、调节音量等操作
 * 注：React Native 无内置语音识别 API，本模块提供指令解析框架
 *     实际语音输入需接入第三方 SDK（如 react-native-voice）
 */
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'
import { play, pause, togglePlay, playNext, playPrev } from '@/core/player/player'
import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'
import { setVolume, setPlaybackRate } from '@/plugins/player'

export type CommandType =
  | 'play' | 'pause' | 'toggle' | 'next' | 'prev'
  | 'volume_up' | 'volume_down' | 'volume_set'
  | 'rate_set'
  | 'search' | 'play_list' | 'play_mode'
  | 'add_favorite' | 'share' | 'info'
  | 'unknown'

export interface ParsedCommand {
  raw: string
  type: CommandType
  params?: string | number
  confidence: number
}

export interface CommandHistory {
  id: string
  raw: string
  type: CommandType
  timestamp: number
  success: boolean
}

const HISTORY_KEY = '@voice_command_history_v1'
const MAX_HISTORY = 100

/** 命令关键词映射表 */
const COMMAND_PATTERNS: Array<{ patterns: RegExp[]; type: CommandType; extractor?: (m: RegExpMatchArray) => any }> = [
  // 播放控制
  { patterns: [/^播放$/, /^开始播放$/, /^继续播放$/, /^play$/i], type: 'play' },
  { patterns: [/^暂停$/, /^停止$/, /^pause$/i, /^stop$/i], type: 'pause' },
  { patterns: [/^播放暂停$/, /^切换播放$/, /^toggle$/i], type: 'toggle' },
  { patterns: [/^下一首$/, /^切歌$/, /^下一曲$/, /^next$/i], type: 'next' },
  { patterns: [/^上一首$/, /^前一首$/, /^上一曲$/, /^prev$/i, /^previous$/i], type: 'prev' },

  // 音量控制
  {
    patterns: [/音量[大高]一点|音量[增大加]|volume up/i, /^大声点$/],
    type: 'volume_up',
  },
  {
    patterns: [/音量[小低]一点|音量[减细小]|volume down/i, /^小声点$/],
    type: 'volume_down',
  },
  {
    patterns: [/音量[设调为]?(\d{1,3})|volume (\d{1,3})/i],
    type: 'volume_set',
    extractor: (m) => parseInt(m[1], 10),
  },

  // 播放速率
  {
    patterns: [/速率[设调为]?(\d+(\.\d+)?)|speed (\d+(\.\d+)?)/i, /倍速[设调为]?(\d+(\.\d+)?)/],
    type: 'rate_set',
    extractor: (m) => parseFloat(m[1]),
  },

  // 搜索
  {
    patterns: [/^搜索\s*(.+)$/, /^搜\s*(.+)$/, /^search\s+(.+)$/i, /^找\s*(.+)$/],
    type: 'search',
    extractor: (m) => m[1].trim(),
  },

  // 播放歌单
  {
    patterns: [/^播放歌单\s*(.+)$/, /^播放列表\s*(.+)$/, /^play list\s+(.+)$/i],
    type: 'play_list',
    extractor: (m) => m[1].trim(),
  },

  // 播放模式
  {
    patterns: [/随机播放|random/i],
    type: 'play_mode',
    extractor: () => 'random',
  },
  {
    patterns: [/单曲循环|single/i],
    type: 'play_mode',
    extractor: () => 'singleLoop',
  },
  {
    patterns: [/列表循环|list loop/i],
    type: 'play_mode',
    extractor: () => 'listLoop',
  },
  {
    patterns: [/顺序播放|顺序/i],
    type: 'play_mode',
    extractor: () => 'list',
  },

  // 收藏
  { patterns: [/^收藏$/, /^加入收藏$/, /^喜欢$/], type: 'add_favorite' },
  // 分享
  { patterns: [/^分享$/, /^share$/i], type: 'share' },
  // 信息
  { patterns: [/^歌曲信息$/, /^当前歌曲$/, /^info$/i], type: 'info' },
]

/** 解析命令 */
export const parseCommand = (text: string): ParsedCommand => {
  const raw = text.trim()
  if (!raw) {
    return { raw, type: 'unknown', confidence: 0 }
  }

  for (const { patterns, type, extractor } of COMMAND_PATTERNS) {
    for (const p of patterns) {
      const m = raw.match(p)
      if (m) {
        return {
          raw,
          type,
          params: extractor ? extractor(m) : undefined,
          confidence: 0.9,
        }
      }
    }
  }

  // 模糊匹配兜底
  if (/播|play/i.test(raw)) return { raw, type: 'play', confidence: 0.5 }
  if (/停|pause|stop/i.test(raw)) return { raw, type: 'pause', confidence: 0.5 }
  if (/下|next/i.test(raw)) return { raw, type: 'next', confidence: 0.5 }
  if (/上|prev/i.test(raw)) return { raw, type: 'prev', confidence: 0.5 }

  return { raw, type: 'unknown', confidence: 0 }
}

/** 执行命令 */
export const executeCommand = async (cmd: ParsedCommand): Promise<boolean> => {
  try {
    switch (cmd.type) {
      case 'play':
        await play()
        break
      case 'pause':
        await pause()
        break
      case 'toggle':
        togglePlay()
        break
      case 'next':
        await playNext()
        break
      case 'prev':
        await playPrev()
        break
      case 'volume_up': {
        const cur = settingState.setting['player.volume']
        const v = Math.min(1, cur + 0.1)
        await setVolume(v)
        await updateSetting({ 'player.volume': v })
        break
      }
      case 'volume_down': {
        const cur = settingState.setting['player.volume']
        const v = Math.max(0, cur - 0.1)
        await setVolume(v)
        await updateSetting({ 'player.volume': v })
        break
      }
      case 'volume_set': {
        const val = Number(cmd.params)
        if (isNaN(val) || val < 0 || val > 100) return false
        const v = val / 100
        await setVolume(v)
        await updateSetting({ 'player.volume': v })
        break
      }
      case 'rate_set': {
        const rate = Number(cmd.params)
        if (isNaN(rate) || rate < 0.5 || rate > 2) return false
        await updateSetting({ 'player.playbackRate': rate })
        await setPlaybackRate(rate)
        break
      }
      case 'play_mode': {
        const mode = String(cmd.params) as LX.AppSetting['player.togglePlayMethod']
        await updateSetting({ 'player.togglePlayMethod': mode })
        break
      }
      // search / play_list / add_favorite / share / info 需 UI 层处理
      case 'search':
      case 'play_list':
      case 'add_favorite':
      case 'share':
      case 'info':
        addDevLog('info', 'VoiceCommand', `需UI处理: ${cmd.type} = ${cmd.params}`)
        return true
      case 'unknown':
      default:
        return false
    }
    addDevLog('info', 'VoiceCommand', `执行: ${cmd.type} = ${cmd.params ?? ''}`)
    return true
  } catch (e: any) {
    addDevLog('error', 'VoiceCommand', `执行失败: ${e?.message}`)
    return false
  }
}

/** 解析并执行 */
export const parseAndExecute = async (text: string): Promise<{ cmd: ParsedCommand; success: boolean }> => {
  const cmd = parseCommand(text)
  const success = await executeCommand(cmd)
  await addHistory(cmd, success)
  return { cmd, success }
}

/** 添加历史记录 */
const addHistory = async (cmd: ParsedCommand, success: boolean): Promise<void> => {
  const history = await getHistory()
  history.unshift({
    id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    raw: cmd.raw,
    type: cmd.type,
    timestamp: Date.now(),
    success,
  })
  await saveData(HISTORY_KEY, history.slice(0, MAX_HISTORY))
}

/** 获取历史记录 */
export const getHistory = async (): Promise<CommandHistory[]> => {
  const data = await getData<CommandHistory[]>(HISTORY_KEY)
  return data || []
}

/** 清空历史 */
export const clearHistory = async (): Promise<void> => {
  await saveData(HISTORY_KEY, [])
  addDevLog('info', 'VoiceCommand', '历史已清空')
}

/** 获取建议命令（用于快捷输入） */
export const getSuggestedCommands = (): Array<{ text: string; desc: string }> => [
  { text: '播放', desc: '开始播放' },
  { text: '暂停', desc: '暂停播放' },
  { text: '下一首', desc: '切到下一首' },
  { text: '上一首', desc: '回到上一首' },
  { text: '音量大一点', desc: '音量+10%' },
  { text: '音量小一点', desc: '音量-10%' },
  { text: '音量50', desc: '设置音量为50%' },
  { text: '速率1.5', desc: '1.5倍速播放' },
  { text: '随机播放', desc: '切换随机模式' },
  { text: '搜索 晴天', desc: '搜索歌曲' },
]

/** 获取命令帮助 */
export const getCommandHelp = (): string => {
  return `🎙️ 语音控制命令帮助

【播放控制】
- 播放 / 暂停 / 切换播放
- 下一首 / 上一首

【音量控制】
- 音量大一点 / 音量小一点
- 音量50 (设置为50%)

【播放速率】
- 速率1.5 / 倍速0.8

【播放模式】
- 随机播放 / 单曲循环 / 列表循环 / 顺序播放

【其他】
- 搜索 歌曲名
- 播放歌单 歌单名
- 收藏 / 分享 / 歌曲信息`
}
