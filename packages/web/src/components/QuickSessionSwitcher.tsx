import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Clock, MessageSquare, Hash } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useSessionStore } from '../stores/sessionStore'
import { useTranslation } from '../i18n'
import { cn } from '@/lib/utils'

interface QuickSessionSwitcherProps {
  open: boolean
  onClose: () => void
}

/** 相对时间格式化 */
function formatRelativeTime(timestamp: number, lang: string): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (lang === 'zh') {
    if (seconds < 60) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 30) return `${days}天前`
    return `${Math.floor(days / 30)}个月前`
  } else {
    if (seconds < 60) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 30) return `${days}d ago`
    return `${Math.floor(days / 30)}mo ago`
  }
}

export default function QuickSessionSwitcher({ open, onClose }: QuickSessionSwitcherProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { sessions, activeSessionId, setActiveSession } = useSessionStore()
  const { lang } = useTranslation()

  // 过滤和排序会话
  const filtered = useMemo(() => {
    return sessions
      .filter((s) => !s.archived && s.title.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        const aTime = a.messages.length
          ? a.messages[a.messages.length - 1].timestamp
          : a.createdAt
        const bTime = b.messages.length
          ? b.messages[b.messages.length - 1].timestamp
          : b.createdAt
        return bTime - aTime
      })
      .slice(0, 20)
  }, [sessions, query])

  // 打开时重置状态
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      // 延迟聚焦，等待 Dialog 动画完成
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [open])

  // 搜索词变化时重置选中索引
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // 确保选中项在可视范围内
  useEffect(() => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll('[data-session-item]')
    const selectedItem = items[selectedIndex] as HTMLElement
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // 切换到指定会话
  const switchToSession = useCallback(
    (sessionId: string) => {
      setActiveSession(sessionId)
      navigate(`/chat/${sessionId}`)
      onClose()
    },
    [setActiveSession, navigate, onClose]
  )

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filtered[selectedIndex]) {
            switchToSession(filtered[selectedIndex].id)
          }
          break
      }
    },
    [filtered, selectedIndex, switchToSession]
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-md p-0 gap-0 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* 无障碍标题（视觉隐藏） */}
        <DialogTitle className="sr-only">
          {lang === 'zh' ? '快速切换会话' : 'Quick Session Switcher'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {lang === 'zh' ? '搜索并切换到任意会话' : 'Search and switch to any session'}
        </DialogDescription>

        {/* 搜索栏 */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
          <Search size={16} className="text-muted-foreground flex-shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === 'zh' ? '搜索会话...' : 'Search sessions...'}
            className="border-0 shadow-none focus-visible:ring-0 h-7 px-0 text-sm"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* 会话列表 */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {query
                ? (lang === 'zh' ? '没有匹配的会话' : 'No matching sessions')
                : (lang === 'zh' ? '暂无会话' : 'No sessions')}
            </div>
          ) : (
            filtered.map((session, index) => {
              const lastTime = session.messages.length
                ? session.messages[session.messages.length - 1].timestamp
                : session.createdAt
              const isActive = session.id === activeSessionId
              const isSelected = index === selectedIndex

              return (
                <div
                  key={session.id}
                  data-session-item
                  className={cn(
                    'mx-1 px-3 py-2 cursor-pointer rounded-md transition-colors flex items-center gap-3',
                    isSelected ? 'bg-muted' : 'hover:bg-muted/50',
                    isActive && 'border-l-2 border-primary'
                  )}
                  onClick={() => switchToSession(session.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {/* 左侧图标 */}
                  <MessageSquare
                    size={14}
                    className={cn(
                      'flex-shrink-0',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />

                  {/* 中间内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'text-[13px] truncate',
                          isActive ? 'font-medium text-primary' : 'text-foreground'
                        )}
                      >
                        {session.title}
                      </span>
                      {isActive && (
                        <span className="flex-shrink-0 text-[10px] text-primary bg-primary/10 px-1 py-0.5 rounded">
                          {lang === 'zh' ? '当前' : 'Active'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {/* 消息数量 */}
                      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <Hash size={10} />
                        {session.messages.length}
                      </span>
                      {/* 标签 */}
                      {session.tags && session.tags.length > 0 && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                          {session.tags.slice(0, 2).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 右侧时间 */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Clock size={10} className="text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(lastTime, lang)}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-3 py-2 border-t border-border flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center rounded border border-border bg-muted px-1 text-[10px] font-mono">
              &uarr;&darr;
            </kbd>
            {lang === 'zh' ? '导航' : 'Navigate'}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center rounded border border-border bg-muted px-1 text-[10px] font-mono">
              Enter
            </kbd>
            {lang === 'zh' ? '切换' : 'Switch'}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center rounded border border-border bg-muted px-1 text-[10px] font-mono">
              ESC
            </kbd>
            {lang === 'zh' ? '关闭' : 'Close'}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
