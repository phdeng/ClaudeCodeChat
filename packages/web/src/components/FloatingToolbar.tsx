import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Brain,
  Keyboard,
  CheckSquare,
  Camera,
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
import { useSettingsStore } from '../stores/settingsStore'
import { exportChatAsImage } from '../utils/exportImage'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const KEYBOARD_HINT_ID = 'keyboard-shortcuts-float'

const SHORTCUT_ITEMS = [
  { keys: ['Ctrl', 'K'], description: '命令面板' },
  { keys: ['Ctrl', 'F'], description: '搜索消息' },
  { keys: ['Ctrl', 'Shift', 'S'], description: '代码片段' },
  { keys: ['Ctrl', 'Shift', 'Z'], description: '焦点模式' },
  { keys: ['Ctrl', 'N'], description: '新建会话' },
  { keys: ['/'], description: '斜杠命令' },
  { keys: ['Esc'], description: '关闭弹窗' },
]

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded text-[10px] font-medium bg-accent border border-border text-foreground shadow-[0_1px_0_0.5px_rgba(0,0,0,0.2)] font-mono leading-none">
      {children}
    </kbd>
  )
}

type PanelType = 'context' | 'keyboard' | null

interface FloatingToolbarProps {
  session: Session | null
  selectMode?: boolean
  onSelectModeChange?: (mode: boolean) => void
}

