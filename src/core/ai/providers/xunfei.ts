// @ts-nocheck
/**
 * 科大讯飞星火 WebSocket 提供商（内置可用，无需用户配置密钥）
 * 支持 Spark Ultra-32K、Spark X (X2)、Spark X (X1.5)
 */
import { getXunfeiConfig, type XunfeiConfig } from '../config'
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
const buildAuthUrl = (config: XunfeiConfig): string => {
  const url = new URL(config.wssUrl)
  const host = url.host
  const path = url.pathname || '/'
  // RFC1123 格式日期
  const date = new Date().toUTCString()

  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`
  const signature = bytesToBase64(hmacSha256(strToBytes(config.apiSecret), strToBytes(signatureOrigin)))

  const authorizationOrigin = `api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  const authorization = bytesToBase64(strToBytes(authorizationOrigin))

  return `${config.wssUrl}?authorization=${urlencode(authorization)}&date=${urlencode(date)}&host=${urlencode(host)}`
}

/**
 * 科大讯飞对话（流式）
 * @param messages 消息列表
 * @param onChunk 流式回调
 * @param onToolCall 工具调用回调
 * @param serviceId 服务 ID（用于选择不同的讯飞模型配置）
 */
export const xunfeiChat = (
  messages: ChatMessage[],
  onChunk?: (text: string) => void,
  onToolCall?: (toolCall: any) => void,
  serviceId: string = 'xunfei'
): Promise<ChatResult> => {
  return new Promise((resolve, reject) => {
    const config = getXunfeiConfig(serviceId)
    let authUrl: string
    try {
      authUrl = buildAuthUrl(config)
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
            domain: config.domain,
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
            reject(new Error(`科大讯飞错误[${code}]: ${data.header?.message || '未知错误'}`))
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
        reject(new Error('WebSocket连接失败'))
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
