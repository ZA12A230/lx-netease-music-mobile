/**
 * OpenAI 兼容 API 适配器
 * 支持：Kimi、通义千问、DeepSeek、OpenAI、Claude、豆包、Gemini、智谱等
 */
import axios from 'axios'
import type { ChatMessage, ChatResult } from './xunfei'

export interface OpenAICompatConfig {
  apiUrl: string
  apiKey: string
  model: string
}

/**
 * OpenAI 兼容对话（流式，用 XMLHttpRequest 实现 SSE 解析）
 */
export const openaiChat = (
  config: OpenAICompatConfig,
  messages: ChatMessage[],
  onChunk?: (text: string) => void,
  onToolCall?: (toolCall: any) => void
): Promise<ChatResult> => {
  return new Promise((resolve, reject) => {
    const isClaude = config.apiUrl.includes('anthropic.com')
    const isGemini = config.apiUrl.includes('generativelanguage.googleapis.com')

    let body: string
    let headers: Record<string, string>

    if (isClaude) {
      // Anthropic 原生格式
      const systemMsg = messages.find((m) => m.role === 'system')
      const chatMsgs = messages.filter((m) => m.role !== 'system')
      body = JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        system: systemMsg?.content || '',
        messages: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      })
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      }
    } else if (isGemini) {
      // Gemini 格式
      const url = `${config.apiUrl}/${config.model}:generateContent?key=${config.apiKey}`
      body = JSON.stringify({
        contents: messages.filter((m) => m.role !== 'system').map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        systemInstruction: messages.find((m) => m.role === 'system')
          ? { parts: [{ text: messages.find((m) => m.role === 'system')!.content }] }
          : undefined,
        generationConfig: { maxOutputTokens: 4096, temperature: 0.5 },
      })
      // Gemini 不支持流式（简化处理），直接 POST
      axios.post(url, body, { headers: { 'Content-Type': 'application/json' }, timeout: 60000 })
        .then((resp) => {
          const text = resp.data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || ''
          onChunk?.(text)
          resolve({ content: text })
        })
        .catch((err) => reject(new Error(err.response?.data?.error?.message || err.message)))
      return
    } else {
      // 标准 OpenAI 兼容格式
      body = JSON.stringify({
        model: config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        max_tokens: 4096,
        temperature: 0.5,
      })
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      }
    }

    // 用 XMLHttpRequest 实现流式 SSE
    const xhr = new XMLHttpRequest()
    xhr.open('POST', config.apiUrl)
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
    xhr.timeout = 60000

    let fullContent = ''
    let buffer = ''
    let resolved = false

    const finish = (result: ChatResult) => {
      if (resolved) return
      resolved = true
      resolve(result)
    }

    xhr.onprogress = () => {
      // 获取新增的数据
      const newText = xhr.responseText.substring(buffer.length)
      buffer = xhr.responseText

      // 解析 SSE
      const lines = newText.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const data = trimmed.substring(5).trim()
        if (data === '[DONE]') {
          finish({ content: fullContent })
          continue
        }
        try {
          const json = JSON.parse(data)
          if (isClaude) {
            // Anthropic SSE 格式
            if (json.type === 'content_block_delta' && json.delta?.text) {
              fullContent += json.delta.text
              onChunk?.(json.delta.text)
            }
          } else {
            // OpenAI 格式
            const delta = json.choices?.[0]?.delta
            if (delta?.content) {
              fullContent += delta.content
              onChunk?.(delta.content)
            }
            if (delta?.tool_calls) {
              onToolCall?.(delta.tool_calls)
            }
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 400) {
        if (!resolved) {
          resolved = true
          let errMsg = `HTTP ${xhr.status}`
          try {
            const errData = JSON.parse(xhr.responseText)
            errMsg = errData.error?.message || errMsg
          } catch {}
          reject(new Error(errMsg))
        }
        return
      }
      finish({ content: fullContent })
    }

    xhr.onerror = () => {
      if (!resolved) {
        resolved = true
        reject(new Error('网络请求失败'))
      }
    }

    xhr.ontimeout = () => {
      if (!resolved) {
        resolved = true
        reject(new Error('请求超时'))
      }
    }

    xhr.send(body)
  })
}
