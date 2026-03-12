import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
  MessageSquare,
  User,
  Bot,
} from 'lucide-react'
import { useSessionStore } from '../stores/sessionStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

// ======================== 类型 ========================

interface GlobalSearchPanelProps {
  open: boolean
  onClose: () => void
  onNavigate: (sessionId: string, messageIndex: number) => void
}

interface SearchResult {
  sessionId: string
  sessionTitle: string
  messageIndex: number
  messageId: string
  role: 'user' | 'assistant'
  snippet: string
  timestamp: number
}

type RoleFilter = 'all' | 'user' | 'assistant'

// ======================== 常量 ========================

const SEARCH_HISTORY_KEY = 'search-history'
const MAX_HISTORY = 10
const DEBOUNCE_MS = 300
const SNIPPET_RADIUS = 50

/** 8 种颜色标签，与 Sidebar 保持一致 */
const LABEL_COLORS = [
  { name: 'red', bg: 'bg-red-400/90', label: '红色' },
  { name: 'orange', bg: 'bg-orange-400/90', label: '橙色' },
  { name: 'yellow', bg: 'bg-yellow-400/90', label: '黄色' },
  { name: 'green', bg: 'bg-green-400/90', label: '绿色' },
  { name: 'blue', bg: 'bg-blue-400/90', label: '蓝色' },
  { name: 'purple', bg: 'bg-purple-400/90', label: '紫色' },
  { name: 'pink', bg: 'bg-pink-400/90', label: '粉色' },
  { name: 'gray', bg: 'bg-gray-400/90', label: '灰色' },
]

// ======================== 工具函数 ========================

/** 读取搜索历史 */
function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.slice(0, MAX_HISTORY) : []
  } catch {
    return []
  }
}

/** 保存搜索历史 */
function saveHistory(history: string[]) {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}

/** 在搜索历史中加入新词（去重 + 移到最前） */
function pushHistory(history: string[], term: string): string[] {
  const trimmed = term.trim()
  if (!trimmed) return history
  const filtered = history.filter((h) => h !== trimmed)
  return [trimmed, ...filtered].slice(0, MAX_HISTORY)
}

/**
 * 截取匹配关键词前后各 radius 个字符作为摘要，
 * 返回带 <mark> 高亮的 HTML 字符串。
 */
function buildSnippet(content: string, keyword: string, radius: number = SNIPPET_RADIUS): string {
  const lowerContent = content.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
  const idx = lowerContent.indexOf(lowerKeyword)
  if (idx === -1) return content.slice(0, radius * 2)

  const start = Math.max(0, idx - radius)
  const end = Math.min(content.length, idx + keyword.length + radius)
  let snippet = ''
  if (start > 0) snippet += '...'
  snippet += content.slice(start, end)
  if (end < content.length) snippet += '...'
  return snippet
}

/** 将摘要中的关键词替换为 <mark> 标签 */
function highlightKeyword(text: string, keyword: string): (string | React.ReactElement)[] {
  if (!keyword) return [text]
  const parts: (string | React.ReactElement)[] = []
  const lower = text.toLowerCase()
  const lowerKw = keyword.toLowerCase()
  let cursor = 0
  let matchIdx = lower.indexOf(lowerKw, cursor)

  while (matchIdx !== -1) {
    if (matchIdx > cursor) {
      parts.push(text.slice(cursor, matchIdx))
    }
    parts.push(
      <mark
        key={`hl-${matchIdx}`}
        className="bg-yellow-300/80 dark:bg-yellow-500/40 text-foreground rounded-sm px-0.5"
      >
        {text.slice(matchIdx, matchIdx + keyword.length)}
      </mark>
    )
    cursor = matchIdx + keyword.length
    matchIdx = lower.indexOf(lowerKw, cursor)
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor))
  }
  return parts
}

// ======================== 组件 ========================

