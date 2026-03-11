import { useState, useCallback } from 'react'
import { BookOpen, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { useTranslation } from '../i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface SaveToKnowledgeDialogProps {
  open: boolean
  onClose: () => void
  content: string
  sessionId: string
  sessionTitle: string
  messageTimestamp: number
}

/** 自动提取标题：取内容首行或前 50 字 */
function extractTitle(content: string): string {
  // 去除 Markdown 标题标记
  const lines = content.split('\n').filter((l) => l.trim())
  if (lines.length > 0) {
    const firstLine = lines[0].replace(/^#+\s*/, '').trim()
    if (firstLine.length <= 50) return firstLine
    return firstLine.slice(0, 47) + '...'
  }
  return content.slice(0, 50).replace(/\n/g, ' ')
}

export default function SaveToKnowledgeDialog({
  open,
  onClose,
  content,
  sessionId,
  sessionTitle,
  messageTimestamp,
}: SaveToKnowledgeDialogProps) {
  const { t } = useTranslation()
  const addEntry = useKnowledgeStore((s) => s.addEntry)
  const existingTags = useKnowledgeStore((s) => s.getAllTags)

  const [title, setTitle] = useState(() => extractTitle(content))
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  const allExistingTags = existingTags()

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim()
    if (!tag) return
    // 支持逗号分隔批量添加
    const newTags = tag.split(/[,，]/).map((t) => t.trim()).filter((t) => t && !tags.includes(t))
    if (newTags.length > 0) {
      setTags((prev) => [...prev, ...newTags])
    }
    setTagInput('')
  }, [tagInput, tags])

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleSave = useCallback(() => {
    if (!title.trim()) return
    addEntry({
      title: title.trim(),
      content,
      tags,
      source: {
        sessionId,
        sessionTitle,
        messageTimestamp,
      },
    })
    toast.success(t('knowledge.savedToKnowledge'))
    onClose()
  }, [title, content, tags, sessionId, sessionTitle, messageTimestamp, addEntry, onClose, t])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-[90vw] max-w-[440px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
          <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
            <BookOpen size={16} className="text-primary" />
            {t('knowledge.addEntry')}
          </h3>
          <Button variant="ghost" size="icon-xs" onClick={onClose} className="text-foreground">
            <X size={16} />
          </Button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 标题 */}
          <div>
            <label className="text-[12px] text-muted-foreground mb-1 block">
              {t('knowledge.editTitle')}
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-[13px]"
              autoFocus
            />
          </div>

          {/* 标签 */}
          <div>
            <label className="text-[12px] text-muted-foreground mb-1 block">
              {t('knowledge.manageTags')}
            </label>
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[11px] px-2 py-0 gap-1"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="opacity-50 hover:opacity-100"
                  >
                    <X size={10} />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
                placeholder={t('knowledge.addTag')}
                className="h-7 text-[12px]"
              />
              {tagInput.trim() && (
                <Button variant="ghost" size="icon-xs" onClick={handleAddTag} className="text-primary h-6 w-6">
                  <Plus size={14} />
                </Button>
              )}
            </div>
            {/* 已有标签快速添加 */}
            {allExistingTags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {allExistingTags
                  .filter((t) => !tags.includes(t))
                  .slice(0, 8)
                  .map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setTags((prev) => [...prev, tag])}
                      className="px-2 py-0.5 rounded-full text-[10px] border border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* 内容预览 */}
          <div>
            <label className="text-[12px] text-muted-foreground mb-1 block">
              {t('knowledge.contentPreview')}
            </label>
            <div className="text-[12px] text-foreground/70 bg-muted/50 rounded-lg px-3 py-2 max-h-[120px] overflow-y-auto leading-relaxed">
              {content.length > 300 ? content.slice(0, 300) + '...' : content}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-[12px]">
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!title.trim()}
            className="text-[12px] gap-1.5"
          >
            <BookOpen size={12} />
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
