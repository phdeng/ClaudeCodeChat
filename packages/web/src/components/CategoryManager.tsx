import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, X, Plus, MessageSquare, Trash2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCategoryStore } from '../stores/categoryStore'
import { useSessionStore } from '../stores/sessionStore'

interface CategoryManagerProps {
  open: boolean
  onClose: () => void
}

// 可选颜色列表
const COLORS = [
  'bg-red-400/90',
  'bg-orange-400/90',
  'bg-yellow-400/90',
  'bg-green-400/90',
  'bg-blue-400/90',
  'bg-purple-400/90',
  'bg-pink-400/90',
  'bg-cyan-400/90',
]

/** 将 bg 类名映射为文本颜色类名（用于匹配的颜色高亮） */
function colorToBorderClass(color: string): string {
  return color.replace('bg-', 'border-').replace('-500', '-500/40')
}

export default function CategoryManager({ open, onClose }: CategoryManagerProps) {
  const navigate = useNavigate()
  const { categories, addCategory, removeCategory } = useCategoryStore()
  const sessions = useSessionStore((s) => s.sessions)

  // 当前选中的分类 ID
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null)
  // 新建分类表单
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  // 删除确认
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // 按 order 排序的分类列表
  const sortedCategories = useMemo(() =>
    [...categories].sort((a, b) => a.order - b.order),
    [categories]
  )

  // 为每个分类计算会话数量（分类名匹配会话 tags）
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const cat of categories) {
      counts[cat.id] = sessions.filter(
        (s) => s.tags?.includes(cat.name)
      ).length
    }
    return counts
  }, [categories, sessions])

  // 选中分类下的会话列表
  const filteredSessions = useMemo(() => {
    if (!selectedCatId) return []
    const cat = categories.find((c) => c.id === selectedCatId)
    if (!cat) return []
    return sessions.filter((s) => s.tags?.includes(cat.name))
  }, [selectedCatId, categories, sessions])

  // 打开时默认选中第一个分类
  useEffect(() => {
    if (open && sortedCategories.length > 0 && !selectedCatId) {
      setSelectedCatId(sortedCategories[0].id)
    }
  }, [open, sortedCategories, selectedCatId])

  // 打开时重置状态
  useEffect(() => {
    if (open) {
      setNewName('')
      setNewColor(COLORS[0])
      setConfirmDeleteId(null)
    } else {
      setSelectedCatId(null)
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

  // 添加新分类
  const handleAddCategory = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    // 避免重名
    if (categories.some((c) => c.name === trimmed)) return
    addCategory(trimmed, newColor)
    setNewName('')
    setNewColor(COLORS[0])
    nameInputRef.current?.focus()
  }

  // 删除分类
  const handleDeleteCategory = (id: string) => {
    removeCategory(id)
    setConfirmDeleteId(null)
    // 如果删除的是当前选中的分类，切换到第一个
    if (selectedCatId === id) {
      const remaining = sortedCategories.filter((c) => c.id !== id)
      setSelectedCatId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  // 点击会话跳转
  const handleGoToSession = (sessionId: string) => {
    onClose()
    requestAnimationFrame(() => {
      navigate(`/chat/${sessionId}`)
    })
  }

  const selectedCat = categories.find((c) => c.id === selectedCatId)

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* 居中偏上的面板 */}
      <div className="fixed left-1/2 top-[10%] -translate-x-1/2 w-full max-w-2xl animate-fade-in">
        <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <FolderOpen size={18} className="text-primary" />
              <h2 className="text-[14px] font-semibold text-foreground">分类管理器</h2>
              <span className="text-[11px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded-full">
                {categories.length} 个分类
              </span>
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

          {/* 主体：左右分栏 */}
          <div className="flex min-h-[360px] max-h-[60vh]">
            {/* 左侧：分类列表 */}
            <div className="w-[200px] border-r border-border flex flex-col">
              <ScrollArea className="flex-1">
                <div className="py-1.5">
                  {sortedCategories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <FolderOpen size={24} className="text-muted-foreground/30" />
                      <span className="text-[12px] text-muted-foreground">暂无分类</span>
                    </div>
                  ) : (
                    sortedCategories.map((cat) => (
                      <div key={cat.id} className="group relative">
                        {confirmDeleteId === cat.id ? (
                          /* 删除确认模式 */
                          <div className="flex items-center gap-1 px-2.5 py-2 mx-1.5 mb-0.5 rounded-lg bg-destructive/5">
                            <span className="text-[11px] text-destructive truncate flex-1">
                              删除？
                            </span>
                            <Button
                              variant="destructive"
                              size="xs"
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="text-[11px] h-5 px-1.5"
                            >
                              确定
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-foreground text-[11px] h-5 px-1.5"
                            >
                              取消
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedCatId(cat.id)}
                            className={cn(
                              'w-full text-left flex items-center gap-2 px-2.5 py-2 mx-1.5 mb-0.5 rounded-lg text-[13px] transition-colors duration-150',
                              selectedCatId === cat.id
                                ? 'bg-accent text-foreground'
                                : 'text-foreground hover:bg-accent/50'
                            )}
                          >
                            {/* 颜色圆点 */}
                            <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', cat.color)} />
                            {/* 分类名 */}
                            <span className="truncate flex-1">{cat.name}</span>
                            {/* 会话数量 */}
                            <span className="text-[10px] text-muted-foreground/60 tabular-nums flex-shrink-0">
                              {categoryCounts[cat.id] || 0}
                            </span>
                            {/* 删除按钮（hover 显示） */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setConfirmDeleteId(cat.id)
                              }}
                              className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all duration-150 flex-shrink-0"
                            >
                              <Trash2 size={11} />
                            </button>
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* 底部：添加新分类 */}
              <div className="border-t border-border p-2.5 space-y-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  placeholder="新分类名称..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCategory()
                  }}
                  className="w-full bg-accent text-[12px] text-foreground placeholder:text-muted-foreground/50 border border-transparent focus:border-ring rounded px-2 py-1.5 outline-none"
                />
                {/* 颜色选择器 */}
                <div className="flex items-center gap-1 flex-wrap">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewColor(color)}
                      className={cn(
                        'w-5 h-5 rounded-full border-2 transition-all duration-150',
                        color,
                        newColor === color
                          ? `${colorToBorderClass(color)} scale-110 ring-1 ring-offset-1 ring-offset-card ring-white/30`
                          : 'border-transparent opacity-60 hover:opacity-100'
                      )}
                      title={color.replace('bg-', '').replace('-500', '')}
                    />
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddCategory}
                  disabled={!newName.trim() || categories.some((c) => c.name === newName.trim())}
                  className="w-full text-[12px] border-dashed"
                >
                  <Plus size={12} />
                  添加分类
                </Button>
              </div>
            </div>

            {/* 右侧：选中分类下的会话列表 */}
            <div className="flex-1 flex flex-col min-w-0">
              {selectedCat ? (
                <>
                  {/* 分类标题 */}
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                    <span className={cn('w-3 h-3 rounded-full', selectedCat.color)} />
                    <span className="text-[13px] font-medium text-foreground">{selectedCat.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {filteredSessions.length} 个会话
                    </span>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="py-1.5">
                      {filteredSessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                          <MessageSquare size={28} className="text-muted-foreground/25" />
                          <span className="text-[12px] text-muted-foreground">
                            该分类下暂无会话
                          </span>
                          <span className="text-[11px] text-muted-foreground/60">
                            在侧边栏为会话添加「{selectedCat.name}」标签即可归入此分类
                          </span>
                        </div>
                      ) : (
                        filteredSessions.map((session) => (
                          <button
                            key={session.id}
                            onClick={() => handleGoToSession(session.id)}
                            className="w-full text-left flex items-start gap-2.5 px-4 py-2.5 hover:bg-accent/50 transition-colors duration-150"
                          >
                            <MessageSquare size={14} className="text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="text-[13px] text-foreground truncate block">
                                {session.title}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-muted-foreground/60">
                                  {new Date(session.createdAt).toLocaleDateString('zh-CN', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                                <span className="text-[11px] text-muted-foreground/40">
                                  {session.messages.length} 条消息
                                </span>
                                {/* 显示其他标签 */}
                                {session.tags && session.tags.filter((t) => t !== selectedCat.name).length > 0 && (
                                  <div className="flex gap-1">
                                    {session.tags.filter((t) => t !== selectedCat.name).map((tag) => (
                                      <span
                                        key={tag}
                                        className="text-[10px] text-muted-foreground/50 bg-accent px-1 py-0 rounded"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 gap-3">
                  <FolderOpen size={32} className="text-muted-foreground/25" />
                  <span className="text-[13px] text-muted-foreground">
                    选择一个分类查看会话
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 底部快捷键提示 */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-border">
            <span className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">Esc</kbd>{' '}关闭
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              分类基于会话标签进行归类
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
