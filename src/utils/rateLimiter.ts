/**
 * API 请求限流工具
 * 防止短时间内对同一音源发起过多请求导致 IP 封禁
 * 支持令牌桶算法和指数退避重试
 */

/** 每个音源的限流配置 */
interface RateLimitConfig {
  /** 每秒允许的请求数 */
  requestsPerSecond: number
  /** 最大并发请求数 */
  maxConcurrent: number
  /** 重试基础延迟（ms） */
  retryBaseDelay: number
  /** 最大重试次数 */
  maxRetries: number
}

/** 默认限流配置 */
const DEFAULT_CONFIG: RateLimitConfig = {
  requestsPerSecond: 2,
  maxConcurrent: 3,
  retryBaseDelay: 1000,
  maxRetries: 3,
}

/** 各音源的具体配置 */
const PLATFORM_CONFIGS: Record<string, Partial<RateLimitConfig>> = {
  wy: { requestsPerSecond: 3, maxConcurrent: 5 },   // 网易云限制较宽松
  tx: { requestsPerSecond: 2, maxConcurrent: 3 },   // QQ音乐限制较严
  kg: { requestsPerSecond: 2, maxConcurrent: 3 },
  kw: { requestsPerSecond: 2, maxConcurrent: 3 },
  mg: { requestsPerSecond: 2, maxConcurrent: 3 },
}

/** 令牌桶状态 */
interface TokenBucket {
  tokens: number
  lastRefill: number
  running: number
  queue: Array<{
    task: () => Promise<any>
    resolve: (value: any) => void
    reject: (error: Error) => void
  }>
}

const buckets: Record<string, TokenBucket> = {}

/** 获取或创建令牌桶 */
const getBucket = (platform: string): TokenBucket => {
  if (!buckets[platform]) {
    buckets[platform] = {
      tokens: 0,
      lastRefill: Date.now(),
      running: 0,
      queue: [],
    }
  }
  return buckets[platform]
}

/** 获取平台配置 */
const getConfig = (platform: string): RateLimitConfig => {
  const platformConfig = PLATFORM_CONFIGS[platform] || {}
  return { ...DEFAULT_CONFIG, ...platformConfig }
}

/** 补充令牌 */
const refillTokens = (bucket: TokenBucket, config: RateLimitConfig) => {
  const now = Date.now()
  const elapsed = (now - bucket.lastRefill) / 1000
  bucket.tokens = Math.min(
    config.requestsPerSecond,
    bucket.tokens + elapsed * config.requestsPerSecond
  )
  bucket.lastRefill = now
}

/** 处理队列 */
const processQueue = (bucket: TokenBucket, config: RateLimitConfig) => {
  while (bucket.queue.length > 0) {
    if (bucket.running >= config.maxConcurrent) break
    if (bucket.tokens < 1) break

    bucket.tokens -= 1
    bucket.running += 1
    const { task, resolve, reject } = bucket.queue.shift()!

    task()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        bucket.running -= 1
        processQueue(bucket, config)
      })
  }
}

/**
 * 限流执行 API 请求
 * @param platform 音源平台标识
 * @param task 请求任务
 * @param retries 当前重试次数
 */
export const rateLimitedRequest = async <T>(
  platform: string,
  task: () => Promise<T>,
  retries = 0,
): Promise<T> => {
  const config = getConfig(platform)
  const bucket = getBucket(platform)

  // 补充令牌
  refillTokens(bucket, config)

  // 如果可以立即执行
  if (bucket.tokens >= 1 && bucket.running < config.maxConcurrent && bucket.queue.length === 0) {
    bucket.tokens -= 1
    bucket.running += 1

    try {
      const result = await task()
      return result
    } catch (error: any) {
      if (
        retries < config.maxRetries &&
        (error.message?.includes('too many') ||
          error.message?.includes('rate') ||
          error.message?.includes('429') ||
          error.message?.includes('频繁'))
      ) {
        // 限流错误：指数退避重试
        const delay = config.retryBaseDelay * Math.pow(2, retries)
        await new Promise(resolve => setTimeout(resolve, delay))
        return rateLimitedRequest(platform, task, retries + 1)
      }
      throw error
    } finally {
      bucket.running -= 1
      processQueue(bucket, config)
    }
  }

  // 需要排队等待
  return new Promise<T>((resolve, reject) => {
    bucket.queue.push({
      task: async () => {
        try {
          const result = await task()
          resolve(result)
        } catch (error: any) {
          if (
            retries < config.maxRetries &&
            (error.message?.includes('too many') ||
              error.message?.includes('rate') ||
              error.message?.includes('429') ||
              error.message?.includes('频繁'))
          ) {
            const delay = config.retryBaseDelay * Math.pow(2, retries)
            await new Promise(r => setTimeout(r, delay))
            try {
              const result = await rateLimitedRequest(platform, task, retries + 1)
              resolve(result)
            } catch (e) {
              reject(e)
            }
          } else {
            reject(error)
          }
        }
      },
      resolve,
      reject,
    })
    processQueue(bucket, config)
  })
}

/**
 * 批量限流请求
 * @param platform 音源平台
 * @param tasks 请求任务数组
 * @param onProgress 进度回调
 */
export const batchRateLimitedRequests = async <T>(
  platform: string,
  tasks: Array<() => Promise<T>>,
  onProgress?: (completed: number, total: number) => void,
): Promise<T[]> => {
  const results: T[] = []
  const total = tasks.length

  for (let i = 0; i < total; i++) {
    try {
      const result = await rateLimitedRequest(platform, tasks[i])
      results.push(result)
    } catch (error) {
      // 单个任务失败不中断整个批次
      console.warn(`[RateLimit] 批量请求第 ${i + 1}/${total} 个失败:`, error)
      results.push(null as unknown as T)
    }
    onProgress?.(i + 1, total)
  }

  return results
}

/**
 * 获取当前限流状态（调试用）
 */
export const getRateLimitStatus = (platform: string) => {
  const bucket = buckets[platform]
  if (!bucket) return null
  const config = getConfig(platform)
  refillTokens(bucket, config)
  return {
    tokens: Math.floor(bucket.tokens),
    running: bucket.running,
    queueSize: bucket.queue.length,
    maxConcurrent: config.maxConcurrent,
  }
}

/**
 * 清除所有限流状态
 */
export const clearRateLimitState = () => {
  for (const key of Object.keys(buckets)) {
    delete buckets[key]
  }
}