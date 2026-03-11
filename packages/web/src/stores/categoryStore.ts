import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Category {
  id: string
  name: string
  color: string  // Tailwind 背景颜色类名，如 'bg-blue-500'
  icon?: string  // lucide 图标名（预留）
  order: number
}

interface CategoryState {
  categories: Category[]
  addCategory: (name: string, color: string) => void
  removeCategory: (id: string) => void
  updateCategory: (id: string, updates: Partial<Pick<Category, 'name' | 'color' | 'icon'>>) => void
  reorderCategories: (ids: string[]) => void
}

// 默认预设分类
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-dev', name: '开发', color: 'bg-blue-400/60', order: 0 },
  { id: 'cat-learn', name: '学习', color: 'bg-green-400/60', order: 1 },
  { id: 'cat-work', name: '工作', color: 'bg-orange-400/60', order: 2 },
  { id: 'cat-creative', name: '创意', color: 'bg-purple-400/60', order: 3 },
]

export const useCategoryStore = create<CategoryState>()(persist((set) => ({
  categories: DEFAULT_CATEGORIES,

  addCategory: (name, color) => {
    set((state) => ({
      categories: [...state.categories, {
        id: crypto.randomUUID(),
        name,
        color,
        order: state.categories.length,
      }],
    }))
  },

  removeCategory: (id) => {
    set((state) => ({
      categories: state.categories.filter(c => c.id !== id),
    }))
  },

  updateCategory: (id, updates) => {
    set((state) => ({
      categories: state.categories.map(c => c.id === id ? { ...c, ...updates } : c),
    }))
  },

  reorderCategories: (ids) => {
    set((state) => ({
      categories: ids.map((id, i) => {
        const cat = state.categories.find(c => c.id === id)!
        return { ...cat, order: i }
      }),
    }))
  },
}), {
  name: 'claude-code-chat-categories',
}))
