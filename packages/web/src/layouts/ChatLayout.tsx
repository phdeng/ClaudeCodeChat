import { useState, useEffect, useCallback, useRef, type TouchEvent as ReactTouchEvent, type DragEvent } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeft, MessageSquare, ChevronDown, Zap, FolderOpen, Sun, Moon, Monitor, Volume2, VolumeX, Cloud, CloudOff, Loader2, Shield, ClipboardList, Maximize2, Minimize2, Bell, RefreshCw, X, Plus, ChevronLeft, ChevronRight as ChevronRightIcon, List, Search, Settings } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import FolderPicker from '../components/FolderPicker'
import KeyboardShortcutsDialog from '../components/KeyboardShortcutsDialog'
import GlobalCommandPalette from '../components/GlobalCommandPalette'
import NotificationCenter from '../components/NotificationCenter'
import { useSessionStore } from '../stores/sessionStore'
import { useThemeStore } from '../stores/themeStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useNotificationStore } from '../stores/notificationStore'
import { useIsMobile } from '../hooks/useMediaQuery'
import { initAutoSync } from '../services/sessionSync'
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
  { id: 'default', name: '默认', desc: '需要确认', Icon: Shield },
  { id: 'plan', name: '计划', desc: '需要批准计划', Icon: ClipboardList },
  { id: 'auto', name: '自动', desc: '自动执行', Icon: Zap },
]

const MODEL_OPTIONS = [
  { value: '', label: '默认', description: '使用服务器配置' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet', description: '快速且智能' },
  { value: 'claude-opus-4-6', label: 'Opus', description: '最强推理能力' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku', description: '极速响应' },
]

export default function ChatLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [zenMode, setZenMode] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
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
  const { soundEnabled, toggleSound } = useSettingsStore()
  const notificationUnreadCount = useNotificationStore((s) => s.unreadCount())

  const isMobile = useIsMobile()
  const activeSession = sessions.find((s) => s.id === activeSessionId)

  const currentModelLabel = MODEL_OPTIONS.find((m) => m.value === selectedModel)?.label || '默认'
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

  const statusText = connectionStatus === 'connected' ? '已连接' : connectionStatus === 'connecting' ? '连接中' : '未连接'

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

  const toggleZenMode = useCallback(() => {
    setZenMode((prev) => {
      if (!prev) {
        // 进入焦点模式时关闭侧边栏
        setSidebarOpen(false)
      }
      return !prev
    })
  }, [])

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
    if (!timestamp) return '尚未同步'
    const date = new Date(timestamp)
    return `上次同步: ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
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
        toggleZenMode()
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
  }, [toggleSidebar, handleNewChat, navigate, toggleTheme, sidebarOpen, zenMode, toggleZenMode])

  return (
    <div className={cn("flex h-screen overflow-hidden bg-background", zenMode && "zen-mode-active")}>
      {/* 焦点模式浮动工具条 */}
      {zenMode && (
        <div className="zen-toolbar">
          <span className="zen-toolbar-title">
            {activeSession?.title || '新对话'}
          </span>
          <span className={`status-dot ${connectionStatus}`} />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={toggleZenMode}
                  className="text-foreground"
                >
                  <Minimize2 size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                退出焦点模式 (ESC)
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
                  {sidebarOpen ? '收起侧边栏 (Ctrl+B)' : '展开侧边栏 (Ctrl+B)'}
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
                新对话
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
                      {folderDisplayName || '未设置项目'}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  {activeSession?.workingDirectory || '点击选择项目文件夹'}
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
                  {mode === 'dark' ? '暗色模式（点击切换）' : mode === 'light' ? '亮色模式（点击切换）' : '跟随系统（点击切换）'}
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
                  {soundEnabled ? '关闭通知音效' : '开启通知音效'}
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
                  {isSyncing ? '同步中...' : formatSyncTime(lastSyncTime)}
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
                    通知中心{notificationUnreadCount > 0 ? ` (${notificationUnreadCount} 条未读)` : ''}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <NotificationCenter
                open={showNotifications}
                onClose={() => setShowNotifications(false)}
              />
            </div>
            )}

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
                    <span className="text-[12px] hidden sm:inline">{currentPermMode.name}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  <div className="text-center">
                    <div className="font-medium">权限模式: {currentPermMode.name}</div>
                    <div className="text-[11px] text-foreground/70">{currentPermMode.desc}</div>
                    <div className="text-[10px] text-foreground/50 mt-0.5">点击切换</div>
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
                    onClick={toggleZenMode}
                    className="text-foreground"
                  >
                    <Maximize2 size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  焦点模式 (Ctrl+Shift+Z)
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
                          已连接
                          {backendVersion && <span className="text-muted-foreground ml-1">v{backendVersion}</span>}
                        </>
                      )}
                      {connectionStatus === 'connecting' && (
                        <>连接中...{reconnectCount > 0 && <span className="text-muted-foreground ml-1">({reconnectCount})</span>}</>
                      )}
                      {connectionStatus === 'disconnected' && '已断开'}
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
                        title="手动重连"
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
                        延迟: {networkLatency}ms
                        {latencyLevel === 'good' && ' (优)'}
                        {latencyLevel === 'medium' && ' (中)'}
                        {latencyLevel === 'poor' && ' (差)'}
                      </div>
                    )}
                    {connectionStatus === 'connected' && backendVersion && (
                      <div className="text-[10px] text-foreground/50">后端版本: v{backendVersion}</div>
                    )}
                    {connectionStatus === 'connecting' && reconnectCount > 0 && (
                      <div className="text-[11px] text-foreground/70">重试 {reconnectCount}/5</div>
                    )}
                    {connectionStatus === 'disconnected' && lastDisconnectedAt && (
                      <div className="text-[11px] text-foreground/70">断开于 {formatDisconnectedTime(lastDisconnectedAt)}</div>
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
                        <span className="font-medium">{option.label}</span>
                        <span className="text-[11px] text-muted-foreground">{option.description}</span>
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
                const title = tabSession.title || '新对话'
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
                  新建对话 (Ctrl+N)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* 路由内容 */}
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
            <span className="text-[10px] font-medium">对话</span>
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
            <span className="text-[10px] font-medium">会话</span>
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
            <span className="text-[10px] font-medium">搜索</span>
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
            <span className="text-[10px] font-medium">设置</span>
          </button>
        </nav>
      )}
    </div>
  )
}
