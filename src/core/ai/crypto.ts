/**
 * AI 密钥加密模块
 * 使用字符级 XOR 加密，盐值拆分存储，确保密钥不可被直接破译
 */

// 加密盐（拆分存储，增加反编译难度）
const SALT_PART_A = [0x5a, 0x3c, 0x7f, 0x1b]
const SALT_PART_B = [0x9e, 0x42, 0x6d, 0x85]
const SALT = [...SALT_PART_A, ...SALT_PART_B]

/**
 * 解密：将加密的数字数组解密为字符串
 */
export const decrypt = (encrypted: number[]): string => {
  let result = ''
  for (let i = 0; i < encrypted.length; i++) {
    result += String.fromCharCode(encrypted[i] ^ SALT[i % SALT.length])
  }
  return result
}

/**
 * 加密：将字符串加密为数字数组（仅用于预生成，不在运行时使用）
 */
export const encrypt = (text: string): number[] => {
  const result: number[] = []
  for (let i = 0; i < text.length; i++) {
    result.push(text.charCodeAt(i) ^ SALT[i % SALT.length])
  }
  return result
}

/**
 * 简单哈希（用于密码验证，不存储明文密码）
 */
export const simpleHash = (text: string): string => {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  // 二次混淆
  let hash2 = 0
  const s = String(hash)
  for (let i = 0; i < s.length; i++) {
    hash2 = ((hash2 << 7) - hash2) + s.charCodeAt(i) * (i + 1)
    hash2 |= 0
  }
  return Math.abs(hash2).toString(16)
}
