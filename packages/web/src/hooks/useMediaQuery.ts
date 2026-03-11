import { useState, useEffect } from 'react'

/**
 * 媒体查询 hook：监听指定媒体查询的匹配状态
 * @param query 媒体查询字符串，如 '(max-width: 768px)'
 * @returns 当前是否匹配
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches
    }
    return false
  })

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)

    setMatches(mql.matches)
    mql.addEventListener('change', handler)

    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/**
 * 判断当前是否为移动端（宽度 <= 768px）
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)')
}