export default function GlobalSearchPanel({ open, onClose, onNavigate }: GlobalSearchPanelProps) {
  const sessions = useSessionStore((s) => s.sessions)

  // --- 搜索状态 ---
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // --- 筛选器状态 ---
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set())
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  // --- 搜索历史 ---
  const [history, setHistory] = useState<string[]>(loadHistory)

  // 聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // 防抖
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // 当防抖查询词变化且非空时，记录到搜索历史
  useEffect(() => {
    if (debouncedQuery) {
      setHistory((prev) => {
        const next = pushHistory(prev, debouncedQuery)
        saveHistory(next)
        return next
      })
    }
  }, [debouncedQuery])

  // --- 派生数据 ---

  /** 所有会话中出现过的标签（去重） */
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const s of sessions) {
      if (s.tags) s.tags.forEach((t) => tagSet.add(t))
    }
    return Array.from(tagSet).sort()
  }, [sessions])

  /** 所有会话的项目路径（去重） */
  const allProjects = useMemo(() => {
    const dirSet = new Set<string>()
    for (const s of sessions) {
      if (s.workingDirectory) dirSet.add(s.workingDirectory)
    }
    return Array.from(dirSet).sort()
  }, [sessions])

  // --- 搜索 + 筛选 ---

  const results = useMemo<SearchResult[]>(() => {
    if (!debouncedQuery) return []

    const lowerQuery = debouncedQuery.toLowerCase()
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0
    const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity

    const matched: SearchResult[] = []

    for (const session of sessions) {
      // --- 会话级筛选 ---
      // 标签筛选
      if (selectedTags.size > 0) {
        const sessionTags = session.tags || []
        const hasTag = Array.from(selectedTags).some((t) => sessionTags.includes(t))
        if (!hasTag) continue
      }
      // 颜色标签筛选
      if (selectedColors.size > 0) {
        if (!session.colorLabel || !selectedColors.has(session.colorLabel)) continue
      }
      // 项目路径筛选
      if (selectedProject && session.workingDirectory !== selectedProject) continue

      // --- 消息级搜索 ---
      for (let i = 0; i < session.messages.length; i++) {
        const msg = session.messages[i]

        // 角色筛选
        if (roleFilter !== 'all' && msg.role !== roleFilter) continue

        // 日期范围筛选
        if (msg.timestamp < fromTs || msg.timestamp > toTs) continue

        // 关键词匹配
        if (!msg.content.toLowerCase().includes(lowerQuery)) continue

        matched.push({
          sessionId: session.id,
          sessionTitle: session.title,
          messageIndex: i,
          messageId: msg.id,
          role: msg.role,
          snippet: buildSnippet(msg.content, debouncedQuery),
          timestamp: msg.timestamp,
        })
      }
    }

    // 按时间倒序
    matched.sort((a, b) => b.timestamp - a.timestamp)
    return matched
  }, [debouncedQuery, sessions, dateFrom, dateTo, selectedTags, selectedColors, selectedProject, roleFilter])

  /** 按会话分组 */
  const groupedResults = useMemo(() => {
    const groups: Record<string, { sessionTitle: string; items: SearchResult[] }> = {}
    for (const r of results) {
      if (!groups[r.sessionId]) {
        groups[r.sessionId] = { sessionTitle: r.sessionTitle, items: [] }
      }
      groups[r.sessionId].items.push(r)
    }
    return Object.entries(groups)
  }, [results])

  // --- 操作回调 ---

  const handleResultClick = useCallback(
    (sessionId: string, messageIndex: number) => {
      onNavigate(sessionId, messageIndex)
      onClose()
    },
    [onNavigate, onClose]
  )

  const handleHistoryClick = useCallback((term: string) => {
    setQuery(term)
    setDebouncedQuery(term)
  }, [])

  const handleDeleteHistory = useCallback((term: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h !== term)
      saveHistory(next)
      return next
    })
  }, [])

  const handleClearHistory = useCallback(() => {
    setHistory([])
    saveHistory([])
  }, [])

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }, [])

  const toggleColor = useCallback((color: string) => {
    setSelectedColors((prev) => {
      const next = new Set(prev)
      if (next.has(color)) next.delete(color)
      else next.add(color)
      return next
    })
  }, [])

  const clearFilters = useCallback(() => {
    setDateFrom('')
    setDateTo('')
    setSelectedTags(new Set())
    setSelectedColors(new Set())
    setSelectedProject('')
    setRoleFilter('all')
  }, [])

  const hasActiveFilters = dateFrom || dateTo || selectedTags.size > 0 || selectedColors.size > 0 || selectedProject || roleFilter !== 'all'

  // ======================== 渲染 ========================

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        {/* 头部 */}
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Search size={18} />
            全局搜索
          </SheetTitle>
          <SheetDescription>跨会话搜索所有消息内容</SheetDescription>
        </SheetHeader>

        {/* 搜索框 */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入关键词搜索..."
              className="pl-9 pr-9"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('')
                  setDebouncedQuery('')
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 筛选器切换按钮 */}
        <div className="px-4 pb-1">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors',
              hasActiveFilters ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Filter size={13} />
            高级筛选
            {hasActiveFilters && (
              <span className="ml-1 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-medium">
                已启用
              </span>
            )}
            {filtersOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* 筛选器面板 */}
        {filtersOpen && (
          <div className="px-4 pb-2 space-y-3 border-b border-border">
            {/* 日期范围 */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">日期范围</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
                />
                <span className="text-xs text-muted-foreground">至</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
                />
              </div>
            </div>

            {/* 标签筛选 */}
            {allTags.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">标签</label>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full border transition-colors',
                        selectedTags.has(tag)
                          ? 'bg-primary/15 border-primary/40 text-primary'
                          : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 颜色标签 */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">颜色标签</label>
              <div className="flex items-center gap-2">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => toggleColor(color.name)}
                    title={color.label}
                    className={cn(
                      'w-5 h-5 rounded-full transition-all',
                      color.bg,
                      selectedColors.has(color.name)
                        ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110'
                        : 'opacity-60 hover:opacity-100'
                    )}
                  />
                ))}
              </div>
            </div>

            {/* 项目路径 */}
            {allProjects.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">项目路径</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
                >
                  <option value="">全部项目</option>
                  {allProjects.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 消息角色 */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">消息角色</label>
              <div className="flex items-center gap-1.5">
                {([
                  { value: 'all', label: '全部', icon: MessageSquare },
                  { value: 'user', label: '仅用户', icon: User },
                  { value: 'assistant', label: '仅助手', icon: Bot },
                ] as const).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setRoleFilter(value)}
                    className={cn(
                      'flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition-colors',
                      roleFilter === value
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                    )}
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 清除筛选 */}
            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
                  清除所有筛选
                </Button>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* 结果区域 */}
        <ScrollArea className="flex-1">
          <div className="px-4 py-2">
            {/* 搜索前：显示搜索历史 + 提示 */}
            {!debouncedQuery && (
              <div className="space-y-3">
                {history.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground font-medium">搜索历史</span>
                      <button
                        onClick={handleClearHistory}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        清空
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {history.map((term) => (
                        <div
                          key={term}
                          className="flex items-center gap-2 group rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => handleHistoryClick(term)}
                        >
                          <Clock size={13} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-sm flex-1 truncate">{term}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteHistory(term)
                            }}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-center py-8">
                  <Search size={32} className="mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">输入关键词开始搜索</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">支持跨会话搜索所有消息内容</p>
                </div>
              </div>
            )}

            {/* 搜索中但无结果 */}
            {debouncedQuery && results.length === 0 && (
              <div className="text-center py-12">
                <Search size={32} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">未找到匹配结果</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  尝试更换关键词或调整筛选条件
                </p>
              </div>
            )}

            {/* 搜索结果 */}
            {debouncedQuery && results.length > 0 && (
              <div className="space-y-4">
                <div className="text-xs text-muted-foreground">
                  找到 <span className="text-foreground font-medium">{results.length}</span> 条匹配，
                  来自 <span className="text-foreground font-medium">{groupedResults.length}</span> 个会话
                </div>

                {groupedResults.map(([sessionId, group]) => (
                  <div key={sessionId}>
                    {/* 会话标题 */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageSquare size={12} className="text-muted-foreground flex-shrink-0" />
                      <span className="text-xs font-medium text-muted-foreground truncate">
                        {group.sessionTitle}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 ml-auto flex-shrink-0">
                        {group.items.length} 条
                      </span>
                    </div>

                    {/* 匹配消息列表 */}
                    <div className="space-y-1 ml-0.5">
                      {group.items.map((item) => (
                        <div
                          key={`${item.sessionId}-${item.messageIndex}`}
                          onClick={() => handleResultClick(item.sessionId, item.messageIndex)}
                          className="rounded-md px-2.5 py-2 hover:bg-accent cursor-pointer transition-colors border border-transparent hover:border-border"
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {item.role === 'user' ? (
                              <User size={11} className="text-blue-400" />
                            ) : (
                              <Bot size={11} className="text-green-400" />
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {item.role === 'user' ? '用户' : '助手'}
                            </span>
                            <span className="text-[10px] text-muted-foreground/50 ml-auto">
                              {new Date(item.timestamp).toLocaleString('zh-CN', {
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/80 leading-relaxed break-all">
                            {highlightKeyword(item.snippet, debouncedQuery)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
