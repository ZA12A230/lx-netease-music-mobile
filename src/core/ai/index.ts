/**
 * AI 统一入口
 * 管理对话流程、工具调用循环、流式输出
 */
import { xunfeiChat, type ChatMessage } from './providers/xunfei'
import { openaiChat } from './providers/openai'
import { executeTool, TOOL_DEFINITIONS } from './tools'
import { checkQuota, incrementQuota } from './quota'
import {
  PRESET_SERVICES,
  DEFAULT_SERVICE_ID,
  AI_STORAGE_KEYS,
  type AIServiceConfig,
} from './config'
import { getData, saveData } from '@/utils/data'

// ============ System Prompt ============
const buildSystemPrompt = (): string => {
  const toolDescs = TOOL_DEFINITIONS.map((t) =>
    `- ${t.name}: ${t.description}\n  参数: ${JSON.stringify(t.parameters)}`
  ).join('\n')

  return `你是LX-N Music音乐播放器的AI助手，由开发者G佑创建。你可以全自动操控软件，帮助用户搜索音乐、播放歌曲、下载音乐、获取歌词、导航页面、控制播放器等。用户只需要一句话，你就会自动执行所有必要的操作。

你可以调用以下工具来帮助用户。当需要调用工具时，在回复中包含工具调用，格式为单独一行：
<<TOOL>>{"name":"工具名","args":{参数}}<<END>>

可用工具：
${toolDescs}

使用规则：
1. 当用户要求搜索、播放、下载歌曲时，直接调用对应工具，不要询问用户额外信息。
2. 工具调用后，根据返回结果用自然语言回复用户。
3. 可以连续调用多个工具（每次一个），直到完成用户请求。
4. 如果用户的话不涉及音乐操作，正常聊天即可。
5. 回复要简洁友好，用中文。
6. 当用户说"播放xxx"时，调用play_music工具。
7. 当用户说"下载xxx"时，调用download_music工具。
8. 当用户说"搜索xxx"时，调用search_music工具。
9. 当用户问歌词时，调用get_lyrics工具。
10. 你也可以总结歌词、推荐音乐、聊天等。

全自动操控规则（重要）：
11. 当用户的请求包含多个操作时（例如"播放周杰伦的歌并下载"、"搜索周杰伦然后播放晴天"），使用execute_sequence工具一次性执行多个操作，实现全自动操控。
12. 你可以控制播放器：播放/暂停/上一首/下一首/快进/快退（control_player工具）。
13. 你可以设置音量（set_volume工具，0-100）。
14. 你可以搜索专辑（search_album）和歌手（search_artist）。
15. 你可以将歌曲添加到"我喜欢"（add_to_love）。
16. 你可以导航到不同页面（navigate工具）。
17. 当用户说"帮我..."、"自动..."时，主动使用execute_sequence组合多个工具完成全套操作。
18. 执行操作时不需要逐步确认，直接执行，然后告诉用户结果。`
}

// ============ 服务管理 ============
let _activeServiceId: string = DEFAULT_SERVICE_ID
let _userApiKeys: Record<string, string> = {}

export const initAiService = async () => {
  _activeServiceId = (await getData<string>(AI_STORAGE_KEYS.activeService)) || DEFAULT_SERVICE_ID
  _userApiKeys = (await getData<Record<string, string>>(AI_STORAGE_KEYS.userApiKeys)) || {}
}

export const getActiveServiceId = () => _activeServiceId

export const setActiveService = async (serviceId: string) => {
  _activeServiceId = serviceId
  await saveData(AI_STORAGE_KEYS.activeService, serviceId)
}

export const getUserApiKey = (serviceId: string): string => _userApiKeys[serviceId] || ''

export const setUserApiKey = async (serviceId: string, key: string) => {
  _userApiKeys[serviceId] = key
  await saveData(AI_STORAGE_KEYS.userApiKeys, _userApiKeys)
}

export const getActiveServiceConfig = (): AIServiceConfig => {
  return PRESET_SERVICES.find((s) => s.id === _activeServiceId) || PRESET_SERVICES[0]
}

export const getPresetServices = () => PRESET_SERVICES

// ============ 对话核心 ============
const TOOL_CALL_REGEX = /<<TOOL>>(.*?)<<END>>/s

/**
 * 调用 AI 服务
 */
const callAI = async (
  messages: ChatMessage[],
  onChunk?: (text: string) => void
): Promise<string> => {
  const config = getActiveServiceConfig()
  if (config.type === 'xunfei') {
    const result = await xunfeiChat(messages, onChunk)
    return result.content
  } else {
    const apiKey = getUserApiKey(config.id)
    if (!apiKey) throw new Error(`请先在设置中配置${config.name}的API Key`)
    const result = await openaiChat(
      { apiUrl: config.apiUrl!, apiKey, model: config.model || '' },
      messages,
      onChunk
    )
    return result.content
  }
}

/**
 * AI 对话（含工具调用循环）
 */
export const chat = async (
  userMessage: string,
  history: ChatMessage[],
  onChunk?: (text: string) => void,
  onToolExecuted?: (toolName: string, result: string) => void
): Promise<string> => {
  // 1. 检查用量
  const quota = await checkQuota()
  if (!quota.allowed) {
    throw new Error(quota.reason || '对话次数已用完，请输入管理员密码授权')
  }

  // 2. 构造消息
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    ...history,
    { role: 'user', content: userMessage },
  ]

  // 3. 工具调用循环（最多5轮）
  let maxRounds = 5
  let lastResponse = ''

  while (maxRounds-- > 0) {
    const response = await callAI(messages, onChunk)
    lastResponse = response

    // 检查是否有工具调用
    const match = response.match(TOOL_CALL_REGEX)
    if (!match) {
      // 没有工具调用，对话结束
      break
    }

    // 解析工具调用
    let toolCall: { name: string; args: any }
    try {
      toolCall = JSON.parse(match[1].trim())
    } catch {
      // 解析失败，直接返回
      break
    }

    // 执行工具
    const toolResult = await executeTool(toolCall.name, toolCall.args || {})
    onToolExecuted?.(toolCall.name, toolResult)

    // 把工具调用和结果加入消息
    messages.push({ role: 'assistant', content: response })
    messages.push({
      role: 'user',
      content: `工具 ${toolCall.name} 执行结果：\n${toolResult}\n\n请根据结果回复用户，如果任务已完成请总结，如果需要继续操作请调用下一个工具。`,
    })

    // 如果是最后一轮，获取最终回复
    if (maxRounds === 0) {
      const finalResponse = await callAI(messages, onChunk)
      lastResponse = finalResponse
    }
  }

  // 4. 增加用量计数
  await incrementQuota()

  // 5. 清理回复中的工具调用标记
  return lastResponse.replace(TOOL_CALL_REGEX, '').trim()
}

/**
 * 总结歌词
 */
export const summarizeLyrics = async (
  lyrics: string,
  onChunk?: (text: string) => void
): Promise<string> => {
  const quota = await checkQuota()
  if (!quota.allowed) throw new Error(quota.reason)

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: '你是音乐歌词分析助手。请简洁地总结歌词的主题、情感和故事，用中文回复，不超过200字。',
    },
    { role: 'user', content: `请总结以下歌词：\n\n${lyrics}` },
  ]

  const result = await callAI(messages, onChunk)
  await incrementQuota()
  return result
}
