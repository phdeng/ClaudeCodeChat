import { useRef, useState, useCallback, useEffect, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSessionTabsStore } from '@/stores/sessionTabsStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export default function SessionTabs() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { tabs, activeTabId, setActiveTab, closeTab, closeOtherTabs, closeAllTabs, openTab } = useSessionTabsStore()
  const { sessions, setActiveSession, createSession, streamingSessions } = useSessionStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollable, setScrollable] = useState<{ left: boolean; right: boolean }>({ left: false, right: false })
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [contextMenuTabId, setContextMenuTabId] = useState<string | null>(null)

  // 检查是否需要滚动箭头
  const checkScrollable = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    setScrollable({
      left: el.scrollLeft > 0,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    })
  }, [])

  useEffect(() => {
    checkScrollable()
    const el = containerRef.current
    if (el) {
      el.addEventListener('scroll', checkScrollable)
      const ro = new ResizeObserver(checkScrollable)
      ro.observe(el)
      return () => {
        el.removeEventListener('scroll', checkScrollable)
        ro.disconnect()
      }
    }
  }, [tabs, checkScrollable])

  // 鼠标滚轮水平滚动
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const el = containerRef.current
    if (!el) return
    if (e.deltaY !== 0) {
      e.preventDefault()
      el.scrollBy({ left: e.deltaY, behavior: 'smooth' })
    }
  }, [])

  const scrollTabs = useCallback((direction: 'left' | 'right') => {
    const el = containerRef.current
    if (!el) return
    el.scrollBy({
      left: direction === 'left' ? -200 : 200,
      behavior: 'smooth',
    })
  }, [])

  // 点击标签
  const handleTabClick = useCallback((sessionId: string) => {
    setActiveTab(sessionId)
    setActiveSession(sessionId)
    navigate(`/chat/${sessionId}`)
  }, [setActiveTab, setActiveSession, navigate])

  // 关闭标签
  const handleTabClose = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    const wasActive = activeTabId === sessionId
    closeTab(sessionId)
    if (wasActive) {
      // 下一帧获取新的 activeTabId 并导航
      setTimeout(() => {
        const newActiveId = useSessionTabsStore.getState().activeTabId
        if (newActiveId) {
          setActiveSession(newActiveId)
          navigate(`/chat/${newActiveId}`)
        } else {
          navigate('/')
        }
      }, 0)
    }
  }, [activeTabId, closeTab, setActiveSession, navigate])

  // 右键菜单操作
  const handleCloseOthers = useCallback((sessionId: string) => {
    closeOtherTabs(sessionId)
    setActiveSession(sessionId)
    navigate(`/chat/${sessionId}`)
  }, [closeOtherTabs, setActiveSession, navigate])

  const handleCloseAll = useCallback(() => {
    closeAllTabs()
    navigate('/')
  }, [closeAllTabs, navigate])

  // 拖拽排序
  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, index: number) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      // 在 store 中重新排列 tabs
      const { tabs: currentTabs } = useSessionTabsStore.getState()
      const newTabs = [...currentTabs]
      const [moved] = newTabs.splice(dragIndex, 1)
      newTabs.splice(dragOverIndex, 0, moved)
      useSessionTabsStore.setState({ tabs: newTabs })
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }, [dragIndex, dragOverIndex])

  // 新建对话
  const handleNewChat = useCallback(() => {
    const session = createSession()
    openTab(session.id, session.title)
    navigate(`/chat/${session.id}`)
  }, [createSession, openTab, navigate])

  return (
    <div className="session-tab-bar flex-shrink-0 flex items-center h-[36px] bg-card/50 border-b border-border px-1 gap-0">
      {/* 左滚动箭头 */}
      {scrollable.left && (
        <button
          className="flex-shrink-0 w-6 h-full flex items-center justify-center text-foreground transition-colors"
          onClick={() => scrollTabs('left')}
        >
          <ChevronLeft size={14} />
        </button>
      )}

      {/* 标签容器 */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center overflow-x-hidden gap-0.5 min-w-0 scrollbar-none"
        onWheel={handleWheel}
      >
        {tabs.map((tab, index) => {
          const tabSession = sessions.find((s) => s.id === tab.sessionId)
          const isActive = tab.sessionId === activeTabId
          const isStreaming = streamingSessions.has(tab.sessionId)
          const displayTitle = tabSession?.title || tab.title || t('sidebar.newChat')

          return (
            <DropdownMenu
              key={tab.sessionId}
              onOpenChange={(open) => {
                if (open) setContextMenuTabId(tab.sessionId)
                else setContextMenuTabId(null)
              }}
            >
              <DropdownMenuTrigger asChild>
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragLeave={() => setDragOverIndex(null)}
                  onClick={() => handleTabClick(tab.sessionId)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenuTabId(tab.sessionId)
                  }}
                  className={cn(
                    'session-tab group flex items-center gap-1 px-2.5 h-[28px] rounded-md cursor-pointer select-none transition-all text-[12px] min-w-0 max-w-[160px] flex-shrink-0',
                    isActive
                      ? 'bg-background text-foreground border-b-2 border-b-primary shadow-sm'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/50',
                    dragOverIndex === index && dragIndex !== index && 'ring-1 ring-primary/50',
                    dragIndex === index && 'opacity-50'
                  )}
                  title={displayTitle}
                >
                  {/* 流式传输动画点 */}
                  {isStreaming && (
                    <span className="flex-shrink-0 flex items-center gap-[2px] mr-0.5">
                      <span className="w-[3px] h-[3px] rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                      <span className="w-[3px] h-[3px] rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                      <span className="w-[3px] h-[3px] rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                  <span className="truncate text-[11px] leading-tight max-w-[120px]">{displayTitle}</span>
                  {/* 关闭按钮 */}
                  <button
                    className={cn(
                      'flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-sm transition-all',
                      isActive
                        ? 'opacity-60 hover:opacity-100 hover:bg-accent/80'
                        : 'opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-accent/80'
                    )}
                    onClick={(e) => handleTabClose(e, tab.sessionId)}
                  >
                    <X size={10} />
                  </button>
                </div>
              </DropdownMenuTrigger>

              {/* 右键菜单 */}
              {contextMenuTabId === tab.sessionId && (
                <DropdownMenuContent
                  side="bottom"
                  align="start"
                  sideOffset={2}
                  className="min-w-[140px]"
                >
                  <DropdownMenuItem onClick={() => handleTabClose({ stopPropagation: () => {} } as React.MouseEvent, tab.sessionId)}>
                    {t('sessionTabs.close')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleCloseOthers(tab.sessionId)}>
                    {t('sessionTabs.closeOthers')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCloseAll()}>
                    {t('sessionTabs.closeAll')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              )}
            </DropdownMenu>
          )
        })}
      </div>

      {/* 右滚动箭头 */}
      {scrollable.right && (
        <button
          className="flex-shrink-0 w-6 h-full flex items-center justify-center text-foreground transition-colors"
          onClick={() => scrollTabs('right')}
        >
          <ChevronRight size={14} />
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
  )
}
