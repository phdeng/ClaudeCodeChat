import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** 收藏消息数据结构 */
export interface FavoriteMessage {
  /** 收藏记录 ID */
  id: string
  /** 原始消息 ID */
  messageId: string
  /** 来源会话 ID */
  sessionId: string
  /** 来源会话名称（快照） */
  sessionName: string
  /** 消息角色 */
  role: 'user' | 'assistant'
  /** 消息内容（快照） */
  content: string
  /** 分类标签，默认 'uncategorized' */
  category: string
  /** 用户备注 */
  note?: string
  /** 收藏时间戳 */
  createdAt: number
}

interface FavoritesState {
  /** 所有收藏消息 */
  favorites: FavoriteMessage[]
  /** 添加收藏 */
  addFavorite: (fav: Omit<FavoriteMessage, 'id' | 'createdAt'>) => void
  /** 移除收藏 */
  removeFavorite: (id: string) => void
  /** 通过原始消息 ID 移除收藏 */
  removeFavoriteByMessageId: (messageId: string) => void
  /** 更新备注 */
  updateFavoriteNote: (id: string, note: string) => void
  /** 更新分类 */
  updateFavoriteCategory: (id: string, category: string) => void
  /** 判断消息是否已收藏 */
  isFavorited: (messageId: string) => boolean
  /** 按分类获取收藏 */
  getFavoritesByCategory: (category: string) => FavoriteMessage[]
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],

      addFavorite: (fav) => {
        // 避免重复收藏同一条消息
        if (get().favorites.some(f => f.messageId === fav.messageId)) return
        const favorite: FavoriteMessage = {
          ...fav,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        }
        set((state) => ({
          favorites: [favorite, ...state.favorites],
        }))
      },

      removeFavorite: (id) => {
        set((state) => ({
          favorites: state.favorites.filter((f) => f.id !== id),
        }))
      },

      removeFavoriteByMessageId: (messageId) => {
        set((state) => ({
          favorites: state.favorites.filter((f) => f.messageId !== messageId),
        }))
      },

      updateFavoriteNote: (id, note) => {
        set((state) => ({
          favorites: state.favorites.map((f) =>
            f.id === id ? { ...f, note: note || undefined } : f
          ),
        }))
      },

      updateFavoriteCategory: (id, category) => {
        set((state) => ({
          favorites: state.favorites.map((f) =>
            f.id === id ? { ...f, category } : f
          ),
        }))
      },

      isFavorited: (messageId) => {
        return get().favorites.some((f) => f.messageId === messageId)
      },

      getFavoritesByCategory: (category) => {
        return get().favorites.filter((f) => f.category === category)
      },
    }),
    {
      name: 'claude-code-chat-favorites',
    }
  )
)
