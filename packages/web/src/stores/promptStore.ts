import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ==================== 类型定义 ====================

export interface PromptTemplate {
  id: string
  title: string
  content: string
  category: string
  createdAt: number
}

interface PromptState {
  prompts: PromptTemplate[]
  addPrompt: (prompt: Omit<PromptTemplate, 'id' | 'createdAt'>) => void
  removePrompt: (id: string) => void
  updatePrompt: (id: string, updates: Partial<Pick<PromptTemplate, 'title' | 'content' | 'category'>>) => void
}

// ==================== 内置预置模板 ====================

const BUILTIN_PROMPTS: PromptTemplate[] = [
  {
    id: 'builtin-code-review',
    title: '代码审查',
    content: '请审查以下代码，指出潜在问题和改进建议：\n\n```\n// 在此粘贴代码\n```',
    category: '开发',
    createdAt: 0,
  },
  {
    id: 'builtin-bug-fix',
    title: 'Bug 修复',
    content: '我遇到了以下错误，请帮我分析原因并提供修复方案：\n\n错误信息：\n复现步骤：',
    category: '开发',
    createdAt: 0,
  },
  {
    id: 'builtin-code-explain',
    title: '代码解释',
    content: '请详细解释以下代码的逻辑和工作原理：\n\n```\n// 在此粘贴代码\n```',
    category: '学习',
    createdAt: 0,
  },
  {
    id: 'builtin-refactor',
    title: '重构建议',
    content: '请对以下代码提供重构建议，提高可读性和可维护性：\n\n```\n// 在此粘贴代码\n```',
    category: '开发',
    createdAt: 0,
  },
  {
    id: 'builtin-unit-test',
    title: '单元测试',
    content: '请为以下函数编写完整的单元测试：\n\n```\n// 在此粘贴代码\n```',
    category: '测试',
    createdAt: 0,
  },
]

// ==================== Store ====================

export const usePromptStore = create<PromptState>()(
  persist(
    (set) => ({
      prompts: BUILTIN_PROMPTS,

      addPrompt: (prompt) => {
        const newPrompt: PromptTemplate = {
          ...prompt,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        }
        set((state) => ({
          prompts: [...state.prompts, newPrompt],
        }))
      },

      removePrompt: (id) => {
        set((state) => ({
          prompts: state.prompts.filter((p) => p.id !== id),
        }))
      },

      updatePrompt: (id, updates) => {
        set((state) => ({
          prompts: state.prompts.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }))
      },
    }),
    {
      name: 'claude-code-chat-prompts',
    }
  )
)
