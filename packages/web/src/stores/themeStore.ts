import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ThemeMode = 'light' | 'dark' | 'system'

/** 预置主题色 */
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'cyan' | 'red' | 'yellow'

/** 代码高亮主题 */
export type CodeTheme = 'github-dark' | 'github-light' | 'monokai' | 'one-dark-pro' | 'dracula' | 'nord'

/** 代码高亮主题选项列表 */
export const CODE_THEME_OPTIONS: { value: CodeTheme; label: string }[] = [
  { value: 'github-dark', label: 'GitHub Dark' },
  { value: 'github-light', label: 'GitHub Light' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'one-dark-pro', label: 'One Dark Pro' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'nord', label: 'Nord' },
]

/** 主题色选项列表（含展示色值） */
export const ACCENT_COLOR_OPTIONS: { value: AccentColor; label: string; color: string }[] = [
  { value: 'blue', label: '蓝色', color: '#3b82f6' },
  { value: 'purple', label: '紫色', color: '#a855f7' },
  { value: 'green', label: '绿色', color: '#22c55e' },
  { value: 'orange', label: '橙色', color: '#f97316' },
  { value: 'pink', label: '粉色', color: '#ec4899' },
  { value: 'cyan', label: '青色', color: '#06b6d4' },
  { value: 'red', label: '红色', color: '#ef4444' },
  { value: 'yellow', label: '黄色', color: '#eab308' },
]

interface ThemeState {
  mode: ThemeMode          // 用户选择的模式
  theme: 'light' | 'dark'  // 实际应用的主题（保持向后兼容）
  accentColor: AccentColor  // 主题色
  codeTheme: CodeTheme      // 代码高亮主题
  setMode: (mode: ThemeMode) => void
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void  // 在 dark -> light -> system 之间循环
  setAccentColor: (color: AccentColor) => void
  setCodeTheme: (theme: CodeTheme) => void
  /** 根据当前亮暗模式和 codeTheme 解析出实际的 Shiki 主题名 */
  resolvedCodeTheme: () => string
}

/** 获取系统当前主题 */
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 根据模式解析实际主题 */
const resolveTheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'system') return getSystemTheme()
  return mode
}

/** 将 CodeTheme 映射为 Shiki 主题名（需根据暗/亮模式选择） */
const resolveCodeTheme = (codeTheme: CodeTheme, appTheme: 'light' | 'dark'): string => {
  switch (codeTheme) {
    case 'github-dark':
      return appTheme === 'light' ? 'github-light-default' : 'github-dark-default'
    case 'github-light':
      return appTheme === 'light' ? 'github-light' : 'github-light-default'
    case 'monokai':
      return 'monokai'
    case 'one-dark-pro':
      return 'one-dark-pro'
    case 'dracula':
      return 'dracula'
    case 'nord':
      return 'nord'
    default:
      return appTheme === 'light' ? 'github-light-default' : 'github-dark-default'
  }
}

export const useThemeStore = create<ThemeState>()(persist((set, get) => ({
  mode: 'dark',
  theme: 'dark',
  accentColor: 'blue',
  codeTheme: 'github-dark',

  setMode: (mode) => {
    set({ mode, theme: resolveTheme(mode) })
  },

  setTheme: (theme) => set({ theme }),

  toggleTheme: () => {
    const { mode } = get()
    // 循环: dark -> light -> system -> dark
    const next: ThemeMode = mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark'
    set({ mode: next, theme: resolveTheme(next) })
  },

  setAccentColor: (color) => set({ accentColor: color }),

  setCodeTheme: (codeTheme) => set({ codeTheme }),

  resolvedCodeTheme: () => {
    const { codeTheme, theme } = get()
    return resolveCodeTheme(codeTheme, theme)
  },
}), {
  name: 'claude-code-chat-theme',
  partialize: (state) => ({ mode: state.mode, theme: state.theme, accentColor: state.accentColor, codeTheme: state.codeTheme }),
}))
