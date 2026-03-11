import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ==================== 类型定义 ====================

/** 代码片段数据结构 */
export interface CodeSnippet {
  id: string
  /** 片段标题（自动生成或手动编辑） */
  title: string
  /** 代码内容 */
  code: string
  /** 编程语言 */
  language: string
  /** 创建时间戳 */
  createdAt: number
  /** 可选标签 */
  tags?: string[]
}

interface SnippetState {
  /** 所有代码片段 */
  snippets: CodeSnippet[]
  /** 添加代码片段 */
  addSnippet: (code: string, language: string, title?: string) => void
  /** 更新片段标题 */
  updateSnippetTitle: (id: string, title: string) => void
  /** 删除片段 */
  deleteSnippet: (id: string) => void
  /** 获取所有不重复的语言列表 */
  getLanguages: () => string[]
}

// ==================== 辅助函数 ====================

/** 根据代码内容和语言自动生成标题 */
function generateTitle(code: string, language: string): string {
  // 取代码第一行非空内容作为标题基础
  const firstLine = code.split('\n').find(line => line.trim().length > 0)?.trim() || ''

  // 如果第一行是注释，提取注释内容作为标题
  const commentPatterns = [
    /^\/\/\s*(.+)$/,           // // 单行注释
    /^#\s*(.+)$/,              // # Python/Shell 注释
    /^\/\*\s*(.+?)(\s*\*\/)?$/, // /* 块注释 */
    /^--\s*(.+)$/,             // -- SQL 注释
    /^;\s*(.+)$/,              // ; Lisp/asm 注释
  ]

  for (const pattern of commentPatterns) {
    const match = firstLine.match(pattern)
    if (match?.[1]) {
      const comment = match[1].trim()
      if (comment.length <= 50) return comment
      return comment.slice(0, 47) + '...'
    }
  }

  // 如果第一行是函数/类定义，提取名称
  const defPatterns = [
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,  // JS/TS function
    /^(?:export\s+)?(?:const|let|var)\s+(\w+)/,       // JS/TS 变量
    /^(?:export\s+)?(?:class|interface|type|enum)\s+(\w+)/, // TS 类型
    /^def\s+(\w+)/,                                    // Python def
    /^class\s+(\w+)/,                                  // Python class
    /^fn\s+(\w+)/,                                     // Rust fn
    /^func\s+(\w+)/,                                   // Go func
    /^pub\s+(?:fn|struct|enum)\s+(\w+)/,               // Rust pub
  ]

  for (const pattern of defPatterns) {
    const match = firstLine.match(pattern)
    if (match?.[1]) {
      return `${match[1]} (${language || 'text'})`
    }
  }

  // 降级：取第一行截断
  if (firstLine.length > 0) {
    const truncated = firstLine.length <= 40 ? firstLine : firstLine.slice(0, 37) + '...'
    return truncated
  }

  // 最终降级：使用语言 + 时间
  return `${language || 'text'} 片段`
}

// ==================== Store ====================

export const useSnippetStore = create<SnippetState>()(
  persist(
    (set, get) => ({
      snippets: [],

      addSnippet: (code, language, title) => {
        const snippet: CodeSnippet = {
          id: crypto.randomUUID(),
          title: title || generateTitle(code, language),
          code,
          language: language || 'text',
          createdAt: Date.now(),
        }
        set((state) => ({
          snippets: [snippet, ...state.snippets],
        }))
      },

      updateSnippetTitle: (id, title) => {
        set((state) => ({
          snippets: state.snippets.map((s) =>
            s.id === id ? { ...s, title } : s
          ),
        }))
      },

      deleteSnippet: (id) => {
        set((state) => ({
          snippets: state.snippets.filter((s) => s.id !== id),
        }))
      },

      getLanguages: () => {
        const langs = new Set(get().snippets.map((s) => s.language))
        return Array.from(langs).sort()
      },
    }),
    {
      name: 'claude-code-chat-snippets',
    }
  )
)
