import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  /** 是否开启通知音效 */
  soundEnabled: boolean
  /** 切换音效 */
  toggleSound: () => void
  /** 是否处于聚焦模式 */
  zenMode: boolean
  /** 切换聚焦模式 */
  toggleZenMode: () => void
  /** 设置聚焦模式 */
  setZenMode: (value: boolean) => void
  /** 已关闭的提示集合（用于永久隐藏浮动提示等） */
  dismissedHints: string[]
  /** 关闭某个提示 */
  dismissHint: (hintId: string) => void
  /** 恢复某个提示（重新显示） */
  restoreHint: (hintId: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: false,
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      zenMode: false,
      toggleZenMode: () => set((s) => ({ zenMode: !s.zenMode })),
      setZenMode: (value: boolean) => set({ zenMode: value }),
      dismissedHints: [],
      dismissHint: (hintId: string) =>
        set((s) => ({
          dismissedHints: s.dismissedHints.includes(hintId)
            ? s.dismissedHints
            : [...s.dismissedHints, hintId],
        })),
      restoreHint: (hintId: string) =>
        set((s) => ({
          dismissedHints: s.dismissedHints.filter((id) => id !== hintId),
        })),
    }),
    { name: 'claude-code-chat-settings' }
  )
)
