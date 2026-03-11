import { useState, useMemo, useCallback } from 'react'
import { X, Search, Copy, Trash2, Check, Code2, Pencil, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSnippetStore, type CodeSnippet } from '../stores/snippetStore'
import { toast } from 'sonner'

interface CodeSnippetsDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * 代码片段管理弹窗
 * 列出所有保存的代码片段，支持搜索、语言筛选、复制、编辑标题、删除
 */
export default function CodeSnippetsDialog({ open, onClose }: CodeSnippetsDialogProps) {
  const { snippets, deleteSnippet, updateSnippetTitle } = useSnippetStore()
  const [search, setSearch] = useState('')
  const [filterLang, setFilterLang] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  // 所有不重复的语言
  const languages = useMemo(() => {
    const langs = new Set(snippets.map(s => s.language))
    return Array.from(langs).sort()
  }, [snippets])

  // 搜索 + 语言筛选
  const filtered = useMemo(() => {
    return snippets.filter(s => {
      if (filterLang && s.language !== filterLang) return false
      if (search) {
        const q = search.toLowerCase()
        return s.title.toLowerCase().includes(q) ||
               s.code.toLowerCase().includes(q) ||
               s.language.toLowerCase().includes(q)
      }
      return true
    })
  }, [snippets, search, filterLang])

  const handleCopy = useCallback((snippet: CodeSnippet) => {
    navigator.clipboard.writeText(snippet.code).then(() => {
      setCopiedId(snippet.id)
      toast.success('已复制代码片段')
      setTimeout(() => setCopiedId(null), 2000)
    })
  }, [])

  const handleStartEdit = useCallback((snippet: CodeSnippet) => {
    setEditingId(snippet.id)
    setEditTitle(snippet.title)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (editingId && editTitle.trim()) {
      updateSnippetTitle(editingId, editTitle.trim())
      toast.success('标题已更新')
    }
    setEditingId(null)
  }, [editingId, editTitle, updateSnippetTitle])

  const handleDelete = useCallback((id: string) => {
    deleteSnippet(id)
    toast.success('片段已删除')
  }, [deleteSnippet])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-[90vw] max-w-[700px] max-h-[80vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Code2 size={16} className="text-primary" />
            <h2 className="text-sm font-medium">代码片段管理</h2>
            <span className="text-[11px] text-muted-foreground">({snippets.length})</span>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X size={14} />
          </Button>
        </div>

        {/* 搜索 + 筛选栏 */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <div className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50 border border-border">
            <Search size={12} className="text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索片段..."
              className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          {/* 语言筛选 */}
          {languages.length > 1 && (
            <div className="flex items-center gap-1">
              <Filter size={11} className="text-muted-foreground" />
              <select
                value={filterLang || ''}
                onChange={e => setFilterLang(e.target.value || null)}
                className="text-[11px] bg-secondary/50 border border-border rounded px-1.5 py-0.5 outline-none cursor-pointer"
              >
                <option value="">全部语言</option>
                {languages.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 片段列表 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
              <Code2 size={32} className="mb-2" />
              <p className="text-[13px]">
                {snippets.length === 0 ? '还没有保存的代码片段' : '没有匹配的片段'}
              </p>
              <p className="text-[11px] mt-1">
                在代码块上点击「保存片段」按钮来保存
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(snippet => (
                <div key={snippet.id} className="px-4 py-3 hover:bg-accent/30 transition-colors group">
                  {/* 标题行 */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {editingId === snippet.id ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                          autoFocus
                          className="flex-1 text-[12px] font-medium bg-secondary/50 border border-primary/30 rounded px-1.5 py-0.5 outline-none"
                        />
                      ) : (
                        <>
                          <span className="text-[12px] font-medium truncate">{snippet.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                            {snippet.language}
                          </span>
                        </>
                      )}
                    </div>
                    {/* 操作按钮 */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(snippet)}
                        className="p-1 rounded hover:bg-accent text-foreground transition-colors cursor-pointer"
                        title="编辑标题"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => handleCopy(snippet)}
                        className="p-1 rounded hover:bg-accent text-foreground transition-colors cursor-pointer"
                        title="复制代码"
                      >
                        {copiedId === snippet.id ? <Check size={11} className="text-green-400/80" /> : <Copy size={11} />}
                      </button>
                      <button
                        onClick={() => handleDelete(snippet.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                        title="删除片段"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  {/* 代码预览 */}
                  <pre className="text-[11px] font-mono text-muted-foreground bg-secondary/30 rounded px-2 py-1.5 overflow-x-auto max-h-[120px] overflow-y-auto leading-relaxed">
                    {snippet.code.length > 500 ? snippet.code.slice(0, 500) + '\n...' : snippet.code}
                  </pre>
                  {/* 时间 */}
                  <span className="text-[10px] text-muted-foreground/50 mt-1 block">
                    {new Date(snippet.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
