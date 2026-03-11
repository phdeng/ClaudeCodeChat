import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  timestamp: number
  read: boolean
}

interface NotificationState {
  notifications: Notification[]
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
  unreadCount: () => number
}

const MAX_NOTIFICATIONS = 50

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],

      addNotification: (n) => {
        const notification: Notification = {
          ...n,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          read: false,
        }
        set((state) => {
          const updated = [notification, ...state.notifications]
          // 超出上限时删除最旧的
          if (updated.length > MAX_NOTIFICATIONS) {
            return { notifications: updated.slice(0, MAX_NOTIFICATIONS) }
          }
          return { notifications: updated }
        })
      },

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }))
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }))
      },

      clearAll: () => {
        set({ notifications: [] })
      },

      unreadCount: () => {
        return get().notifications.filter((n) => !n.read).length
      },
    }),
    {
      name: 'claude-code-chat-notifications',
      partialize: (state) => ({
        notifications: state.notifications,
      }),
    }
  )
)
