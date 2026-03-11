import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, BookmarkX, Search, Bot, User, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSessionStore } from '../stores/sessionStore'

interface BookmarksDialogProps {
  open: boolean
  onClose: () => void
}

/** 简易模糊匹配：检查关键词是否全部存在于目标字符串中 */
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  const keywords = q.split(/\s+/).filter(Boolean)
  return keywords.every((kw) => t.includes(kw))
}

/** 格式化时间戳 */
function formatTime(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `今天 ${time}`

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  if (isYesterday) return `昨天 ${time}`

  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + time
}

export default function BookmarksDialog({ open, onClose }: BookmarksDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const getAllBookmarkedMessages = useSessionStore((s) => s.getAllBookmarkedMessages)
  const toggleMessageBookmark = useSessionStore((s) => s.toggleMessageBookmark)

  const bookmarks = useMemo(() => getAllBookmarkedMessages(), [getAllBookmarkedMessages, open])

  // 根据搜索词过滤
  const filteredBookmarks = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return bookmarks
    return bookmarks.filter((b) =>
      fuzzyMatch(q, `${b.sessionTitle} ${b.message.content}`)
    )
  }, [searchQuery, bookmarks])

  // 打开时重置状态
  useEffect(() => {
    if (open) {
      setSearchQuery('')
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [open])

  // ESC 关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  // 跳转到对应会话
  const handleGoToSession = (sessionId: string) => {
    onClose()
    requestAnimationFrame(() => {
      navigate(`/chat/${sessionId}`)
    })
  }

  // 取消收藏
  const handleRemoveBookmark = (sessionId: string, messageId: string) => {
    toggleMessageBookmark(sessionId, messageId)
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* 居中偏上的面板 */}
      <div className="fixed left-1/2 top-[12%] -translate-x-1/2 w-full max-w-lg animate-fade-in">
        <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <Bookmark size={18} className="text-yellow-400/80" />
              <h2 className="text-[14px] font-semibold text-foreground">收藏的消息</h2>
              {bookmarks.length > 0 && (
                <span className="text-[11px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded-full">
                  {bookmarks.length}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="text-foreground"
            >
              <X size={14} />
            </Button>
          </div>

          {/* 搜索框 */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
            <Search size={16} className="text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="搜索收藏的消息..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  inputRef.current?.focus()
                }}
                className="text-[11px] text-foreground transition-colors px-1.5 py-0.5 rounded bg-accent/50"
              >
                清除
              </button>
            )}
          </div>

          {/* 书签列表 */}
          <ScrollArea className="max-h-[55vh]">
            <div className="py-1.5">
              {filteredBookmarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Bookmark size={32} className="text-muted-foreground/30" />
                  <span className="text-[13px] text-muted-foreground">
                    {searchQuery ? '没有找到匹配的收藏消息' : '暂无收藏消息'}
                  </span>
                  {!searchQuery && (
                    <span className="text-[11px] text-muted-foreground/60">
                      在消息上点击收藏按钮即可添加到这里
                    </span>
                  )}
                </div>
              ) : (
                filteredBookmarks.map((item) => (
                  <div
                    key={item.message.id}
                    className="mx-1.5 mb-1 rounded-lg border border-border/50 bg-background/50 hover:bg-accent/30 transition-colors"
                  >
                    {/* 消息头部：角色 + 会话标题 + 时间 + 取消收藏 */}
                    <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                      {/* 角色图标 */}
                      <span className="flex-shrink-0">
                        {item.message.role === 'assistant' ? (
                          <Bot size={14} className="text-primary" />
                        ) : (
                          <User size={14} className="text-muted-foreground" />
                        )}
                      </span>

                      {/* 会话标题（可点击跳转） */}
                      <button
                        onClick={() => handleGoToSession(item.sessionId)}
                        className="text-[11px] text-primary/80 hover:text-primary hover:underline truncate max-w-[200px] transition-colors"
                        title={`跳转到会话: ${item.sessionTitle}`}
                      >
                        {item.sessionTitle}
                      </button>

                      {/* 时间戳 */}
                      <span className="text-[10px] text-muted-foreground/60 ml-auto flex-shrink-0">
                        {formatTime(item.message.timestamp)}
                      </span>

                      {/* 取消收藏按钮 */}
                      <button
                        onClick={() => handleRemoveBookmark(item.sessionId, item.message.id)}
                        className="flex-shrink-0 p-0.5 rounded text-muted-foreground/50 hover:text-destructive transition-colors"
                        title="取消收藏"
                      >
                        <BookmarkX size={13} />
                      </button>
                    </div>

                    {/* 消息内容预览 */}
                    <div className="px-3 pb-2.5">
                      <div className="text-[12px] text-foreground leading-relaxed line-clamp-4 prose prose-sm prose-invert max-w-none
                        [&_pre]:bg-accent/50 [&_pre]:rounded [&_pre]:px-2 [&_pre]:py-1 [&_pre]:text-[11px]
                        [&_code]:bg-accent/50 [&_code]:rounded [&_code]:px-1 [&_code]:text-[11px]
                        [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0 [&_li]:m-0
                        [&_h1]:text-[13px] [&_h2]:text-[13px] [&_h3]:text-[12px]
                        [&_a]:text-primary">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {item.message.content.slice(0, 200) +
                            (item.message.content.length > 200 ? '...' : '')}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* 底部快捷键提示 */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-border">
            <span className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">Esc</kbd>{' '}关闭
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              点击会话标题可跳转
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
