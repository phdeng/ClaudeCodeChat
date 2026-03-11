import { useState, useEffect, useCallback } from 'react'
import { BookOpen, X, Search, Plus, Pencil, Trash2, ChevronLeft } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePromptStore, type PromptTemplate } from '../stores/promptStore'

// ==================== 类型定义 ====================

interface PromptLibraryDialogProps {
  open: boolean
  onClose: () => void
  onUse: (content: string) => void
}

// ==================== 分类颜色映射 ====================

const CATEGORY_COLORS: Record<string, string> = {
  '开发': 'bg-blue-500/15 text-blue-400/80',
  '学习': 'bg-green-500/15 text-green-400/80',
  '测试': 'bg-amber-500/15 text-amber-400/80',
  '自定义': 'bg-purple-500/15 text-purple-400/80',
}

function getCategoryClass(category: string): string {
  return CATEGORY_COLORS[category] || 'bg-muted text-muted-foreground'
}

// ==================== 预设分类选项 ====================

const CATEGORY_OPTIONS = ['开发', '学习', '测试', '自定义']

// ==================== 主组件 ====================

export default function PromptLibraryDialog({
  open,
  onClose,
  onUse,
}: PromptLibraryDialogProps) {
  const { prompts, addPrompt, removePrompt, updatePrompt } = usePromptStore()

  const [searchQuery, setSearchQuery] = useState('')
  // 视图模式：列表 / 添加新模板 / 编辑模板
  const [view, setView] = useState<'list' | 'add' | 'edit'>('list')
  // 编辑中的模板 ID
  const [editingId, setEditingId] = useState<string | null>(null)

  // 表单状态
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formCategory, setFormCategory] = useState('自定义')

  // 每次打开时重置状态
  useEffect(() => {
    if (open) {
      setSearchQuery('')
      setView('list')
      setEditingId(null)
      resetForm()
    }
  }, [open])

  // Escape 关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (view !== 'list') {
          setView('list')
          resetForm()
        } else {
          onClose()
        }
      }
    },
    [onClose, view],
  )

  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  // 重置表单
  function resetForm() {
    setFormTitle('')
    setFormContent('')
    setFormCategory('自定义')
  }

  // 过滤模板
  const filteredPrompts = prompts.filter((p) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
  })

  // 使用模板
  const handleUse = (content: string) => {
    onUse(content)
    onClose()
  }

  // 进入编辑模式
  const handleStartEdit = (prompt: PromptTemplate) => {
    setEditingId(prompt.id)
    setFormTitle(prompt.title)
    setFormContent(prompt.content)
    setFormCategory(prompt.category)
    setView('edit')
  }

  // 进入添加模式
  const handleStartAdd = () => {
    resetForm()
    setView('add')
  }

  // 保存添加
  const handleSaveAdd = () => {
    if (!formTitle.trim() || !formContent.trim()) return
    addPrompt({
      title: formTitle.trim(),
      content: formContent.trim(),
      category: formCategory,
    })
    setView('list')
    resetForm()
  }

  // 保存编辑
  const handleSaveEdit = () => {
    if (!editingId || !formTitle.trim() || !formContent.trim()) return
    updatePrompt(editingId, {
      title: formTitle.trim(),
      content: formContent.trim(),
      category: formCategory,
    })
    setView('list')
    setEditingId(null)
    resetForm()
  }

  // 删除模板
  const handleDelete = (id: string) => {
    removePrompt(id)
  }

  // 返回列表
  const handleBack = () => {
    setView('list')
    setEditingId(null)
    resetForm()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <Card className="w-full max-w-lg rounded-2xl flex flex-col gap-0 py-0 overflow-hidden shadow-2xl animate-fade-in">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            {view !== 'list' && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleBack}
                className="text-foreground -ml-1 mr-0.5"
              >
                <ChevronLeft size={16} />
              </Button>
            )}
            <BookOpen size={18} className="text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">
              {view === 'list' && 'Prompt 模板库'}
              {view === 'add' && '添加自定义模板'}
              {view === 'edit' && '编辑模板'}
            </h2>
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

        {/* 内容区域 */}
        <div className="flex flex-col max-h-[65vh]">
          {view === 'list' ? (
            <>
              {/* 搜索框 */}
              <div className="px-5 pt-4 pb-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索模板..."
                    className="w-full rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground placeholder:opacity-50 pl-9 pr-3 py-2 outline-none text-[13px] focus:border-primary transition-colors"
                    autoFocus
                  />
                </div>
              </div>

              {/* 模板列表 */}
              <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
                {filteredPrompts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <BookOpen size={32} className="opacity-20 mb-2" />
                    <p className="text-[13px]">
                      {searchQuery ? '未找到匹配的模板' : '暂无模板'}
                    </p>
                  </div>
                ) : (
                  filteredPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="group relative rounded-lg border border-border bg-background hover:border-primary/40 transition-colors cursor-pointer"
                      onClick={() => handleUse(prompt.content)}
                    >
                      <div className="px-4 py-3">
                        {/* 标题行 */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[13px] font-medium text-foreground truncate">
                            {prompt.title}
                          </span>
                          <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getCategoryClass(prompt.category)}`}>
                            {prompt.category}
                          </span>
                        </div>

                        {/* 内容预览（最多 2 行） */}
                        <p className="text-[12px] text-muted-foreground leading-[1.6] line-clamp-2">
                          {prompt.content}
                        </p>
                      </div>

                      {/* 悬浮操作按钮 */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartEdit(prompt)
                          }}
                          className="text-foreground"
                        >
                          <Pencil size={12} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(prompt.id)
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 底部添加按钮 */}
              <div className="flex items-center justify-center px-5 py-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartAdd}
                  className="text-[12px] gap-1.5"
                >
                  <Plus size={14} />
                  添加自定义模板
                </Button>
              </div>
            </>
          ) : (
            /* 添加 / 编辑表单 */
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* 标题输入 */}
                <div>
                  <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                    模板标题
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="例如：代码审查"
                    className="w-full rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground placeholder:opacity-50 px-3 py-2 outline-none text-[13px] focus:border-primary transition-colors"
                    autoFocus
                  />
                </div>

                {/* 分类选择 */}
                <div>
                  <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                    分类
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_OPTIONS.map((cat) => (
                      <Button
                        key={cat}
                        variant={formCategory === cat ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFormCategory(cat)}
                        className="text-[12px] h-7 px-3"
                      >
                        {cat}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 内容输入 */}
                <div>
                  <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                    模板内容
                  </label>
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="输入 Prompt 模板内容..."
                    rows={6}
                    className="w-full rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground placeholder:opacity-50 resize-none px-3.5 py-3 outline-none text-[13px] leading-[1.7] focus:border-primary transition-colors"
                  />
                </div>
              </div>

              {/* 底部操作按钮 */}
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="text-[12px]"
                >
                  取消
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={view === 'add' ? handleSaveAdd : handleSaveEdit}
                  disabled={!formTitle.trim() || !formContent.trim()}
                  className="text-[12px]"
                >
                  {view === 'add' ? '添加' : '保存'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
