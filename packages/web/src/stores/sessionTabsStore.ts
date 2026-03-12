import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SessionTab {
  sessionId: string
  title: string         // 会话标题快照
}

interface SessionTabsState {
  tabs: SessionTab[]
  activeTabId: string | null
  openTab: (sessionId: string, title: string) => void   // 打开或激活标签
  closeTab: (sessionId: string) => void                  // 关闭标签
  setActiveTab: (sessionId: string) => void
  updateTabTitle: (sessionId: string, title: string) => void
  closeOtherTabs: (sessionId: string) => void
  closeAllTabs: () => void
}

/** 最多允许打开的标签页数量 */
const MAX_TABS = 10

export const useSessionTabsStore = create<SessionTabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      openTab: (sessionId: string, title: string) => {
        const { tabs } = get()
        const existing = tabs.find((t) => t.sessionId === sessionId)
        if (existing) {
          // 已存在，激活并更新标题
          set({
            activeTabId: sessionId,
            tabs: tabs.map((t) =>
              t.sessionId === sessionId ? { ...t, title } : t
            ),
          })
        } else {
          // 不存在，添加到末尾并激活
          let newTabs = [...tabs, { sessionId, title }]
          // 超出上限时，移除最早的非活跃标签
          if (newTabs.length > MAX_TABS) {
            const activeId = get().activeTabId
            const removeIdx = newTabs.findIndex(
              (t) => t.sessionId !== activeId && t.sessionId !== sessionId
            )
            if (removeIdx !== -1) {
              newTabs.splice(removeIdx, 1)
            } else {
              newTabs = newTabs.slice(-MAX_TABS)
            }
          }
          set({ tabs: newTabs, activeTabId: sessionId })
        }
      },

      closeTab: (sessionId: string) => {
        const { tabs, activeTabId } = get()
        const index = tabs.findIndex((t) => t.sessionId === sessionId)
        if (index === -1) return

        const newTabs = tabs.filter((t) => t.sessionId !== sessionId)

        if (activeTabId === sessionId) {
          // 关闭的是当前激活标签，激活相邻标签（优先右边，然后左边）
          let nextActiveId: string | null = null
          if (newTabs.length > 0) {
            // 优先右边（同索引位置），然后左边（index - 1）
            const nextIndex = Math.min(index, newTabs.length - 1)
            nextActiveId = newTabs[nextIndex].sessionId
          }
          set({ tabs: newTabs, activeTabId: nextActiveId })
        } else {
          set({ tabs: newTabs })
        }
      },

      setActiveTab: (sessionId: string) => {
        set({ activeTabId: sessionId })
      },

      updateTabTitle: (sessionId: string, title: string) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.sessionId === sessionId ? { ...t, title } : t
          ),
        }))
      },

      closeOtherTabs: (sessionId: string) => {
        set((state) => ({
          tabs: state.tabs.filter((t) => t.sessionId === sessionId),
          activeTabId: sessionId,
        }))
      },

      closeAllTabs: () => {
        set({ tabs: [], activeTabId: null })
      },
    }),
    {
      name: 'claude-code-chat-session-tabs',
    }
  )
)
