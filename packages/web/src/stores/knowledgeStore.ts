import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ==================== 类型定义 ====================

/** 知识库条目 */
export interface KnowledgeEntry {
  id: string
  /** 条目标题 */
  title: string
  /** 知识内容（markdown） */
  content: string
  /** 标签分类 */
  tags: string[]
  /** 来源信息 */
  source: {
    sessionId: string
    sessionTitle: string
    messageTimestamp: number
  }
  createdAt: number
  updatedAt: number
}

interface KnowledgeState {
  /** 所有知识条目 */
  entries: KnowledgeEntry[]
  /** 添加条目 */
  addEntry: (entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  /** 更新条目 */
  updateEntry: (id: string, updates: Partial<Pick<KnowledgeEntry, 'title' | 'content' | 'tags'>>) => void
  /** 删除条目 */
  removeEntry: (id: string) => void
  /** 按关键词搜索（标题 + 内容） */
  searchEntries: (query: string) => KnowledgeEntry[]
  /** 按标签过滤 */
  getByTag: (tag: string) => KnowledgeEntry[]
  /** 获取所有不重复的标签 */
  getAllTags: () => string[]
}

// ==================== Store ====================

export const useKnowledgeStore = create<KnowledgeState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (entry) => {
        const newEntry: KnowledgeEntry = {
          ...entry,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({
          entries: [newEntry, ...state.entries],
        }))
      },

      updateEntry: (id, updates) => {
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: Date.now() } : e
          ),
        }))
      },

      removeEntry: (id) => {
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        }))
      },

      searchEntries: (query) => {
        const { entries } = get()
        if (!query.trim()) return entries
        const lower = query.toLowerCase()
        return entries.filter(
          (e) =>
            e.title.toLowerCase().includes(lower) ||
            e.content.toLowerCase().includes(lower) ||
            e.tags.some((t) => t.toLowerCase().includes(lower))
        )
      },

      getByTag: (tag) => {
        const { entries } = get()
        return entries.filter((e) => e.tags.includes(tag))
      },

      getAllTags: () => {
        const { entries } = get()
        const tagSet = new Set<string>()
        for (const e of entries) {
          for (const t of e.tags) {
            tagSet.add(t)
          }
        }
        return Array.from(tagSet).sort()
      },
    }),
    {
      name: 'knowledge-base',
    }
  )
)
