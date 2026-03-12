import { useState, useEffect, useCallback, useRef, type TouchEvent as ReactTouchEvent, type DragEvent } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeft, MessageSquare, ChevronDown, Zap, FolderOpen, Sun, Moon, Monitor, Volume2, VolumeX, Cloud, CloudOff, Loader2, Shield, ClipboardList, Maximize2, Minimize2, Bell, RefreshCw, X, Plus, ChevronLeft, ChevronRight as ChevronRightIcon, List, Search, Settings, BookOpen, SlidersHorizontal, Store } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import AdvancedParamsPanel from '../components/AdvancedParamsPanel'
import FolderPicker from '../components/FolderPicker'
import KeyboardShortcutsDialog from '../components/KeyboardShortcutsDialog'
import GlobalCommandPalette from '../components/GlobalCommandPalette'
import NotificationCenter from '../components/NotificationCenter'
import FileExplorer from '../components/FileExplorer'
import FileViewer from '../components/FileViewer'
import { useSessionStore } from '../stores/sessionStore'
import { useThemeStore } from '../stores/themeStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useNotificationStore } from '../stores/notificationStore'
import { useFileExplorerStore } from '../stores/fileExplorerStore'
import { useIsMobile } from '../hooks/useMediaQuery'
import { initAutoSync } from '../services/sessionSync'
import { useTranslation } from '../i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** 权限模式选项 */
const PERMISSION_MODES = [
  { id: 'default', nameKey: 'default' as const, descKey: 'default_desc' as const, Icon: Shield },
  { id: 'plan', nameKey: 'plan' as const, descKey: 'plan_desc' as const, Icon: ClipboardList },
  { id: 'auto', nameKey: 'auto' as const, descKey: 'auto_desc' as const, Icon: Zap },
]

const PERM_NAMES: Record<string, Record<string, string>> = {
  zh: { default: '默认', plan: '计划', auto: '自动', default_desc: '需要确认', plan_desc: '需要批准计划', auto_desc: '自动执行' },
  en: { default: 'Default', plan: 'Plan', auto: 'Auto', default_desc: 'Requires confirmation', plan_desc: 'Requires plan approval', auto_desc: 'Auto execute' },
}

const MODEL_OPTIONS = [
  { value: '', labelKey: 'default' as const, descKey: 'default_desc' as const },
  { value: 'claude-sonnet-4-6', labelKey: 'sonnet' as const, descKey: 'sonnet_desc' as const },
  { value: 'claude-opus-4-6', labelKey: 'opus' as const, descKey: 'opus_desc' as const },
  { value: 'claude-haiku-4-5-20251001', labelKey: 'haiku' as const, descKey: 'haiku_desc' as const },
]

const MODEL_NAMES: Record<string, Record<string, string>> = {
  zh: { default: '默认', default_desc: '使用服务器配置', sonnet: 'Sonnet', sonnet_desc: '快速且智能', opus: 'Opus', opus_desc: '最强推理能力', haiku: 'Haiku', haiku_desc: '极速响应' },
  en: { default: 'Default', default_desc: 'Use server config', sonnet: 'Sonnet', sonnet_desc: 'Fast and smart', opus: 'Opus', opus_desc: 'Strongest reasoning', haiku: 'Haiku', haiku_desc: 'Ultra fast' },
}

