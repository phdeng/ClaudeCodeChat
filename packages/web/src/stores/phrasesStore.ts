import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ==================== 类型定义 ====================

export interface Phrase {
  id: string
  label: string      // 短语标题/标签
  content: string    // 短语内容
  createdAt: number
}

interface PhrasesState {
  phrases: Phrase[]
  addPhrase: (label: string, content: string) => void
  updatePhrase: (id: string, label: string, content: string) => void
  deletePhrase: (id: string) => void
}

// ==================== 内置预置短语 ====================

const BUILTIN_PHRASES: Phrase[] = [
  {
    id: 'builtin-code-review',
    label: '代码审查',
    content: '请帮我审查以下代码，关注安全性、性能和可维护性：',
    createdAt: 0,
  },
  {
    id: 'builtin-explain-code',
    label: '解释代码',
    content: '请解释这段代码的工作原理，用简单易懂的语言：',
    createdAt: 0,
  },
  {
    id: 'builtin-fix-bug',
    label: '修复 Bug',
    content: '这段代码有个 bug，错误信息如下。请帮我定位并修复：',
    createdAt: 0,
  },
]

// ==================== Store ====================

export const usePhrasesStore = create<PhrasesState>()(
  persist(
    (set) => ({
      phrases: BUILTIN_PHRASES,

      addPhrase: (label, content) => {
        const newPhrase: Phrase = {
          id: crypto.randomUUID(),
          label,
          content,
          createdAt: Date.now(),
        }
        set((state) => ({
          phrases: [...state.phrases, newPhrase],
        }))
      },

      updatePhrase: (id, label, content) => {
        set((state) => ({
          phrases: state.phrases.map((p) =>
            p.id === id ? { ...p, label, content } : p
          ),
        }))
      },

      deletePhrase: (id) => {
        set((state) => ({
          phrases: state.phrases.filter((p) => p.id !== id),
        }))
      },
    }),
    {
      name: 'claude-code-chat-phrases',
    }
  )
)