export default function FloatingToolbar({ session, selectMode, onSelectModeChange }: FloatingToolbarProps) {
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Context memory state
  const [newNote, setNewNote] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [copied, setCopied] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const {
    addContextNote,
    removeContextNote,
    updateContextNote,
    updateSessionTitle,
  } = useSessionStore()

  const dismissedHints = useSettingsStore((s) => s.dismissedHints)
  const dismissHint = useSettingsStore((s) => s.dismissHint)
  const isKeyboardDismissed = dismissedHints.includes(KEYBOARD_HINT_ID)

  const notes = session?.contextNotes || []

  // 点击外部关闭
  useEffect(() => {
    if (!activePanel) return
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActivePanel(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activePanel])

  // Esc 关闭
  useEffect(() => {
    if (!activePanel) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setActivePanel(null)
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [activePanel])

  const togglePanel = (panel: PanelType) => {
    setActivePanel((prev) => (prev === panel ? null : panel))
  }

  // --- Context memory logic ---
  const fileRefs = useMemo(() => {
    if (!session) return []
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
  }, [session?.messages])

  const duration = useMemo(() => {
    if (!session || session.messages.length === 0) return null
    const first = session.messages[0].timestamp
    const last = session.messages[session.messages.length - 1].timestamp
    const diffMs = last - first
    if (diffMs < 60000) return '不到 1 分钟'
    const mins = Math.floor(diffMs / 60000)
    const hours = Math.floor(mins / 60)
    const remainMins = mins % 60
    if (hours > 0) return remainMins > 0 ? `${hours} 小时 ${remainMins} 分钟` : `${hours} 小时`
    return `${mins} 分钟`
  }, [session?.messages])

  const handleAddNote = useCallback(() => {
    if (!session) return
    const trimmed = newNote.trim()
    if (!trimmed) return
    addContextNote(session.id, trimmed)
    setNewNote('')
    toast.success('要点已添加')
  }, [newNote, session?.id, addContextNote])

  const handleStartEdit = useCallback((index: number) => {
    setEditingIndex(index)
    setEditingText(notes[index])
  }, [notes])

  const handleSaveEdit = useCallback(() => {
    if (!session || editingIndex === null) return
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
  }, [editingIndex, editingText, session?.id, removeContextNote, updateContextNote])

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null)
    setEditingText('')
  }, [])

  const handleStartEditTitle = useCallback(() => {
    if (!session) return
    setEditingTitle(true)
    setTitleDraft(session.title)
  }, [session?.title])

  const handleSaveTitle = useCallback(() => {
    if (!session) return
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== session.title) {
      updateSessionTitle(session.id, trimmed)
      toast.success('主题已更新')
    }
    setEditingTitle(false)
    setTitleDraft('')
  }, [titleDraft, session?.id, session?.title, updateSessionTitle])

  const handleCopyContext = useCallback(async () => {
    if (!session) return
    const lines: string[] = []
    lines.push(`## 会话主题`, session.title, '')
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
    if (duration) lines.push(`## 会话时长`, duration, '')
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

  const badgeCount = notes.length + fileRefs.length
  const hasSession = session && session.messages.length > 0
  const showKeyboard = !isKeyboardDismissed

  // 没有任何按钮可显示时隐藏
  if (!hasSession && !showKeyboard) return null

  return (
    <div ref={toolbarRef} className="hidden md:flex absolute right-3 top-16 z-30 flex-col items-end gap-2">
      {/* 按钮组 */}
      <div className="flex flex-col rounded-full bg-card border border-border shadow-sm overflow-hidden">
        {/* 上下文摘要按钮 */}
        {hasSession && (
          <button
            onClick={() => togglePanel('context')}
            className={cn(
              'relative w-8 h-8 flex items-center justify-center transition-colors',
              activePanel === 'context' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
            title="上下文摘要"
          >
            <Brain size={14} />
            {badgeCount > 0 && activePanel !== 'context' && (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-[8px] text-primary-foreground flex items-center justify-center font-medium leading-none">
                {badgeCount}
              </span>
            )}
          </button>
        )}

        {/* 多选消息按钮 */}
        {hasSession && (
          <>
            <div className="h-px bg-border" />
            <button
              onClick={() => onSelectModeChange?.(!selectMode)}
              className={cn(
                'w-8 h-8 flex items-center justify-center transition-colors',
                selectMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
              title={selectMode ? '退出多选' : '多选消息'}
            >
              <CheckSquare size={14} />
            </button>
          </>
        )}

        {/* 导出长图按钮 */}
        {hasSession && (
          <>
            <div className="h-px bg-border" />
            <button
              onClick={() => {
                if (session && session.messages.length > 0) {
                  exportChatAsImage(session.title, session.messages)
                  toast.success('正在生成图片...')
                } else {
                  toast('没有可导出的消息')
                }
              }}
              className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              title="导出对话长图"
            >
              <Camera size={14} />
            </button>
          </>
        )}

        {/* 快捷键按钮 */}
        {showKeyboard && (
          <>
            <div className="h-px bg-border" />
          </>
        )}
        {showKeyboard && (
          <button
            onClick={() => togglePanel('keyboard')}
            className={cn(
              'w-8 h-8 flex items-center justify-center transition-colors',
              activePanel === 'keyboard' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
            title="快捷键速查"
          >
            <Keyboard size={14} />
          </button>
        )}
      </div>

      {/* === 上下文摘要面板 === */}
      {activePanel === 'context' && hasSession && (
        <div className="w-[280px] rounded-lg border border-border bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-right-2 duration-150">
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
                onClick={() => setActivePanel(null)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>

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
                  <span className="text-[12px] text-foreground leading-snug">{session!.title}</span>
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
                              onClick={() => { removeContextNote(session!.id, index); toast('要点已删除') }}
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

            {/* 时长 + 统计 */}
            <div className="space-y-1 pt-2 border-t border-border/30">
              {duration && (
                <div className="flex items-center gap-1.5">
                  <Clock size={11} className="text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">时长:</span>
                  <span className="text-[10px] text-foreground">{duration}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>用户: {session!.messages.filter(m => m.role === 'user').length}</span>
                <span>助手: {session!.messages.filter(m => m.role === 'assistant').length}</span>
                <span>字数: {session!.messages.reduce((sum, m) => sum + m.content.length, 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === 快捷键面板 === */}
      {activePanel === 'keyboard' && (
        <div className="w-[260px] rounded-lg border border-border bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-right-2 duration-150">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Keyboard size={14} className="text-primary" />
              <span className="text-[12px] font-semibold text-foreground">快捷键速查</span>
            </div>
            <button
              onClick={() => setActivePanel(null)}
              className="p-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X size={12} />
            </button>
          </div>
          <div className="px-3.5 py-2 space-y-1">
            {SHORTCUT_ITEMS.map((item, index) => (
              <div key={index} className="flex items-center justify-between py-1">
                <span className="text-[12px] text-muted-foreground">{item.description}</span>
                <div className="flex items-center gap-0.5 ml-3 flex-shrink-0">
                  {item.keys.map((key, i) => (
                    <span key={i} className="flex items-center gap-0.5">
                      {i > 0 && <span className="text-[9px] text-muted-foreground opacity-40">+</span>}
                      <Kbd>{key}</Kbd>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-3.5 py-2 border-t border-border">
            <button
              onClick={(e) => { e.stopPropagation(); dismissHint(KEYBOARD_HINT_ID); setActivePanel(null) }}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              不再显示
            </button>
            <span className="text-[10px] text-muted-foreground">
              按 <Kbd>?</Kbd> 查看全部
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