export default function ChatLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showAdvancedParams, setShowAdvancedParams] = useState(false)
  const modelPickerRef = useRef<HTMLDivElement>(null)
  const notificationBtnRef = useRef<HTMLDivElement>(null)
  const tabsContainerRef = useRef<HTMLDivElement>(null)
  const [tabScrollable, setTabScrollable] = useState<{ left: boolean; right: boolean }>({ left: false, right: false })
  const [dragTabIndex, setDragTabIndex] = useState<number | null>(null)
  const [dragOverTabIndex, setDragOverTabIndex] = useState<number | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { sessions, activeSessionId, createSession, selectedModel, setSelectedModel, permissionMode, setPermissionMode, connectionStatus, setSessionWorkingDirectory, syncToBackend, loadFromBackend, lastSyncTime, isSyncing, setProjectFilter, setActiveSession, networkLatency, reconnectCount, lastDisconnectedAt, backendVersion, openTabs, removeTab, reorderTabs, streamingSessions } = useSessionStore()
  const { mode, toggleTheme } = useThemeStore()
  const { soundEnabled, toggleSound, zenMode, toggleZenMode, setZenMode } = useSettingsStore()
  const notificationUnreadCount = useNotificationStore((s) => s.unreadCount())
  const { showFileExplorer, fileExplorerWidth, setFileExplorerWidth, fileTreeWidth, setFileTreeWidth, openTabs: openFileTabs } = useFileExplorerStore()

  // 外部分隔条拖拽状态（整个文件面板 vs 对话区）
  const [isDraggingResizer, setIsDraggingResizer] = useState(false)
  const resizerRef = useRef<HTMLDivElement>(null)
  // 内部分隔条拖拽状态（文件树 vs 文件查看器）
  const [isDraggingTreeResizer, setIsDraggingTreeResizer] = useState(false)

  // 外部分隔条拖拽处理
  useEffect(() => {
    if (!isDraggingResizer) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX
      setFileExplorerWidth(Math.max(200, Math.min(newWidth, window.innerWidth - 200)))
    }

    const handleMouseUp = () => {
      setIsDraggingResizer(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDraggingResizer, setFileExplorerWidth])

  // 内部分隔条拖拽处理（文件树宽度）
  useEffect(() => {
    if (!isDraggingTreeResizer) return

    const handleMouseMove = (e: MouseEvent) => {
      setFileTreeWidth(e.clientX)
    }

    const handleMouseUp = () => {
      setIsDraggingTreeResizer(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDraggingTreeResizer, setFileTreeWidth])

  const { t, lang } = useTranslation()
  const isMobile = useIsMobile()
  const activeSession = sessions.find((s) => s.id === activeSessionId)

  const mn = MODEL_NAMES[lang] || MODEL_NAMES.zh
  const pn = PERM_NAMES[lang] || PERM_NAMES.zh
  const currentModelLabel = mn[MODEL_OPTIONS.find((m) => m.value === selectedModel)?.labelKey || 'default']
  const currentPermMode = PERMISSION_MODES.find((m) => m.id === permissionMode) || PERMISSION_MODES[0]

  /** 循环切换权限模式：默认 → 计划 → 自动 → 默认 */
  const cyclePermissionMode = useCallback(() => {
    const currentIndex = PERMISSION_MODES.findIndex((m) => m.id === permissionMode)
    const nextIndex = (currentIndex + 1) % PERMISSION_MODES.length
    setPermissionMode(PERMISSION_MODES[nextIndex].id)
  }, [permissionMode, setPermissionMode])

  // 移动端遮罩层触摸滑动关闭侧边栏
  const overlayTouchStartX = useRef<number | null>(null)
  const handleOverlayTouchStart = useCallback((e: ReactTouchEvent) => {
    overlayTouchStartX.current = e.touches[0].clientX
  }, [])
  const handleOverlayTouchEnd = useCallback((e: ReactTouchEvent) => {
    if (overlayTouchStartX.current === null) return
    const deltaX = e.changedTouches[0].clientX - overlayTouchStartX.current
    // 向左滑动超过 50px 则关闭侧边栏
    if (deltaX < -50) {
      setSidebarOpen(false)
    }
    overlayTouchStartX.current = null
  }, [])

  // ==================== 移动端触摸手势：主内容区域左侧边缘右滑打开侧边栏 ====================
  const mainTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const mainTouchMoving = useRef(false)

  const handleMainTouchStart = useCallback((e: globalThis.TouchEvent) => {
    // 只在移动端、侧边栏关闭、非焦点模式时生效
    if (window.innerWidth > 768 || sidebarOpen || zenMode) return
    const touch = e.touches[0]
    // 仅在屏幕左侧边缘 20px 内开始的触摸才触发
    if (touch.clientX <= 20) {
      mainTouchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
      mainTouchMoving.current = false
    }
  }, [sidebarOpen, zenMode])

  const handleMainTouchMove = useCallback((e: globalThis.TouchEvent) => {
    if (!mainTouchStartRef.current) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - mainTouchStartRef.current.x
    const deltaY = Math.abs(touch.clientY - mainTouchStartRef.current.y)
    // 确保水平滑动距离大于垂直滑动（避免与垂直滚动冲突）
    if (deltaX > 10 && deltaX > deltaY) {
      mainTouchMoving.current = true
    }
  }, [])

  const handleMainTouchEnd = useCallback((e: globalThis.TouchEvent) => {
    if (!mainTouchStartRef.current) return
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - mainTouchStartRef.current.x
    const elapsed = Date.now() - mainTouchStartRef.current.time
    // 右滑超过 50px 且时间在 500ms 内，且确实在水平滑动
    if (mainTouchMoving.current && deltaX > 50 && elapsed < 500) {
      setSidebarOpen(true)
    }
    mainTouchStartRef.current = null
    mainTouchMoving.current = false
  }, [])

  // 绑定主内容区域触摸事件（使用原生事件以便在整个 main 区域捕获）
  useEffect(() => {
    if (typeof window === 'undefined') return
    const el = document.getElementById('main-content-area')
    if (!el) return
    el.addEventListener('touchstart', handleMainTouchStart, { passive: true })
    el.addEventListener('touchmove', handleMainTouchMove, { passive: true })
    el.addEventListener('touchend', handleMainTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleMainTouchStart)
      el.removeEventListener('touchmove', handleMainTouchMove)
      el.removeEventListener('touchend', handleMainTouchEnd)
    }
  }, [handleMainTouchStart, handleMainTouchMove, handleMainTouchEnd])

  // 点击外部关闭模型选择器
  useEffect(() => {
    if (!showModelPicker) return
    const handleClickOutside = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showModelPicker])

  const handleSelectModel = (value: string) => {
    setSelectedModel(value)
    setShowModelPicker(false)
  }

  const handleSelectFolder = (path: string) => {
    // 设置侧边栏项目筛选
    setProjectFilter(path)

    // 查找该项目下是否有历史会话（排除已归档的）
    const projectSessions = sessions.filter(
      (s) => !s.archived && s.workingDirectory === path
    )

    if (projectSessions.length > 0) {
      // 按创建时间倒序，切换到最近的会话
      const mostRecent = projectSessions.reduce((a, b) =>
        a.createdAt > b.createdAt ? a : b
      )
      setActiveSession(mostRecent.id)
      navigate(`/chat/${mostRecent.id}`)
    } else {
      // 没有历史会话，为当前会话设置工作目录
      if (activeSessionId) {
        setSessionWorkingDirectory(activeSessionId, path)
      }
    }
  }

  // 监听欢迎页的快捷事件：打开文件夹选择器 / 快速设置项目
  useEffect(() => {
    const handleOpenFolder = () => {
      setShowFolderPicker(true)
    }
    const handleSetProject = (e: Event) => {
      const path = (e as CustomEvent).detail?.path
      if (path && activeSessionId) {
        setSessionWorkingDirectory(activeSessionId, path)
        setProjectFilter(path)
      }
    }
    window.addEventListener('shortcut:folder', handleOpenFolder)
    window.addEventListener('shortcut:set-project', handleSetProject)
    return () => {
      window.removeEventListener('shortcut:folder', handleOpenFolder)
      window.removeEventListener('shortcut:set-project', handleSetProject)
    }
  }, [activeSessionId, setSessionWorkingDirectory, setProjectFilter])

  // Extract the last folder name from a path for display
  const folderDisplayName = activeSession?.workingDirectory
    ? activeSession.workingDirectory.split(/[/\\]/).filter(Boolean).pop() || activeSession.workingDirectory
    : null

  const statusText = connectionStatus === 'connected' ? t('layout.connected') : connectionStatus === 'connecting' ? t('layout.connecting') : t('layout.disconnected')

  // 网络延迟等级：绿色 < 100ms, 黄色 100-300ms, 红色 > 300ms
  const latencyLevel = networkLatency === null ? 'unknown' : networkLatency < 100 ? 'good' : networkLatency < 300 ? 'medium' : 'poor'

  // 格式化最后断开时间
  const formatDisconnectedTime = useCallback((timestamp: number | null) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  // 焦点模式切换包装：进入时关闭侧边栏
  const handleToggleZenMode = useCallback(() => {
    if (!zenMode) {
      setSidebarOpen(false)
    }
    toggleZenMode()
  }, [zenMode, toggleZenMode])

  const handleNewChat = useCallback(() => {
    const session = createSession()
    navigate(`/chat/${session.id}`)
  }, [createSession, navigate])

  // 应用启动时从后端加载会话数据 & 初始化自动同步
  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    loadFromBackend()
    initAutoSync()
  }, [loadFromBackend])

  // 格式化最后同步时间
  const formatSyncTime = useCallback((timestamp: number | null) => {
    if (!timestamp) return lang === 'zh' ? '尚未同步' : 'Not synced'
    const date = new Date(timestamp)
    const timeStr = date.toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    return lang === 'zh' ? `上次同步: ${timeStr}` : `Last sync: ${timeStr}`
  }, [])

  // 检查标签栏是否需要滚动箭头
  const checkTabScrollable = useCallback(() => {
    const container = tabsContainerRef.current
    if (!container) return
    setTabScrollable({
      left: container.scrollLeft > 0,
      right: container.scrollLeft + container.clientWidth < container.scrollWidth - 1,
    })
  }, [])

  useEffect(() => {
    checkTabScrollable()
    const container = tabsContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkTabScrollable)
      const ro = new ResizeObserver(checkTabScrollable)
      ro.observe(container)
      return () => {
        container.removeEventListener('scroll', checkTabScrollable)
        ro.disconnect()
      }
    }
  }, [openTabs, checkTabScrollable])

  const scrollTabs = useCallback((direction: 'left' | 'right') => {
    const container = tabsContainerRef.current
    if (!container) return
    const scrollAmount = 200
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }, [])

  // 标签拖拽排序处理
  const handleTabDragStart = useCallback((e: DragEvent<HTMLDivElement>, index: number) => {
    setDragTabIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }, [])

  const handleTabDragOver = useCallback((e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTabIndex(index)
  }, [])

  const handleTabDragEnd = useCallback(() => {
    if (dragTabIndex !== null && dragOverTabIndex !== null && dragTabIndex !== dragOverTabIndex) {
      reorderTabs(dragTabIndex, dragOverTabIndex)
    }
    setDragTabIndex(null)
    setDragOverTabIndex(null)
  }, [dragTabIndex, dragOverTabIndex, reorderTabs])

  const handleTabClick = useCallback((sessionId: string) => {
    setActiveSession(sessionId)
    navigate(`/chat/${sessionId}`)
  }, [setActiveSession, navigate])

  const handleTabClose = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    const wasActive = activeSessionId === sessionId
    removeTab(sessionId)
    if (wasActive) {
      // removeTab 已经在 store 中处理了 activeSessionId 的切换
      // 需要在下一帧获取新的 activeSessionId 并导航
      setTimeout(() => {
        const newActiveId = useSessionStore.getState().activeSessionId
        if (newActiveId) {
          navigate(`/chat/${newActiveId}`)
        } else {
          navigate('/')
        }
      }, 0)
    }
  }, [activeSessionId, removeTab, navigate])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        handleNewChat()
      }
      // Ctrl+/ — 显示快捷键帮助
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault()
        setShowShortcuts((prev) => !prev)
      }
      // ? — 显示快捷键帮助（仅在非输入框时触发）
      if (
        e.key === '?' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
        const isEditable = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable
        if (!isEditable) {
          e.preventDefault()
          setShowShortcuts((prev) => !prev)
        }
      }
      // Ctrl+K — 全局命令面板
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette((prev) => !prev)
      }
      // Alt+D — 切换亮/暗主题（避免与浏览器书签快捷键冲突）
      if (e.altKey && e.key === 'd') {
        e.preventDefault()
        toggleTheme()
      }
      // Ctrl+, — 打开设置
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        navigate('/settings')
      }
      // Alt+H — 会话历史（避免与浏览器历史记录快捷键冲突）
      if (e.altKey && e.key === 'h') {
        e.preventDefault()
        navigate('/sessions')
      }
      // Ctrl+Shift+Z — 焦点模式
      if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault()
        handleToggleZenMode()
      }
      // Ctrl+Shift+F — 全局搜索
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        navigate('/search')
      }
      // Ctrl+E — 导出当前对话
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('shortcut:export'))
      }
      // Ctrl+M — 多模型对比
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('shortcut:compare'))
      }
      // Ctrl+J — 查看书签
      if (e.ctrlKey && e.key === 'j') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('shortcut:bookmarks'))
      }
      // Ctrl+G — 分类管理器
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('shortcut:categories'))
      }
      // Ctrl+L — 聚焦输入框
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        const textarea = document.querySelector('textarea')
        textarea?.focus()
      }
      // Escape — 焦点模式下退出焦点模式（优先），否则关闭侧边栏（移动端）
      if (e.key === 'Escape') {
        if (zenMode) {
          setZenMode(false)
        } else if (sidebarOpen && window.innerWidth < 768) {
          setSidebarOpen(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar, handleNewChat, navigate, toggleTheme, sidebarOpen, zenMode, handleToggleZenMode])

  return (
    <div className={cn("flex h-screen overflow-hidden bg-background", zenMode && "zen-mode-active")}>
      {/* 焦点模式浮动工具条 */}
      {zenMode && (
        <div className="zen-toolbar">
          <span className="zen-toolbar-title">
            {activeSession?.title || t('sidebar.newChat')}
          </span>
          <span className={`status-dot ${connectionStatus}`} />
          <TooltipProvider>
            {/* 文件浏览器切换 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => useFileExplorerStore.getState().toggleFileExplorer()}
                  className={cn("text-foreground", showFileExplorer && "text-primary")}
                >
                  <FolderOpen size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {showFileExplorer ? t('layout.closeFileExplorer') : t('layout.openFileExplorer')}
              </TooltipContent>
            </Tooltip>
            {/* 退出焦点模式 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleToggleZenMode}
                  className="text-foreground"
                >
                  <Minimize2 size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {t('layout.exitZenMode')} (ESC)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* 侧边栏 */}
      {!zenMode && sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
            onTouchStart={handleOverlayTouchStart}
            onTouchEnd={handleOverlayTouchEnd}
          />
          <div className={cn(
            "w-[272px] flex-shrink-0 h-full",
            "fixed z-50 md:relative md:z-auto"
          )}>
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* 聚焦模式下的文件浏览器面板（文件树 | 文件查看器 左右分屏） */}
      {zenMode && showFileExplorer && (
        <>
          <div style={{ width: fileExplorerWidth, flexShrink: 0 }} className="flex h-full border-r border-border">
            {/* 左：文件树（可拖拽宽度） */}
            <div style={{ width: fileTreeWidth, flexShrink: 0 }} className="h-full overflow-hidden">
              <FileExplorer />
            </div>
            {/* 内部分隔条：文件树 vs 文件查看器 */}
            <div
              className={cn("file-explorer-resizer", isDraggingTreeResizer && "dragging")}
              onMouseDown={() => setIsDraggingTreeResizer(true)}
            />
            {/* 右：文件查看器 */}
            <div className="flex-1 min-w-0 h-full overflow-hidden">
              <FileViewer />
            </div>
          </div>
          <div
            ref={resizerRef}
            className={cn("file-explorer-resizer", isDraggingResizer && "dragging")}
            onMouseDown={() => setIsDraggingResizer(true)}
          />
        </>
      )}

      {/* 主内容区域 */}
      <main id="main-content-area" className={cn("flex-1 flex flex-col min-w-0", isMobile && !zenMode && "pb-14")}>
        {/* 顶部标题栏 — 焦点模式下隐藏 */}
        {!zenMode && (
        <>
        <header className="h-[52px] flex-shrink-0 flex items-center justify-between px-5 md:px-5 shadow-[0_1px_0_0_rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-3 min-w-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleSidebar}
                    className="text-foreground"
                  >
                    {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  {sidebarOpen ? (lang === 'zh' ? '收起侧边栏 (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)') : (lang === 'zh' ? '展开侧边栏 (Ctrl+B)' : 'Expand sidebar (Ctrl+B)')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {activeSession ? (
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare size={15} className="flex-shrink-0 text-primary opacity-70" />
                <span className="text-[13px] font-medium text-foreground truncate">
                  {activeSession.title}
                </span>
              </div>
            ) : (
              <span className="text-[13px] text-muted-foreground">
                {t('sidebar.newChat')}
              </span>
            )}
          </div>

          {/* 右侧：项目文件夹 + 连接状态 + 模型选择器 */}
          <div className="flex items-center gap-3">
            {/* 项目文件夹 */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-foreground gap-1.5 max-w-[160px]"
                    onClick={() => setShowFolderPicker(true)}
                  >
                    <FolderOpen size={12} className={folderDisplayName ? 'text-primary' : 'opacity-50'} />
                    <span className="text-[12px] truncate hidden sm:inline">
                      {folderDisplayName || (lang === 'zh' ? '未设置项目' : 'No project')}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  {activeSession?.workingDirectory || t('layout.selectFolder')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* 主题切换 — 移动端隐藏 */}
            {!isMobile && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={toggleTheme}
                    className="text-foreground"
                  >
                    {mode === 'dark' ? <Moon size={14} /> : mode === 'light' ? <Sun size={14} /> : <Monitor size={14} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  {mode === 'dark' ? t('settings.themeDark') : mode === 'light' ? t('settings.themeLight') : t('settings.themeSystem')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            )}

            {/* 通知音效开关 — 移动端隐藏 */}
            {!isMobile && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={toggleSound}
                    className={soundEnabled
                      ? 'text-primary hover:text-primary'
                      : 'text-foreground/50 hover:text-foreground'}
                  >
                    {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  {soundEnabled ? (lang === 'zh' ? '关闭通知音效' : 'Mute') : (lang === 'zh' ? '开启通知音效' : 'Unmute')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            )}

            {/* 云同步按钮 — 移动端隐藏 */}
            {!isMobile && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => syncToBackend()}
                    disabled={isSyncing}
                    className={cn(
                      'text-foreground',
                      lastSyncTime && !isSyncing && 'text-primary hover:text-primary'
                    )}
                  >
                    {isSyncing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : lastSyncTime ? (
                      <Cloud size={14} />
                    ) : (
                      <CloudOff size={14} />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  {isSyncing ? t('common.loading') : formatSyncTime(lastSyncTime)}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            )}

            {/* 通知中心 — 移动端隐藏（通过底部导航栏访问） */}
            {!isMobile && (
            <div className="relative" ref={notificationBtnRef}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setShowNotifications((prev) => !prev)}
                      className="text-foreground relative"
                    >
                      <Bell size={14} />
                      {notificationUnreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-red-400/90 text-white text-[10px] font-bold leading-none px-1">
                          {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    {lang === 'zh' ? '通知中心' : 'Notifications'}{notificationUnreadCount > 0 ? ` (${notificationUnreadCount})` : ''}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <NotificationCenter
                open={showNotifications}
                onClose={() => setShowNotifications(false)}
              />
            </div>
            )}

            {/* 高级参数 */}
            <div className="relative">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                      className={cn(
                        'text-muted-foreground',
                        showAdvancedParams && 'text-primary bg-primary/10'
                      )}
                    >
                      <SlidersHorizontal size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    {t('advancedParams.title')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* 非默认 effort 指示器 */}
              {activeSession?.effort && activeSession.effort !== 'medium' && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />
              )}

              <AdvancedParamsPanel
                sessionId={activeSessionId || ''}
                open={showAdvancedParams}
                onClose={() => setShowAdvancedParams(false)}
                onOpenChange={setShowAdvancedParams}
              />
            </div>

            {/* 权限模式切换 */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={cyclePermissionMode}
                    className={cn(
                      'gap-1',
                      permissionMode === 'auto'
                        ? 'text-amber-400/80 hover:text-amber-400'
                        : permissionMode === 'plan'
                          ? 'text-blue-400/80 hover:text-blue-300'
                          : 'text-foreground'
                    )}
                  >
                    <currentPermMode.Icon size={12} />
                    <span className="text-[12px] hidden sm:inline">{pn[currentPermMode.nameKey]}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  <div className="text-center">
                    <div className="font-medium">{lang === 'zh' ? '权限模式' : 'Permission'}: {pn[currentPermMode.nameKey]}</div>
                    <div className="text-[11px] text-foreground/70">{pn[currentPermMode.descKey]}</div>
                    <div className="text-[10px] text-foreground/50 mt-0.5">{lang === 'zh' ? '点击切换' : 'Click to switch'}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* 焦点模式切换 — 移动端隐藏 */}
            {!isMobile && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleToggleZenMode}
                    className="text-foreground"
                  >
                    <Maximize2 size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  {t('layout.zenMode')} (Ctrl+Shift+Z)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            )}

            {/* 连接状态指示器（增强版） */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-accent/50 transition-colors cursor-default">
                    <span className={`status-dot ${connectionStatus}`} />
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">
                      {connectionStatus === 'connected' && (
                        <>
                          {t('layout.connected')}
                          {backendVersion && <span className="text-muted-foreground ml-1">v{backendVersion}</span>}
                        </>
                      )}
                      {connectionStatus === 'connecting' && (
                        <>{t('layout.connecting')}{reconnectCount > 0 && <span className="text-muted-foreground ml-1">({reconnectCount})</span>}</>
                      )}
                      {connectionStatus === 'disconnected' && t('layout.disconnected')}
                    </span>
                    {/* 网络延迟指示器 — 移动端隐藏文字 */}
                    {connectionStatus === 'connected' && networkLatency !== null && !isMobile && (
                      <span className={cn(
                        'text-[10px] font-mono',
                        latencyLevel === 'good' && 'text-green-400/80',
                        latencyLevel === 'medium' && 'text-yellow-400/80',
                        latencyLevel === 'poor' && 'text-red-400/80',
                      )}>
                        {networkLatency}ms
                      </span>
                    )}
                    {/* 断开时显示手动重连按钮 */}
                    {connectionStatus === 'disconnected' && (
                      <button
                        className="text-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.dispatchEvent(new CustomEvent('manual-reconnect'))
                        }}
                        title={t('layout.reconnect')}
                      >
                        <RefreshCw size={11} />
                      </button>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  <div className="text-center space-y-0.5">
                    <div className="font-medium">{statusText}</div>
                    {connectionStatus === 'connected' && networkLatency !== null && (
                      <div className="text-[11px] text-foreground/70">
                        {t('layout.latency')}: {networkLatency}ms
                      </div>
                    )}
                    {connectionStatus === 'connected' && backendVersion && (
                      <div className="text-[10px] text-foreground/50">{t('layout.version')}: v{backendVersion}</div>
                    )}
                    {connectionStatus === 'connecting' && reconnectCount > 0 && (
                      <div className="text-[11px] text-foreground/70">{lang === 'zh' ? '重试' : 'Retry'} {reconnectCount}/5</div>
                    )}
                    {connectionStatus === 'disconnected' && lastDisconnectedAt && (
                      <div className="text-[11px] text-foreground/70">{lang === 'zh' ? '断开于' : 'Lost at'} {formatDisconnectedTime(lastDisconnectedAt)}</div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* 模型选择器 */}
            <div className="relative" ref={modelPickerRef}>
              <Button
                variant="ghost"
                size="xs"
                className="text-foreground gap-1"
                onClick={() => setShowModelPicker((prev) => !prev)}
              >
                <Zap size={12} className="text-primary" />
                <span className="text-[12px] hidden sm:inline">{currentModelLabel}</span>
                <ChevronDown size={12} className={`transition-transform hidden sm:block ${showModelPicker ? 'rotate-180' : ''}`} />
              </Button>

              {showModelPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-border bg-card shadow-lg py-1">
                  {MODEL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-accent/50 transition-colors ${
                        selectedModel === option.value ? 'text-primary' : 'text-foreground'
                      }`}
                      onClick={() => handleSelectModel(option.value)}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{mn[option.labelKey]}</span>
                        <span className="text-[11px] text-muted-foreground">{mn[option.descKey]}</span>
                      </div>
                      {selectedModel === option.value && (
                        <span className="ml-auto text-primary text-[11px]">&#10003;</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>
        <Separator />
        </>
        )}

        {/* 标签页栏 — 焦点模式下隐藏, 移动端隐藏 */}
        {!zenMode && !isMobile && openTabs.length > 0 && (
          <div className="session-tab-bar flex-shrink-0 flex items-center h-[34px] bg-card/50 border-b border-border px-1 gap-0">
            {/* 左滚动箭头 */}
            {tabScrollable.left && (
              <button
                className="flex-shrink-0 w-6 h-full flex items-center justify-center text-foreground transition-colors"
                onClick={() => scrollTabs('left')}
              >
                <ChevronLeft size={14} />
              </button>
            )}

            {/* 标签容器 */}
            <div
              ref={tabsContainerRef}
              className="flex-1 flex items-center overflow-x-hidden gap-0.5 min-w-0"
            >
              {openTabs.map((tabId, index) => {
                const tabSession = sessions.find(s => s.id === tabId)
                if (!tabSession) return null
                const isActive = tabId === activeSessionId
                const isStreamingTab = streamingSessions.has(tabId)
                const title = tabSession.title || t('sidebar.newChat')
                const truncatedTitle = title.length > 20 ? title.slice(0, 20) + '...' : title

                return (
                  <div
                    key={tabId}
                    draggable
                    onDragStart={(e) => handleTabDragStart(e, index)}
                    onDragOver={(e) => handleTabDragOver(e, index)}
                    onDragEnd={handleTabDragEnd}
                    onDragLeave={() => setDragOverTabIndex(null)}
                    onClick={() => handleTabClick(tabId)}
                    className={cn(
                      'session-tab group flex items-center gap-1 px-2.5 h-[28px] rounded-md cursor-pointer select-none transition-all text-[12px] min-w-0 max-w-[180px] flex-shrink-0',
                      isActive
                        ? 'bg-accent text-foreground shadow-sm'
                        : 'text-foreground hover:bg-accent/40',
                      dragOverTabIndex === index && dragTabIndex !== index && 'ring-1 ring-primary/50',
                      dragTabIndex === index && 'opacity-50'
                    )}
                  >
                    {/* 流式传输动画点 */}
                    {isStreamingTab && (
                      <span className="flex-shrink-0 flex items-center gap-[2px] mr-0.5">
                        <span className="w-[3px] h-[3px] rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                        <span className="w-[3px] h-[3px] rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                        <span className="w-[3px] h-[3px] rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                      </span>
                    )}
                    <span className="truncate text-[11px] leading-tight">{truncatedTitle}</span>
                    {/* 关闭按钮 */}
                    <button
                      className={cn(
                        'flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-sm transition-colors',
                        isActive
                          ? 'text-foreground hover:bg-background/50'
                          : 'opacity-0 group-hover:opacity-100 text-foreground hover:bg-background/50'
                      )}
                      onClick={(e) => handleTabClose(e, tabId)}
                    >
                      <X size={10} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* 右滚动箭头 */}
            {tabScrollable.right && (
              <button
                className="flex-shrink-0 w-6 h-full flex items-center justify-center text-foreground transition-colors"
                onClick={() => scrollTabs('right')}
              >
                <ChevronRightIcon size={14} />
              </button>
            )}

            {/* 新建标签按钮 */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-foreground hover:bg-accent/50 transition-colors ml-0.5"
                    onClick={handleNewChat}
                  >
                    <Plus size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  {t('sidebar.newChat')} (Ctrl+N)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* 路由内容 — 对话区完整占据右侧 */}
        <div className="flex-1 min-h-0 flex flex-col">
          <Outlet />
        </div>
      </main>

      {/* 文件夹选择器 */}
      <FolderPicker
        open={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onSelect={handleSelectFolder}
        initialPath={activeSession?.workingDirectory}
      />

      {/* 键盘快捷键帮助 */}
      <KeyboardShortcutsDialog
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* 全局命令面板 */}
      <GlobalCommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />

      {/* 浮动快捷键已整合到 ChatPage 的 FloatingToolbar 中 */}

      {/* 移动端底部导航栏 */}
      {isMobile && !zenMode && (
        <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-14 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
          <button
            onClick={() => {
              if (activeSessionId) {
                navigate(`/chat/${activeSessionId}`)
              } else {
                navigate('/')
              }
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
              (location.pathname === '/' || location.pathname.startsWith('/chat'))
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <MessageSquare size={20} />
            <span className="text-[10px] font-medium">{lang === 'zh' ? '对话' : 'Chat'}</span>
          </button>

          <button
            onClick={() => {
              setSidebarOpen(true)
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
              sidebarOpen
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <List size={20} />
            <span className="text-[10px] font-medium">{lang === 'zh' ? '会话' : 'Sessions'}</span>
          </button>

          <button
            onClick={() => navigate('/search')}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
              location.pathname === '/search'
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <Search size={20} />
            <span className="text-[10px] font-medium">{t('common.search')}</span>
          </button>

          <button
            onClick={() => navigate('/knowledge')}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
              location.pathname === '/knowledge'
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <BookOpen size={20} />
            <span className="text-[10px] font-medium">{t('knowledge.title')}</span>
          </button>

          <button
            onClick={() => navigate('/marketplace')}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
              location.pathname === '/marketplace'
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <Store size={20} />
            <span className="text-[10px] font-medium">{t('marketplace.title' as any)}</span>
          </button>

          <button
            onClick={() => navigate('/settings')}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
              location.pathname === '/settings'
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <Settings size={20} />
            <span className="text-[10px] font-medium">{t('common.settings')}</span>
          </button>
        </nav>
      )}
    </div>
  )
}
