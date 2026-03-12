import { useState, useMemo, useCallback } from 'react'
import { Star, Copy, Pencil, Trash2, X, Search, User, Bot, Check, Tag, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { useFavoritesStore, type FavoriteMessage } from '@/stores/favoritesStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

interface FavoritesPanelProps {
  open: boolean
  onClose: () => void
}

/** 预定义分类 */
const CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'uncategorized', label: '未分类' },
  { key: 'code', label: '代码' },
  { key: 'qa', label: '问答' },
  { key: 'note', label: '笔记' },
  { key: 'important', label: '重要' },
]

/** 格式化时间 */
function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHour < 24) return `${diffHour} 小时前`
  if (diffDay < 7) return `${diffDay} 天前`

  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** 截取内容预览（去除 Markdown 标记） */
function getPreview(content: string, maxLen = 120): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, '[代码块]')
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#+\s/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
  return plain.length > maxLen ? plain.slice(0, maxLen) + '...' : plain
}

export default function FavoritesPanel({ open, onClose }: FavoritesPanelProps) {
  const { favorites, removeFavorite, updateFavoriteNote, updateFavoriteCategory } = useFavoritesStore()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)

  /** 根据分类和搜索过滤收藏 */
  const filteredFavorites = useMemo(() => {
    let list = favorites
    // 分类过滤
    if (activeCategory !== 'all') {
      list = list.filter(f => f.category === activeCategory)
    }
    // 搜索过滤
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(f =>
        f.content.toLowerCase().includes(q) ||
        f.sessionName.toLowerCase().includes(q) ||
        (f.note && f.note.toLowerCase().includes(q))
      )
    }
    return list
  }, [favorites, activeCategory, search])

  /** 各分类的计数 */
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: favorites.length }
    for (const f of favorites) {
      counts[f.category] = (counts[f.category] || 0) + 1
    }
    return counts
  }, [favorites])

  /** 复制内容 */
  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success('已复制内容')
    }).catch(() => {
      toast.error('复制失败')
    })
  }, [])

  /** 开始编辑备注 */
  const handleStartEditNote = useCallback((fav: FavoriteMessage) => {
    setEditingNoteId(fav.id)
    setNoteValue(fav.note || '')
  }, [])

  /** 保存备注 */
  const handleSaveNote = useCallback(() => {
    if (editingNoteId) {
      updateFavoriteNote(editingNoteId, noteValue)
      setEditingNoteId(null)
      toast.success('备注已保存')
    }
  }, [editingNoteId, noteValue, updateFavoriteNote])

  /** 更改分类 */
  const handleChangeCategory = useCallback((id: string, category: string) => {
    updateFavoriteCategory(id, category)
    setEditingCategoryId(null)
    toast.success('分类已更新')
  }, [updateFavoriteCategory])

  /** 删除收藏 */
  const handleDelete = useCallback((id: string) => {
    removeFavorite(id)
    toast.success('已取消收藏')
    if (expandedId === id) setExpandedId(null)
  }, [removeFavorite, expandedId])

  if (!open) return null

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 面板 */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-[380px] max-w-[90vw] z-[91]",
          "bg-background border-l border-border shadow-2xl",
          "flex flex-col",
          "animate-in slide-in-from-right duration-300"
        )}
      >
        {/* 头部 */}
        <div className="flex-shrink-0 p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Star size={18} className="text-yellow-500" />
              <h2 className="text-[15px] font-semibold text-foreground">消息收藏</h2>
              {favorites.length > 0 && (
                <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                  {favorites.length}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X size={16} />
            </Button>
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索收藏..."
              className="pl-8 h-8 text-[13px]"
            />
          </div>
        </div>

        {/* 分类 Tabs */}
        <div className="flex-shrink-0 px-4 pt-3 pb-1">
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                  activeCategory === cat.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {cat.label}
                {(categoryCounts[cat.key] || 0) > 0 && (
                  <span className="ml-1 opacity-70">
                    {categoryCounts[cat.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 收藏列表 */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-2">
            {filteredFavorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Star size={40} className="opacity-20 mb-3" />
                <p className="text-[13px]">
                  {search ? '没有匹配的收藏' : '暂无收藏消息'}
                </p>
                {!search && (
                  <p className="text-[11px] mt-1 opacity-60">
                    在消息上点击星标图标即可收藏
                  </p>
                )}
              </div>
            ) : (
              filteredFavorites.map(fav => {
                const isExpanded = expandedId === fav.id
                const isEditingNote = editingNoteId === fav.id
                const isEditingCategory = editingCategoryId === fav.id

                return (
                  <div
                    key={fav.id}
                    className={cn(
                      "rounded-lg border border-border bg-card/80 hover:bg-card transition-colors",
                      isExpanded && "ring-1 ring-primary/30"
                    )}
                  >
                    {/* 收藏项头部 */}
                    <div
                      className="flex items-start gap-2.5 p-3 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : fav.id)}
                    >
                      {/* 角色图标 */}
                      <div className={cn(
                        "flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-0.5",
                        fav.role === 'user'
                          ? "bg-primary/15"
                          : "bg-gradient-to-br from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]"
                      )}>
                        {fav.role === 'user'
                          ? <User size={12} className="text-primary" />
                          : <Bot size={12} className="text-white" />
                        }
                      </div>

                      {/* 内容区 */}
                      <div className="flex-1 min-w-0">
                        {/* 来源会话 + 时间 */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 truncate max-w-[180px]">
                            <MessageSquare size={10} className="flex-shrink-0" />
                            {fav.sessionName}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                            {formatTime(fav.createdAt)}
                          </span>
                        </div>

                        {/* 内容预览 */}
                        <p className="text-[12.5px] text-foreground/90 leading-[1.5] line-clamp-2">
                          {getPreview(fav.content)}
                        </p>

                        {/* 备注标签 */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {fav.category !== 'uncategorized' && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                              {CATEGORIES.find(c => c.key === fav.category)?.label || fav.category}
                            </Badge>
                          )}
                          {fav.note && (
                            <span className="text-[10px] text-primary/70 italic truncate max-w-[200px]">
                              {fav.note}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 展开箭头 */}
                      <div className="flex-shrink-0 mt-1">
                        {isExpanded
                          ? <ChevronDown size={14} className="text-muted-foreground" />
                          : <ChevronRight size={14} className="text-muted-foreground" />
                        }
                      </div>
                    </div>

                    {/* 展开区域：完整内容 + 操作 */}
                    {isExpanded && (
                      <div className="border-t border-border">
                        {/* 完整内容（Markdown 渲染） */}
                        <div className="p-3 max-h-[300px] overflow-y-auto">
                          <div className="prose prose-sm prose-invert max-w-none text-[12.5px] leading-[1.65] break-words">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {fav.content}
                            </ReactMarkdown>
                          </div>
                        </div>

                        {/* 备注编辑 */}
                        {isEditingNote && (
                          <div className="px-3 pb-2">
                            <div className="flex items-center gap-1.5">
                              <Input
                                value={noteValue}
                                onChange={(e) => setNoteValue(e.target.value)}
                                placeholder="输入备注..."
                                className="h-7 text-[12px] flex-1"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveNote()
                                  if (e.key === 'Escape') setEditingNoteId(null)
                                }}
                              />
                              <Button size="icon" variant="ghost" onClick={handleSaveNote} className="h-7 w-7">
                                <Check size={14} className="text-green-500" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setEditingNoteId(null)} className="h-7 w-7">
                                <X size={14} />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* 分类选择 */}
                        {isEditingCategory && (
                          <div className="px-3 pb-2">
                            <div className="flex gap-1 flex-wrap">
                              {CATEGORIES.filter(c => c.key !== 'all').map(cat => (
                                <button
                                  key={cat.key}
                                  onClick={() => handleChangeCategory(fav.id, cat.key)}
                                  className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors",
                                    fav.category === cat.key
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                  )}
                                >
                                  {cat.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-1 px-3 pb-2.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleCopy(fav.content) }}
                            className="h-7 text-[11px] gap-1 px-2"
                          >
                            <Copy size={12} /> 复制
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleStartEditNote(fav) }}
                            className="h-7 text-[11px] gap-1 px-2"
                          >
                            <Pencil size={12} /> 备注
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingCategoryId(isEditingCategory ? null : fav.id)
                            }}
                            className="h-7 text-[11px] gap-1 px-2"
                          >
                            <Tag size={12} /> 分类
                          </Button>
                          <div className="flex-1" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleDelete(fav.id) }}
                            className="h-7 text-[11px] gap-1 px-2 text-destructive hover:text-destructive"
                          >
                            <Trash2 size={12} /> 删除
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  )
}
