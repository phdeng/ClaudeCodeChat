import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Bot, User, Clock, MessageSquare } from 'lucide-react'
import { useSessionStore } from '@/stores/sessionStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

// ==================== 类型定义 ====================

interface SearchResult {
  sessionId: string
  sessionTitle: string
  messageId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  matchSnippet: string
}

// ==================== 工具函数 ====================

/** 转义正则表达式特殊字符 */
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 高亮匹配关键词 */
function highlightText(text: string, keyword: string) {
  if (!keyword.trim()) return text
  const parts = text.split(new RegExp(`(${escapeRegExp(keyword)})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase()
      ? <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">{part}</mark>
      : part
  )
}

/** 格式化时间戳为可读文本 */
function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`
  // 超过 30 天显示具体日期
  const d = new Date(timestamp)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ==================== 主组件 ====================

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { sessions, setActiveSession } = useSessionStore()

  // 自动聚焦搜索框
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 防抖 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // 搜索逻辑：搜索所有会话的标题 + 消息内容
  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    const q = debouncedQuery.toLowerCase()
    const found: SearchResult[] = []

    for (const session of sessions) {
      // 搜索会话标题
      if (session.title.toLowerCase().includes(q)) {
        // 标题匹配时，将标题作为一个结果项，使用第一条消息的信息
        found.push({
          sessionId: session.id,
          sessionTitle: session.title,
          messageId: '__title__',
          role: 'user',
          content: session.title,
          timestamp: session.createdAt,
          matchSnippet: session.title,
        })
      }

      // 搜索消息内容
      for (const msg of session.messages) {
        if (msg.content.toLowerCase().includes(q)) {
          // 提取匹配片段（前后各 50 字符）
          const idx = msg.content.toLowerCase().indexOf(q)
          const start = Math.max(0, idx - 50)
          const end = Math.min(msg.content.length, idx + q.length + 50)
          const snippet =
            (start > 0 ? '...' : '') +
            msg.content.slice(start, end) +
            (end < msg.content.length ? '...' : '')

          found.push({
            sessionId: session.id,
            sessionTitle: session.title,
            messageId: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            matchSnippet: snippet,
          })
        }
      }
    }

    return found
  }, [debouncedQuery, sessions])

  // 按会话分组
  const groupedResults = useMemo(() => {
    const groups = new Map<string, { title: string; results: SearchResult[] }>()
    for (const r of results) {
      if (!groups.has(r.sessionId)) {
        groups.set(r.sessionId, { title: r.sessionTitle, results: [] })
      }
      groups.get(r.sessionId)!.results.push(r)
    }
    return Array.from(groups.entries())
  }, [results])

  // 点击结果项跳转到对应会话
  const handleResultClick = (sessionId: string) => {
    setActiveSession(sessionId)
    navigate(`/chat/${sessionId}`)
  }

  const hasQuery = debouncedQuery.trim().length > 0

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 顶部搜索栏 */}
      <header className="flex-shrink-0 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {/* 返回按钮 + 标题 */}
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate(-1)}
              className="text-foreground"
            >
              <ArrowLeft size={18} />
            </Button>
            <Search size={18} className="text-primary" />
            <h1 className="text-[16px] font-semibold text-foreground">全局搜索</h1>
          </div>

          {/* 搜索输入框 */}
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              ref={inputRef}
              type="text"
              placeholder="搜索所有会话中的消息内容..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(
                'w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-card text-[15px] text-foreground',
                'placeholder:text-muted-foreground/60 outline-none transition-colors',
                'focus:border-primary/50 focus:ring-2 focus:ring-primary/20'
              )}
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-foreground transition-colors px-2 py-1 rounded-md bg-accent/50"
              >
                清除
              </button>
            )}
          </div>

          {/* 搜索结果统计 */}
          {hasQuery && (
            <div className="mt-2.5 flex items-center gap-2 text-[12px] text-muted-foreground">
              <span>
                找到 <span className="font-medium text-foreground">{results.length}</span> 条结果，
                来自 <span className="font-medium text-foreground">{groupedResults.length}</span> 个会话
              </span>
            </div>
          )}
        </div>
      </header>

      {/* 搜索结果区域 */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {/* 空搜索提示 */}
          {!hasQuery && (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-accent/50 flex items-center justify-center mb-4">
                <Search size={28} className="text-muted-foreground opacity-40" />
              </div>
              <p className="text-[14px] text-muted-foreground mb-1">输入关键词搜索所有会话</p>
              <p className="text-[12px] text-muted-foreground">支持搜索会话标题和消息内容</p>
            </div>
          )}

          {/* 无结果提示 */}
          {hasQuery && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-accent/50 flex items-center justify-center mb-4">
                <Search size={28} className="text-muted-foreground" />
              </div>
              <p className="text-[14px] text-muted-foreground">未找到匹配结果</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                尝试使用不同的关键词
              </p>
            </div>
          )}

          {/* 搜索结果列表（按会话分组） */}
          {hasQuery && groupedResults.length > 0 && (
            <div className="space-y-5 animate-fade-in">
              {groupedResults.map(([sessionId, group]) => (
                <div key={sessionId}>
                  {/* 会话标题 */}
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare size={13} className="text-primary opacity-70 flex-shrink-0" />
                    <span className="text-[13px] font-medium text-foreground truncate">
                      {highlightText(group.title, debouncedQuery)}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0"
                    >
                      {group.results.length} 条匹配
                    </Badge>
                  </div>

                  {/* 匹配的消息列表 */}
                  <div className="space-y-1.5 ml-5">
                    {group.results.map((result) => (
                      <button
                        key={`${result.sessionId}-${result.messageId}`}
                        onClick={() => handleResultClick(result.sessionId)}
                        className={cn(
                          'w-full text-left px-3.5 py-3 rounded-xl border border-border bg-card/50',
                          'hover:bg-accent/50 hover:border-primary/30 transition-colors duration-150',
                          'cursor-pointer group'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          {/* 角色标识 */}
                          {result.role === 'assistant' ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-4.5 h-4.5 rounded-md bg-gradient-to-br from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] flex items-center justify-center">
                                <Bot size={10} className="text-white" />
                              </div>
                              <span className="text-[11px] text-muted-foreground font-medium">助手</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="w-4.5 h-4.5 rounded-md bg-primary/15 flex items-center justify-center">
                                <User size={10} className="text-primary" />
                              </div>
                              <span className="text-[11px] text-muted-foreground font-medium">
                                {result.messageId === '__title__' ? '标题匹配' : '用户'}
                              </span>
                            </div>
                          )}

                          {/* 时间戳 */}
                          <div className="flex items-center gap-1 ml-auto text-[10px] text-muted-foreground">
                            <Clock size={10} />
                            <span>{formatTime(result.timestamp)}</span>
                          </div>
                        </div>

                        {/* 匹配内容预览（高亮关键词） */}
                        <div className="text-[13px] text-foreground leading-relaxed break-words line-clamp-3">
                          {highlightText(result.matchSnippet, debouncedQuery)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 底部快捷键提示 */}
      <div className="flex-shrink-0 border-t border-border px-4 py-2">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <span className="text-[10px] text-muted-foreground">
            <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">Ctrl+Shift+F</kbd>{' '}打开搜索
          </span>
          <span className="text-[10px] text-muted-foreground">
            <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">Esc</kbd>{' '}返回
          </span>
        </div>
      </div>
    </div>
  )
}
