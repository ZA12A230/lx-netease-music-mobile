import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

/**
 * 对值进行防抖处理
 * 当值快速变化时，只在一定延迟后更新最终值
 * 适用于搜索输入框等场景，减少不必要的 API 请求
 *
 * @param value - 需要防抖的值
 * @param delay - 延迟时间（毫秒），默认 300ms
 * @returns 防抖后的值
 *
 * @example
 * const [searchText, setSearchText] = useState('')
 * const debouncedText = useDebounce(searchText, 500)
 * // debouncedText 只在用户停止输入 500ms 后更新
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // 如果 delay 为 0，立即更新
    if (delay <= 0) {
      setDebouncedValue(value)
      return
    }

    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * 创建防抖回调函数
 * 返回一个被防抖包装的函数，在连续调用时只执行最后一次
 *
 * @param callback - 需要防抖的回调函数
 * @param delay - 延迟时间（毫秒），默认 300ms
 * @param deps - 依赖数组，当依赖变化时重新创建防抖函数
 * @returns 防抖后的回调函数
 *
 * @example
 * const handleSearch = useDebouncedCallback(
 *   (text: string) => { fetchResults(text) },
 *   500,
 *   []
 * )
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300,
  deps: React.DependencyList = [],
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 保持 callback 引用最新
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // 当 deps 变化时清理定时器
  const depsKey = useMemo(() => JSON.stringify(deps), [deps])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [depsKey])

  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      if (delay <= 0) {
        callbackRef.current(...args)
        return
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null
        callbackRef.current(...args)
      }, delay)
    },
    [delay, depsKey],
  )
}

/**
 * 节流 Hook
 * 限制函数在指定时间内最多执行一次
 * 适用于滚动事件、窗口大小变化等高频场景
 *
 * @param callback - 需要节流的回调函数
 * @param interval - 时间间隔（毫秒），默认 200ms
 * @returns 节流后的回调函数
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  interval: number = 200,
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback)
  const lastRunRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      const elapsed = now - lastRunRef.current

      if (elapsed >= interval) {
        lastRunRef.current = now
        callbackRef.current(...args)
      } else {
        // 确保最后一次调用会被执行
        if (timerRef.current) {
          clearTimeout(timerRef.current)
        }
        timerRef.current = setTimeout(() => {
          lastRunRef.current = Date.now()
          timerRef.current = null
          callbackRef.current(...args)
        }, interval - elapsed)
      }
    },
    [interval],
  )
}