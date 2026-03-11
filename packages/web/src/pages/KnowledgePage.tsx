import { useState, useMemo, useCallback } from 'react'
import { BookOpen, Search, Trash2, Tag, ChevronLeft, ExternalLink, X, Plus, Pencil, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { toast } from 'sonner'
import { useKnowledgeStore, type KnowledgeEntry } from '../stores/knowledgeStore'
import { useTranslation } from '../i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

/** 格式化时间戳 */
function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `今天 ${time}`
  if (isYesterday) return `昨天 ${time}`
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`
}

/** 截取内容预览 */
function getPreview(content: string, maxLen = 100): string {
  // 去除 Markdown 标记
  const plain = content
    .replace(/```[\s\S]*?```/g, '[代码块]')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^#+\s/gm, '')
    .replace(/!\[.*?\]\(.*?\)/g, '[图片]')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
  return plain.length > maxLen ? plain.slice(0, maxLen) + '...' : plain
}

export default function KnowledgePage() {
  const { t } = useTranslation()
  const entries = useKnowledgeStore((s) => s.entries)
  const removeEntry = useKnowledgeStore((s) => s.removeEntry)
  const updateEntry = useKnowledgeStore((s) => s.updateEntry)
  const searchEntries = useKnowledgeStore((s) => s.searchEntries)
  const getAllTags = useKnowledgeStore((s) => s.getAllTags)
  const getByTag = useKnowledgeStore((s) => s.getByTag)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitleValue, setEditTitleValue] = useState('')
  const [newTagInput, setNewTagInput] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // 获取所有标签及其计数
  const allTags = useMemo(() => getAllTags(), [entries]) // eslint-disable-line react-hooks/exhaustive-deps
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of entries) {
      for (const tag of e.tags) {
        counts[tag] = (counts[tag] || 0) + 1
      }
    }
    return counts
  }, [entries])

  // 过滤条目
  const filteredEntries = useMemo(() => {
    let result: KnowledgeEntry[]
    if (searchQuery.trim()) {
      result = searchEntries(searchQuery)
    } else if (selectedTag) {
      result = getByTag(selectedTag)
    } else {
      result = entries
    }
    return result
  }, [entries, searchQuery, selectedTag, searchEntries, getByTag])

  // 当前选中的条目详情
  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedEntryId) || null,
    [entries, selectedEntryId]
  )

  const handleSelectEntry = useCallback((entry: KnowledgeEntry) => {
    setSelectedEntryId(entry.id)
    setEditingTitle(false)
    setNewTagInput('')
  }, [])

  const handleDeleteEntry = useCallback((id: string) => {
    removeEntry(id)
    if (selectedEntryId === id) {
      setSelectedEntryId(null)
    }
    setConfirmDeleteId(null)
    toast.success(t('knowledge.entryDeleted'))
  }, [removeEntry, selectedEntryId, t])

  const handleStartEditTitle = useCallback(() => {
    if (selectedEntry) {
      setEditTitleValue(selectedEntry.title)
      setEditingTitle(true)
    }
  }, [selectedEntry])

  const handleSaveTitle = useCallback(() => {
    if (selectedEntry && editTitleValue.trim()) {
      updateEntry(selectedEntry.id, { title: editTitleValue.trim() })
      setEditingTitle(false)
    }
  }, [selectedEntry, editTitleValue, updateEntry])

  const handleAddTag = useCallback(() => {
    if (!selectedEntry || !newTagInput.trim()) return
    const newTag = newTagInput.trim()
    if (!selectedEntry.tags.includes(newTag)) {
      updateEntry(selectedEntry.id, { tags: [...selectedEntry.tags, newTag] })
    }
    setNewTagInput('')
  }, [selectedEntry, newTagInput, updateEntry])

  const handleRemoveTag = useCallback((tag: string) => {
    if (!selectedEntry) return
    updateEntry(selectedEntry.id, { tags: selectedEntry.tags.filter((t) => t !== tag) })
  }, [selectedEntry, updateEntry])

  const handleTagInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }, [handleAddTag])

  return (
    <div className="flex h-full overflow-hidden">
      {/* ===== 左侧标签栏 ===== */}
      <div className="w-[180px] flex-shrink-0 border-r border-border bg-card/50 flex flex-col max-md:hidden">
        <div className="px-3 pt-4 pb-2">
          <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
            <Tag size={14} className="text-primary" />
            {t('knowledge.tags')}
          </h3>
        </div>
        <ScrollArea className="flex-1 px-2">
          <button
            onClick={() => { setSelectedTag(null); setSearchQuery('') }}
            className={cn(
              'w-full flex items-center justify-between px-3 py-1.5 rounded-md text-[12px] transition-colors mb-0.5',
              selectedTag === null && !searchQuery
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-foreground hover:bg-accent/50'
            )}
          >
            <span>{t('knowledge.allEntries')}</span>
            <span className="text-[11px] text-muted-foreground">{entries.length}</span>
          </button>

          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => { setSelectedTag(tag); setSearchQuery('') }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-1.5 rounded-md text-[12px] transition-colors mb-0.5',
                selectedTag === tag
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground hover:bg-accent/50'
              )}
            >
              <span className="truncate mr-1">{tag}</span>
              <span className="text-[11px] text-muted-foreground flex-shrink-0">
                {tagCounts[tag] || 0}
              </span>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* ===== 右侧主区域 ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部标题 + 搜索 */}
        <div className="flex-shrink-0 px-4 md:px-6 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-semibold text-foreground flex items-center gap-2">
              <BookOpen size={18} className="text-primary" />
              {t('knowledge.title')}
            </h2>
            <span className="text-[12px] text-muted-foreground">
              {filteredEntries.length} {t('knowledge.entries')}
            </span>
          </div>

          {/* 移动端标签筛选 */}
          <div className="flex gap-1.5 flex-wrap md:hidden mb-2">
            <button
              onClick={() => { setSelectedTag(null); setSearchQuery('') }}
              className={cn(
                'px-2 py-0.5 rounded-full text-[11px] transition-colors border',
                selectedTag === null && !searchQuery
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'text-muted-foreground border-border hover:bg-accent/50'
              )}
            >
              {t('knowledge.allEntries')}
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => { setSelectedTag(tag); setSearchQuery('') }}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] transition-colors border',
                  selectedTag === tag
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'text-muted-foreground border-border hover:bg-accent/50'
                )}
              >
                {tag} ({tagCounts[tag] || 0})
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelectedTag(null) }}
              placeholder={t('knowledge.search')}
              className="pl-9 h-8 text-[13px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 条目列表 + 详情 */}
        <div className="flex-1 flex min-h-0">
          {/* 条目列表 */}
          <ScrollArea className={cn(
            'flex-1 min-w-0',
            selectedEntry && 'max-md:hidden'
          )}>
            <div className="p-3 md:p-4 space-y-2">
              {filteredEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <BookOpen size={40} className="mb-3 opacity-30" />
                  <p className="text-[14px] font-medium mb-1">{t('knowledge.noEntries')}</p>
                  <p className="text-[12px] text-center max-w-[280px]">{t('knowledge.noEntriesHint')}</p>
                </div>
              ) : (
                filteredEntries.map((entry) => (
                  <Card
                    key={entry.id}
                    className={cn(
                      'cursor-pointer transition-all duration-150 hover:shadow-md',
                      selectedEntryId === entry.id
                        ? 'ring-1 ring-primary/40 bg-primary/5'
                        : 'hover:bg-accent/30'
                    )}
                    onClick={() => handleSelectEntry(entry)}
                  >
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h4 className="text-[13px] font-medium text-foreground line-clamp-1">
                          {entry.title}
                        </h4>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5">
                          {formatDate(entry.createdAt)}
                        </span>
                      </div>
                      <p className="text-[12px] text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                        {getPreview(entry.content)}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-1 flex-wrap min-w-0">
                          {entry.tags.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {tag}
                            </Badge>
                          ))}
                          {entry.tags.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{entry.tags.length - 3}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 truncate max-w-[120px]">
                          {t('knowledge.source')}: {entry.source.sessionTitle}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>

          {/* 条目详情 */}
          {selectedEntry && (
            <div className={cn(
              'border-l border-border flex flex-col bg-card/30',
              'max-md:absolute max-md:inset-0 max-md:z-10 max-md:border-l-0 max-md:bg-background',
              'md:w-[420px] lg:w-[480px]'
            )}>
              {/* 详情头部 */}
              <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setSelectedEntryId(null)}
                    className="text-foreground md:hidden"
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleStartEditTitle}
                      className="text-foreground h-6 w-6"
                      title={t('knowledge.editTitle')}
                    >
                      <Pencil size={12} />
                    </Button>
                    {confirmDeleteId === selectedEntry.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => handleDeleteEntry(selectedEntry.id)}
                          className="text-[11px] h-6"
                        >
                          {t('common.confirm')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[11px] h-6"
                        >
                          {t('common.cancel')}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setConfirmDeleteId(selectedEntry.id)}
                        className="text-destructive hover:text-destructive h-6 w-6"
                        title={t('common.delete')}
                      >
                        <Trash2 size={12} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setSelectedEntryId(null)}
                      className="text-foreground h-6 w-6 max-md:hidden"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </div>

                {/* 标题 */}
                {editingTitle ? (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Input
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle()
                        if (e.key === 'Escape') setEditingTitle(false)
                      }}
                      className="h-7 text-[13px]"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleSaveTitle}
                      className="text-primary h-6 w-6"
                    >
                      <Check size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setEditingTitle(false)}
                      className="text-foreground h-6 w-6"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <h3 className="text-[14px] font-semibold text-foreground mb-2 leading-tight">
                    {selectedEntry.title}
                  </h3>
                )}

                {/* 标签管理 */}
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                  {selectedEntry.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-[11px] px-2 py-0 gap-1 cursor-default group/tag"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="opacity-50 hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </Badge>
                  ))}
                  <div className="flex items-center gap-1">
                    <Input
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      placeholder={t('knowledge.addTag')}
                      className="h-6 w-[100px] text-[11px] px-2"
                    />
                    {newTagInput.trim() && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={handleAddTag}
                        className="text-primary h-5 w-5"
                      >
                        <Plus size={12} />
                      </Button>
                    )}
                  </div>
                </div>

                {/* 来源信息 */}
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ExternalLink size={10} />
                  <span>{t('knowledge.source')}: {selectedEntry.source.sessionTitle}</span>
                  <span className="mx-1">|</span>
                  <span>{formatDate(selectedEntry.createdAt)}</span>
                </div>
              </div>

              {/* 详情内容 */}
              <ScrollArea className="flex-1">
                <div className="px-4 py-3">
                  <div className="text-[13.5px] text-foreground break-words leading-[1.7] markdown-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {selectedEntry.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
