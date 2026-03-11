import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Brain,
  Plus,
  X,
  Copy,
  Check,
  FileCode2,
  Clock,
  Pencil,
  StickyNote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSessionStore, type Session } from '../stores/sessionStore'
import { toast } from 'sonner'

interface ContextMemoryPanelProps {
  session: Session
}

/**
 * 上下文摘要 — 右侧悬浮按钮 + 弹出面板
 */
export default function ContextMemoryPanel({ session }: ContextMemoryPanelProps) {
  const [open, setOpen] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [copied, setCopied] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  const {
    addContextNote,
    removeContextNote,
    updateContextNote,
    updateSessionTitle,
  } = useSessionStore()

  const notes = session.contextNotes || []

  // 点击面板外部关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // 从消息中提取 @文件引用
  const fileRefs = useMemo(() => {
    const refs = new Set<string>()
    for (const msg of session.messages) {
      const matches = msg.content.matchAll(/@([\w./\\:~-]+(?:\.[\w]+)?)/g)
      for (const match of matches) {
        const ref = match[1]
        if (ref.length > 2 && (ref.includes('.') || ref.includes('/') || ref.includes('\\'))) {
          refs.add(ref)
        }
      }
    }
    return Array.from(refs)
  }, [session.messages])

  // 计算会话持续时间
  const duration = useMemo(() => {
    if (session.messages.length === 0) return null
    const first = session.messages[0].timestamp
    const last = session.messages[session.messages.length - 1].timestamp
    const diffMs = last - first
    if (diffMs < 60000) return '不到 1 分钟'
    const mins = Math.floor(diffMs / 60000)
    const hours = Math.floor(mins / 60)
    const remainMins = mins % 60
    if (hours > 0) {
      return remainMins > 0 ? `${hours} 小时 ${remainMins} 分钟` : `${hours} 小时`
    }
    return `${mins} 分钟`
  }, [session.messages])

  const handleAddNote = useCallback(() => {
    const trimmed = newNote.trim()
    if (!trimmed) return
    addContextNote(session.id, trimmed)
    setNewNote('')
    toast.success('要点已添加')
  }, [newNote, session.id, addContextNote])

  const handleStartEdit = useCallback((index: number) => {
    setEditingIndex(index)
    setEditingText(notes[index])
  }, [notes])

  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null) return
    const trimmed = editingText.trim()
    if (!trimmed) {
      removeContextNote(session.id, editingIndex)
      toast('要点已删除')
    } else {
      updateContextNote(session.id, editingIndex, trimmed)
      toast.success('要点已更新')
    }
    setEditingIndex(null)
    setEditingText('')
  }, [editingIndex, editingText, session.id, removeContextNote, updateContextNote])

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null)
    setEditingText('')
  }, [])

  const handleStartEditTitle = useCallback(() => {
    setEditingTitle(true)
    setTitleDraft(session.title)
  }, [session.title])

  const handleSaveTitle = useCallback(() => {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== session.title) {
      updateSessionTitle(session.id, trimmed)
      toast.success('主题已更新')
    }
    setEditingTitle(false)
    setTitleDraft('')
  }, [titleDraft, session.id, session.title, updateSessionTitle])

  const handleCopyContext = useCallback(async () => {
    const lines: string[] = []
    lines.push(`## 会话主题`)
    lines.push(session.title)
    lines.push('')
    if (notes.length > 0) {
      lines.push(`## 关键要点`)
      notes.forEach((note, i) => lines.push(`${i + 1}. ${note}`))
      lines.push('')
    }
    if (fileRefs.length > 0) {
      lines.push(`## 文件引用`)
      fileRefs.forEach((ref) => lines.push(`- ${ref}`))
      lines.push('')
    }
    if (duration) {
      lines.push(`## 会话时长`)
      lines.push(duration)
      lines.push('')
    }
    lines.push(`## 消息统计`)
    const userCount = session.messages.filter(m => m.role === 'user').length
    const assistantCount = session.messages.filter(m => m.role === 'assistant').length
    lines.push(`用户消息: ${userCount} 条 | 助手回复: ${assistantCount} 条`)
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      toast.success('上下文摘要已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败')
    }
  }, [session, notes, fileRefs, duration])

  // 统计摘要
  const badgeCount = notes.length + fileRefs.length

  return (
    <div ref={panelRef} className="absolute right-3 top-14 z-30">
      {/* 悬浮触发按钮 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="w-8 h-8 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-accent transition-colors group"
          title="上下文摘要"
        >
          <Brain size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          {badgeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-medium">
              {badgeCount}
            </span>
          )}
        </button>
      )}

      {/* 弹出面板 */}
      {open && (
        <div className="w-[280px] rounded-lg border border-border bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-right-2 duration-150">
          {/* 面板头 */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Brain size={14} className="text-primary" />
              <span className="text-[12px] font-medium text-foreground">上下文摘要</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopyContext}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="复制摘要"
              >
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* 面板内容 */}
          <div className="max-h-[400px] overflow-y-auto p-3 space-y-3">
            {/* 会话主题 */}
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <StickyNote size={11} className="text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">主题</span>
              </div>
              {editingTitle ? (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle()
                      if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft('') }
                    }}
                    className="flex-1 text-[12px] px-2 py-1 rounded border border-border bg-background text-foreground outline-none focus:border-primary"
                    autoFocus
                  />
                  <Button variant="ghost" size="icon-xs" onClick={handleSaveTitle} className="text-primary hover:text-primary">
                    <Check size={11} />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => { setEditingTitle(false); setTitleDraft('') }} className="text-foreground">
                    <X size={11} />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 group">
                  <span className="text-[12px] text-foreground leading-snug">{session.title}</span>
                  <button
                    onClick={handleStartEditTitle}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent text-muted-foreground transition-all"
                  >
                    <Pencil size={10} />
                  </button>
                </div>
              )}
            </div>

            {/* 关键要点 */}
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Brain size={11} className="text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">要点</span>
                <span className="text-[10px] text-muted-foreground">({notes.length})</span>
              </div>

              {notes.length > 0 && (
                <ul className="space-y-1 mb-2">
                  {notes.map((note, index) => (
                    <li key={index} className="group flex items-start gap-1.5">
                      {editingIndex === index ? (
                        <div className="flex-1 flex gap-1">
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit()
                              if (e.key === 'Escape') handleCancelEdit()
                            }}
                            className="flex-1 text-[11px] px-1.5 py-0.5 rounded border border-border bg-background text-foreground outline-none focus:border-primary"
                            autoFocus
                          />
                          <Button variant="ghost" size="icon-xs" onClick={handleSaveEdit} className="text-primary flex-shrink-0">
                            <Check size={10} />
                          </Button>
                          <Button variant="ghost" size="icon-xs" onClick={handleCancelEdit} className="text-foreground flex-shrink-0">
                            <X size={10} />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-[10px] text-muted-foreground mt-0.5 flex-shrink-0">{index + 1}.</span>
                          <span className="text-[11px] text-foreground flex-1 break-words leading-relaxed">{note}</span>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button onClick={() => handleStartEdit(index)} className="p-0.5 rounded hover:bg-accent text-muted-foreground">
                              <Pencil size={9} />
                            </button>
                            <button
                              onClick={() => { removeContextNote(session.id, index); toast('要点已删除') }}
                              className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            >
                              <X size={9} />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-1">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote() }}
                  placeholder="添加要点..."
                  className="flex-1 text-[11px] px-2 py-1 rounded border border-border/60 bg-background/50 text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                />
                <Button variant="ghost" size="icon-xs" onClick={handleAddNote} disabled={!newNote.trim()} className="text-primary disabled:opacity-30">
                  <Plus size={12} />
                </Button>
              </div>
            </div>

            {/* 文件引用 */}
            {fileRefs.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <FileCode2 size={11} className="text-muted-foreground" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">文件引用</span>
                  <span className="text-[10px] text-muted-foreground">({fileRefs.length})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {fileRefs.map((ref, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-accent/50 text-foreground border border-border/40 font-mono">
                      <FileCode2 size={9} className="text-muted-foreground flex-shrink-0" />
                      <span className="truncate max-w-[180px]">{ref}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 会话时长 + 统计 */}
            <div className="space-y-1 pt-2 border-t border-border/30">
              {duration && (
                <div className="flex items-center gap-1.5">
                  <Clock size={11} className="text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">时长:</span>
                  <span className="text-[10px] text-foreground">{duration}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>用户: {session.messages.filter(m => m.role === 'user').length}</span>
                <span>助手: {session.messages.filter(m => m.role === 'assistant').length}</span>
                <span>字数: {session.messages.reduce((sum, m) => sum + m.content.length, 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
