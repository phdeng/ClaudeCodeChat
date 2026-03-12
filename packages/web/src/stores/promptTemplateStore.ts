import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ==================== 类型定义 ====================

export interface PromptTemplate {
  id: string
  /** 模板名称 */
  name: string
  /** 模板内容（支持 {{变量}} 占位符） */
  content: string
  /** 分类 */
  category: 'code-review' | 'bug-fix' | 'refactor' | 'explain' | 'write-tests' | 'generate-docs' | 'custom'
  /** 是否内置（内置模板不可删除） */
  isBuiltin: boolean
  /** 图标名（lucide-react 图标名） */
  icon?: string
}

interface PromptTemplateState {
  /** 所有提示词模板 */
  templates: PromptTemplate[]
  /** 添加模板 */
  addTemplate: (template: Omit<PromptTemplate, 'id' | 'isBuiltin'>) => void
  /** 更新模板 */
  updateTemplate: (id: string, updates: Partial<Pick<PromptTemplate, 'name' | 'content' | 'category' | 'icon'>>) => void
  /** 删除模板（内置模板不可删除） */
  deleteTemplate: (id: string) => void
  /** 按分类获取模板 */
  getTemplatesByCategory: (category: string) => PromptTemplate[]
}

// ==================== 内置模板 ====================

const BUILTIN_TEMPLATES: PromptTemplate[] = [
  {
    id: 'builtin-code-review',
    name: '代码审查',
    content: '请审查以下代码，关注安全性、性能和可维护性：\n\n{{code}}',
    category: 'code-review',
    isBuiltin: true,
    icon: 'Search',
  },
  {
    id: 'builtin-bug-fix',
    name: 'Bug 修复',
    content: '我遇到了以下错误，请帮我分析原因并提供修复方案：\n\n{{error}}',
    category: 'bug-fix',
    isBuiltin: true,
    icon: 'Bug',
  },
  {
    id: 'builtin-refactor',
    name: '代码重构',
    content: '请重构以下代码，提高可读性和性能：\n\n{{code}}',
    category: 'refactor',
    isBuiltin: true,
    icon: 'RefreshCw',
  },
  {
    id: 'builtin-explain',
    name: '解释代码',
    content: '请详细解释以下代码的功能和工作原理：\n\n{{code}}',
    category: 'explain',
    isBuiltin: true,
    icon: 'BookOpen',
  },
  {
    id: 'builtin-write-tests',
    name: '编写测试',
    content: '请为以下代码编写单元测试：\n\n{{code}}',
    category: 'write-tests',
    isBuiltin: true,
    icon: 'TestTube',
  },
  {
    id: 'builtin-generate-docs',
    name: '文档生成',
    content: '请为以下代码生成详细的文档注释：\n\n{{code}}',
    category: 'generate-docs',
    isBuiltin: true,
    icon: 'FileText',
  },
]

// ==================== Store ====================

export const usePromptTemplateStore = create<PromptTemplateState>()(
  persist(
    (set, get) => ({
      templates: BUILTIN_TEMPLATES,

      addTemplate: (template) => {
        const newTemplate: PromptTemplate = {
          ...template,
          id: crypto.randomUUID(),
          isBuiltin: false,
        }
        set((state) => ({
          templates: [...state.templates, newTemplate],
        }))
      },

      updateTemplate: (id, updates) => {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }))
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id || t.isBuiltin),
        }))
      },

      getTemplatesByCategory: (category) => {
        if (category === 'all') return get().templates
        return get().templates.filter((t) => t.category === category)
      },
    }),
    {
      name: 'claude-code-chat-prompt-templates',
      // 合并策略：确保内置模板始终存在
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<PromptTemplateState>
        const persistedTemplates = persistedState?.templates || []
        // 确保所有内置模板都存在
        const builtinIds = BUILTIN_TEMPLATES.map((t) => t.id)
        const customTemplates = persistedTemplates.filter((t) => !builtinIds.includes(t.id))
        return {
          ...current,
          ...persistedState,
          templates: [...BUILTIN_TEMPLATES, ...customTemplates],
        }
      },
    }
  )
)
