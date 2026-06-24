/**
 * 科大讯飞星火 WebSocket 提供商（内置可用，无需用户配置密钥）
 */
import { getXunfeiConfig } from '../config'
import { hmacSha256, strToBytes, bytesToBase64 } from '../sha256'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export interface ChatResult {
  content: string
  toolCalls?: any[]
}

const urlencode = (str: string): string => {
  return encodeURIComponent(str)
}

/**
 * 生成科大讯飞鉴权 URL
 */
const buildAuthUrl = (): string => {
  const config = getXunfeiConfig()
  const wssUrl = config.wssUrl
  
  const urlMatch = wssUrl.match(/^(wss?):\/\/([^/:]+)(?::(\d+))?(\/.*)?$/)
  if (!urlMatch) {
    throw new Error('Invalid WSS URL')
  }
  
  const [, protocol, host, , path] = urlMatch
  const effectivePath = path || '/'
  
  const date = new Date().toUTCString()

  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${effectivePath} HTTP/1.1`
  const signature = bytesToBase64(hmacSha256(strToBytes(config.apiSecret), strToBytes(signatureOrigin)))

  const authorizationOrigin = `api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  const authorization = bytesToBase64(strToBytes(authorizationOrigin))

  return `${wssUrl}?authorization=${urlencode(authorization)}&date=${urlencode(date)}&host=${urlencode(host)}`
}

/**
 * 科大讯飞对话（流式）
 */
export const xunfeiChat = (
  messages: ChatMessage[],
  onChunk?: (text: string) => void,
  onToolCall?: (toolCall: any) => void
): Promise<ChatResult> => {
  return new Promise((resolve, reject) => {
    const config = getXunfeiConfig()
    let authUrl: string
    try {
      authUrl = buildAuthUrl()
    } catch (err: any) {
      reject(new Error('鉴权失败: ' + err.message))
      return
    }

    const ws = new WebSocket(authUrl)
    let fullContent = ''
    let toolCallsResult: any[] | undefined
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        try { ws.close() } catch {}
        reject(new Error('科大讯飞请求超时'))
      }
    }, 60000)

    ws.onopen = () => {
      // 构造消息（科大讯飞格式）
      const text = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const request = {
        header: {
          app_id: config.appid,
          uid: 'lx_ai_user',
        },
        parameter: {
          chat: {
            domain: config.model,
            max_tokens: 4096,
            temperature: 0.5,
          },
        },
        payload: {
          message: {
            text,
          },
        },
      }
      ws.send(JSON.stringify(request))
    }

    ws.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data)
        const code = data.header?.code
        if (code !== 0) {
          clearTimeout(timeout)
          if (!resolved) {
            resolved = true
            try { ws.close() } catch {}
            let errMsg = data.header?.message || '未知错误'
            if (code === 10000 || code === 10001 || code === 10002 || errMsg.includes('鉴权') || errMsg.includes('auth') || errMsg.includes('401')) {
              errMsg = `鉴权失败（错误码 ${code}）：${errMsg}\n\n可能的原因：\n1. 内置服务配额已用完\n2. 服务密钥已过期\n\n建议：点击右上角设置按钮，切换到其他AI服务（如Kimi、通义千问等）并配置自己的API Key`
            } else {
              errMsg = `音乐助手错误[${code}]: ${errMsg}`
            }
            reject(new Error(errMsg))
          }
          return
        }
        // 拼接内容
        const choices = data.payload?.choices
        if (choices?.text) {
          for (const item of choices.text) {
            if (item.content) {
              fullContent += item.content
              onChunk?.(item.content)
            }
          }
        }
        // 状态判断
        const status = data.payload?.choices?.status
        if (status === 2) {
          clearTimeout(timeout)
          if (!resolved) {
            resolved = true
            try { ws.close() } catch {}
            resolve({ content: fullContent, toolCalls: toolCallsResult })
          }
        }
      } catch (err) {
        // 忽略解析错误
      }
    }

    ws.onerror = (err: any) => {
      clearTimeout(timeout)
      if (!resolved) {
        resolved = true
        let errMsg = 'WebSocket连接失败'
        if (err?.message?.includes('401') || err?.status === 401) {
          errMsg = `鉴权失败（401）：内置服务可能已过期\n\n建议：点击右上角设置按钮，切换到其他AI服务（如Kimi、通义千问等）并配置自己的API Key`
        }
        reject(new Error(errMsg))
      }
    }

    ws.onclose = () => {
      clearTimeout(timeout)
      if (!resolved) {
        resolved = true
        resolve({ content: fullContent })
      }
    }
  })
}
