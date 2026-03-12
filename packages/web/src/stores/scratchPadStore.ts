import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ==================== 类型定义 ====================

interface ScratchPadStore {
  /** 笔记内容 */
  content: string
  /** 是否展开面板 */
  isOpen: boolean
  /** 是否最小化 */
  isMinimized: boolean
  /** 设置笔记内容 */
  setContent: (content: string) => void
  /** 切换展开/收起 */
  toggleOpen: () => void
  /** 设置最小化状态 */
  setMinimized: (minimized: boolean) => void
  /** 清空笔记内容 */
  clear: () => void
}

// ==================== Store ====================

export const useScratchPadStore = create<ScratchPadStore>()(
  persist(
    (set) => ({
      content: '',
      isOpen: false,
      isMinimized: false,

      setContent: (content) => set({ content }),

      toggleOpen: () =>
        set((state) => ({
          isOpen: !state.isOpen,
          // 展开时自动取消最小化
          isMinimized: !state.isOpen ? false : state.isMinimized,
        })),

      setMinimized: (minimized) => set({ isMinimized: minimized }),

      clear: () => set({ content: '' }),
    }),
    {
      name: 'claude-code-chat-scratchpad',
    }
  )
)
