// @ts-nocheck
/**
 * AI 服务配置模块
 * 包含内置的科大讯飞密钥（加密存储，不可破译）和各平台 API 配置
 */
import { decrypt, simpleHash } from './crypto'

// ============ 内置科大讯飞 Spark Ultra-32K 密钥（加密存储）============
const _ENC_APPID = [110, 12, 27, 126, 251, 123, 89, 188]
const _ENC_API_SECRET = [23, 86, 23, 112, 196, 21, 59, 233, 20, 70, 46, 98, 208, 40, 52, 252, 21, 104, 42, 47, 211, 40, 56, 182, 20, 104, 54, 46, 209, 6, 40, 181]
const _ENC_API_KEY = [57, 94, 79, 126, 167, 38, 9, 227, 105, 12, 76, 125, 252, 122, 89, 180, 57, 93, 29, 127, 172, 112, 94, 188, 59, 10, 27, 121, 253, 32, 90, 189]
const _ENC_WSS_URL = [45, 79, 12, 33, 177, 109, 30, 245, 59, 78, 20, 54, 255, 50, 4, 171, 34, 90, 82, 98, 235, 44, 67, 230, 53, 81, 80, 109, 170, 108, 93, 170, 57, 84, 30, 111]

// ============ 内置科大讯飞 Spark X 密钥（加密存储）============
const _ENC_SPARKX_APPID = [109, 88, 71, 120, 174, 116, 89, 183]
const _ENC_SPARKX_API_SECRET = [20, 107, 42, 43, 199, 22, 60, 252, 20, 123, 42, 47, 211, 21, 59, 238, 20, 104, 57, 119, 209, 6, 10, 182, 3, 14, 42, 41, 196, 40, 56, 181]
const _ENC_SPARKX_API_KEY = [60, 13, 74, 120, 253, 35, 84, 178, 56, 89, 27, 126, 170, 32, 8, 178, 108, 95, 27, 35, 169, 117, 9, 227, 60, 4, 27, 46, 168, 118, 85, 227]
const _ENC_SPARKX_WSS_X2 = [45, 79, 12, 33, 177, 109, 30, 245, 59, 78, 20, 54, 255, 50, 4, 171, 34, 90, 82, 98, 235, 44, 67, 230, 53, 81, 80, 99, 172]
const _ENC_SPARKX_WSS_X1 = [45, 79, 12, 33, 177, 109, 30, 245, 59, 78, 20, 54, 255, 50, 4, 171, 34, 90, 82, 98, 235, 44, 67, 230, 53, 81, 80, 109, 175, 109, 21, 180]

// 管理员密码（加密存储）
const _ENC_ADMIN_PWD = [48, 69, 77, 43, 175, 115, 93, 178, 107, 15]

// ============ 讯飞配置接口 ============
export interface XunfeiConfig {
  appid: string
  apiSecret: string
  apiKey: string
  wssUrl: string
  domain: string
}

/**
 * 获取内置科大讯飞配置（根据服务 ID 返回不同配置）
 * 支持三个内置讯飞服务：
 * - xunfei: Spark Ultra-32K (v4.0)
 * - xunfei_spark_x2: Spark X (x2)
 * - xunfei_spark_x1: Spark X (x1.5)
 */
export const getXunfeiConfig = (serviceId: string = 'xunfei'): XunfeiConfig => {
  switch (serviceId) {
    case 'xunfei_spark_x2':
      return {
        appid: decrypt(_ENC_SPARKX_APPID),
        apiSecret: decrypt(_ENC_SPARKX_API_SECRET),
        apiKey: decrypt(_ENC_SPARKX_API_KEY),
        wssUrl: decrypt(_ENC_SPARKX_WSS_X2),
        domain: 'x2',
      }
    case 'xunfei_spark_x1':
      return {
        appid: decrypt(_ENC_SPARKX_APPID),
        apiSecret: decrypt(_ENC_SPARKX_API_SECRET),
        apiKey: decrypt(_ENC_SPARKX_API_KEY),
        wssUrl: decrypt(_ENC_SPARKX_WSS_X1),
        domain: 'x1',
      }
    case 'xunfei':
    default:
      return {
        appid: decrypt(_ENC_APPID),
        apiSecret: decrypt(_ENC_API_SECRET),
        apiKey: decrypt(_ENC_API_KEY),
        wssUrl: decrypt(_ENC_WSS_URL),
        domain: '4.0Ultra',
      }
  }
}

/**
 * 验证管理员密码
 */
export const verifyAdminPassword = (input: string): boolean => {
  const correct = decrypt(_ENC_ADMIN_PWD)
  return input === correct
}

// 管理员密码哈希（用于存储授权状态）
export const ADMIN_PWD_HASH = simpleHash(decrypt(_ENC_ADMIN_PWD))

// ============ AI 服务类型 ============
export type AIProviderType = 'xunfei' | 'openai_compatible'

export interface AIServiceConfig {
  id: string
  name: string
  type: AIProviderType
  // OpenAI 兼容接口地址
  apiUrl?: string
  // 默认模型
  model?: string
  // 是否内置（无需用户配置密钥）
  builtin: boolean
  // 用户 API Key（加密存储）
  apiKey?: string
}

// ============ 预置 AI 服务列表 ============
export const PRESET_SERVICES: AIServiceConfig[] = [
  {
    id: 'xunfei',
    name: '科大讯飞 Spark Ultra-32K (内置)',
    type: 'xunfei',
    model: '4.0Ultra',
    builtin: true,
  },
  {
    id: 'xunfei_spark_x2',
    name: '科大讯飞 Spark X (X2 内置)',
    type: 'xunfei',
    model: 'x2',
    builtin: true,
  },
  {
    id: 'xunfei_spark_x1',
    name: '科大讯飞 Spark X (X1.5 内置)',
    type: 'xunfei',
    model: 'x1',
    builtin: true,
  },
  {
    id: 'kimi',
    name: 'Kimi (Moonshot)',
    type: 'openai_compatible',
    apiUrl: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'moonshot-v1-8k',
    builtin: false,
  },
  {
    id: 'qwen',
    name: '通义千问',
    type: 'openai_compatible',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-turbo',
    builtin: false,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'openai_compatible',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    builtin: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai_compatible',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    builtin: false,
  },
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    type: 'openai_compatible',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-sonnet-20241022',
    builtin: false,
  },
  {
    id: 'doubao',
    name: '豆包 (火山引擎)',
    type: 'openai_compatible',
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-pro-32k',
    builtin: false,
  },
  {
    id: 'gemini',
    name: 'Gemini (Google)',
    type: 'openai_compatible',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    model: 'gemini-1.5-flash',
    builtin: false,
  },
  {
    id: 'zhipu',
    name: '智谱 (GLM)',
    type: 'openai_compatible',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
    builtin: false,
  },
]

// 默认服务 ID
export const DEFAULT_SERVICE_ID = 'xunfei'

// 免费对话次数（全局共享，不分 AI 模型，用完自动锁死）
export const FREE_QUOTA = 10

// 存储键
export const AI_STORAGE_KEYS = {
  serviceConfig: '@ai_service_config_v1',
  activeService: '@ai_active_service_v1',
  quotaCount: '@ai_quota_count_v1',
  authorized: '@ai_authorized_v1',
  chatHistory: '@ai_chat_history_v1',
  userApiKeys: '@ai_user_apikeys_v1',
}
