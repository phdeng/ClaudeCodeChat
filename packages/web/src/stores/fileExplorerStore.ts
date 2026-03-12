import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** 打开的文件 Tab */
export interface OpenFileTab {
  /** 文件完整路径 */
  path: string
  /** 文件名 */
  name: string
  /** 文件内容（懒加载） */
  content?: string
  /** 语言类型 */
  language: string
  /** 是否正在加载 */
  loading?: boolean
  /** 加载错误信息 */
  error?: string
}

/** 文件树节点展开状态 */
export interface TreeNodeState {
  /** 已展开的目录路径集合 */
  expandedDirs: Set<string>
}

interface FileExplorerState {
  /** 当前浏览的根路径 */
  currentPath: string
  /** 是否显示文件浏览器 */
  showFileExplorer: boolean
  /** 文件浏览器面板宽度（像素） */
  fileExplorerWidth: number
  /** 文件树面板宽度（像素） */
  fileTreeWidth: number
  /** 打开的文件 Tab 列表 */
  openTabs: OpenFileTab[]
  /** 当前激活的 Tab 路径 */
  activeTabPath: string | null
  /** 已展开的目录路径集合（序列化为数组存储） */
  expandedDirs: string[]

  // 路径与面板
  setCurrentPath: (path: string) => void
  toggleFileExplorer: () => void
  setShowFileExplorer: (show: boolean) => void
  setFileExplorerWidth: (width: number) => void
  setFileTreeWidth: (width: number) => void

  // Tab 操作
  openFile: (tab: OpenFileTab) => void
  closeTab: (path: string) => void
  setActiveTab: (path: string) => void
  updateTabContent: (path: string, content: string) => void
  updateTabLoading: (path: string, loading: boolean) => void
  updateTabError: (path: string, error: string) => void
  closeAllTabs: () => void
  closeOtherTabs: (path: string) => void

  // 树节点展开/折叠
  toggleDir: (dirPath: string) => void
  isDirExpanded: (dirPath: string) => boolean
}

export const useFileExplorerStore = create<FileExplorerState>()(
  persist(
    (set, get) => ({
      currentPath: '',
      showFileExplorer: false,
      fileExplorerWidth: 300,
      fileTreeWidth: 220,
      openTabs: [],
      activeTabPath: null,
      expandedDirs: [],

      setCurrentPath: (path: string) => set({ currentPath: path }),
      toggleFileExplorer: () => set((s) => ({ showFileExplorer: !s.showFileExplorer })),
      setShowFileExplorer: (show: boolean) => set({ showFileExplorer: show }),
      setFileExplorerWidth: (width: number) => set({ fileExplorerWidth: Math.max(200, Math.min(width, window.innerWidth - 200)) }),
      setFileTreeWidth: (width: number) => set((s) => ({
        fileTreeWidth: Math.max(150, Math.min(width, s.fileExplorerWidth - 100)),
      })),

      // 打开文件（如果已打开则切换到该 Tab）
      openFile: (tab: OpenFileTab) => set((s) => {
        const existing = s.openTabs.find(t => t.path === tab.path)
        if (existing) {
          return { activeTabPath: tab.path }
        }
        return {
          openTabs: [...s.openTabs, tab],
          activeTabPath: tab.path,
        }
      }),

      // 关闭 Tab
      closeTab: (path: string) => set((s) => {
        const newTabs = s.openTabs.filter(t => t.path !== path)
        let newActive = s.activeTabPath
        if (s.activeTabPath === path) {
          // 关闭当前 Tab 时，切换到相邻的
          const idx = s.openTabs.findIndex(t => t.path === path)
          if (newTabs.length > 0) {
            newActive = newTabs[Math.min(idx, newTabs.length - 1)].path
          } else {
            newActive = null
          }
        }
        return { openTabs: newTabs, activeTabPath: newActive }
      }),

      setActiveTab: (path: string) => set({ activeTabPath: path }),

      updateTabContent: (path: string, content: string) => set((s) => ({
        openTabs: s.openTabs.map(t => t.path === path ? { ...t, content, loading: false, error: undefined } : t),
      })),

      updateTabLoading: (path: string, loading: boolean) => set((s) => ({
        openTabs: s.openTabs.map(t => t.path === path ? { ...t, loading } : t),
      })),

      updateTabError: (path: string, error: string) => set((s) => ({
        openTabs: s.openTabs.map(t => t.path === path ? { ...t, error, loading: false } : t),
      })),

      closeAllTabs: () => set({ openTabs: [], activeTabPath: null }),

      closeOtherTabs: (path: string) => set((s) => ({
        openTabs: s.openTabs.filter(t => t.path === path),
        activeTabPath: path,
      })),

      // 目录展开/折叠
      toggleDir: (dirPath: string) => set((s) => {
        const expanded = new Set(s.expandedDirs)
        if (expanded.has(dirPath)) {
          expanded.delete(dirPath)
        } else {
          expanded.add(dirPath)
        }
        return { expandedDirs: Array.from(expanded) }
      }),

      isDirExpanded: (dirPath: string) => {
        return get().expandedDirs.includes(dirPath)
      },
    }),
    {
      name: 'claude-code-chat-file-explorer',
      // 不持久化 openTabs 的 content 和 loading 状态（太大），只保存路径
      partialize: (state) => ({
        currentPath: state.currentPath,
        showFileExplorer: state.showFileExplorer,
        fileExplorerWidth: state.fileExplorerWidth,
        fileTreeWidth: state.fileTreeWidth,
        expandedDirs: state.expandedDirs,
        // 只保存 tab 的路径和名称，不保存内容
        openTabs: state.openTabs.map(t => ({ path: t.path, name: t.name, language: t.language })),
        activeTabPath: state.activeTabPath,
      }),
    }
  )
)
