/**
 * AI 用量管理：10次免费对话，超出需管理员密码授权
 */
import { getData, saveData } from '@/utils/data'
import { AI_STORAGE_KEYS, FREE_QUOTA, verifyAdminPassword } from './config'

export const getQuotaCount = async (): Promise<number> => {
  return (await getData<number>(AI_STORAGE_KEYS.quotaCount)) ?? 0
}

export const incrementQuota = async (): Promise<number> => {
  const count = await getQuotaCount()
  await saveData(AI_STORAGE_KEYS.quotaCount, count + 1)
  return count + 1
}

export const getRemainingQuota = async (): Promise<number> => {
  const authorized = await isAuthorized()
  if (authorized) return -1 // 无限
  const count = await getQuotaCount()
  return Math.max(0, FREE_QUOTA - count)
}

export const isAuthorized = async (): Promise<boolean> => {
  return (await getData<boolean>(AI_STORAGE_KEYS.authorized)) ?? false
}

export const authorize = async (password: string): Promise<boolean> => {
  if (verifyAdminPassword(password)) {
    await saveData(AI_STORAGE_KEYS.authorized, true)
    return true
  }
  return false
}

export const resetQuota = async () => {
  await saveData(AI_STORAGE_KEYS.quotaCount, 0)
}

export interface QuotaStatus {
  allowed: boolean
  reason?: string
  remaining: number
  authorized: boolean
}

export const checkQuota = async (): Promise<QuotaStatus> => {
  const authorized = await isAuthorized()
  if (authorized) return { allowed: true, remaining: -1, authorized: true }
  const count = await getQuotaCount()
  const remaining = Math.max(0, FREE_QUOTA - count)
  if (count >= FREE_QUOTA) {
    return {
      allowed: false,
      reason: `免费对话次数（${FREE_QUOTA}次）已用完，请输入管理员密码继续使用`,
      remaining: 0,
      authorized: false,
    }
  }
  return { allowed: true, remaining, authorized: false }
}
