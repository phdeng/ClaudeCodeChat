/**
 * 上下文管理 Store
 * 管理每个会话的上下文项目（文件、目录、URL），持久化到 localStorage
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** 上下文项目类型 */
export interface ContextItem {
  id: string
  type: 'file' | 'directory' | 'url'
  path: string           // 文件路径或 URL
  displayName: string    // 显示名称（文件名或 URL 短名）
  size?: number          // 文件大小(字节)
  lineCount?: number     // 行数
  language?: string      // 代码语言（用于高亮）
  addedAt: number        // 添加时间戳
}

interface ContextState {
  /** 按会话 ID 索引的上下文项列表 */
  sessionContexts: Record<string, ContextItem[]>
  /** 添加上下文项到指定会话 */
  addItem: (sessionId: string, item: Omit<ContextItem, 'id' | 'addedAt'>) => void
  /** 从指定会话移除上下文项 */
  removeItem: (sessionId: string, itemId: string) => void
  /** 清空指定会话的所有上下文项 */
  clearSession: (sessionId: string) => void
  /** 获取指定会话的上下文项列表 */
  getItems: (sessionId: string) => ContextItem[]
  /** 估算指定会话的 token 总量（1 token ≈ 4 字符） */
  getTotalEstimatedTokens: (sessionId: string) => number
}

/** 根据文件扩展名推断代码语言 */
function detectLanguage(filePath: string): string | undefined {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    sql: 'sql',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    vue: 'vue',
    svelte: 'svelte',
  }
  return ext ? langMap[ext] : undefined
}

/** 从路径或 URL 提取显示名称 */
function extractDisplayName(path: string, type: 'file' | 'directory' | 'url'): string {
  if (type === 'url') {
    try {
      const url = new URL(path)
      const pathname = url.pathname
      // 取路径最后一段作为短名
      const segments = pathname.split('/').filter(Boolean)
      return segments.length > 0 ? segments[segments.length - 1] : url.hostname
    } catch {
      return path.length > 40 ? path.substring(0, 37) + '...' : path
    }
  }
  // 文件或目录：取路径最后一段
  const segments = path.split(/[/\\]/).filter(Boolean)
  return segments.length > 0 ? segments[segments.length - 1] : path
}

export const useContextStore = create<ContextState>()(
  persist(
    (set, get) => ({
      sessionContexts: {},

      addItem: (sessionId, item) => {
        const id = crypto.randomUUID()
        const addedAt = Date.now()
        // 如果没有 displayName，自动推断
        const displayName = item.displayName || extractDisplayName(item.path, item.type)
        // 如果是文件且没有 language，自动检测
        const language = item.type === 'file' ? (item.language || detectLanguage(item.path)) : item.language

        const newItem: ContextItem = {
          ...item,
          id,
          addedAt,
          displayName,
          language,
        }

        set((state) => {
          const existing = state.sessionContexts[sessionId] || []
          // 避免重复添加同路径的项目
          if (existing.some((i) => i.path === item.path && i.type === item.type)) {
            return state
          }
          return {
            sessionContexts: {
              ...state.sessionContexts,
              [sessionId]: [...existing, newItem],
            },
          }
        })
      },

      removeItem: (sessionId, itemId) => {
        set((state) => {
          const existing = state.sessionContexts[sessionId]
          if (!existing) return state
          const filtered = existing.filter((i) => i.id !== itemId)
          return {
            sessionContexts: {
              ...state.sessionContexts,
              [sessionId]: filtered,
            },
          }
        })
      },

      clearSession: (sessionId) => {
        set((state) => {
          const next = { ...state.sessionContexts }
          delete next[sessionId]
          return { sessionContexts: next }
        })
      },

      getItems: (sessionId) => {
        return get().sessionContexts[sessionId] || []
      },

      getTotalEstimatedTokens: (sessionId) => {
        const items = get().sessionContexts[sessionId] || []
        let totalChars = 0
        for (const item of items) {
          if (item.size) {
            totalChars += item.size
          } else if (item.type === 'url') {
            // URL 内容无法预估大小，给一个默认估算值
            totalChars += 2000
          } else if (item.type === 'directory') {
            // 目录给一个默认估算值
            totalChars += 500
          } else {
            totalChars += 1000
          }
        }
        // 1 token ≈ 4 字符
        return Math.ceil(totalChars / 4)
      },
    }),
    {
      name: 'context-items',
      partialize: (state) => ({
        sessionContexts: state.sessionContexts,
      }),
    }
  )
)
