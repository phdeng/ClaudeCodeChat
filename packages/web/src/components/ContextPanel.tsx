/**
 * 上下文管理面板
 * 匹配 Claude Code CLI 的 /context 命令输出：
 * - 彩色方块网格可视化上下文占用
 * - 按类别分解 Token 占用（System prompt/tools/Memory/Skills/Messages/Free/Autocompact）
 * - MCP 工具列表
 * - Skills 列表
 * - 文件/目录/URL 管理
 */
import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Eye,
  File,
  Folder,
  Link,
  X,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  FolderOpen,
  ArrowUp,
  ChevronRight,
  ChevronDown,
  Server,
  Puzzle,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useContextStore, type ContextItem } from '@/stores/contextStore'
import { useSessionStore } from '@/stores/sessionStore'

/* ======================== 类型定义 ======================== */

interface BrowseEntry {
  name: string
  path: string
  isDirectory: boolean
  isGitRepo?: boolean
  size?: number
}

interface BrowseResult {
  current: string
  parent: string | null
  directories: Array<{ name: string; path: string; isGitRepo: boolean }>
  files?: Array<{ name: string; path: string; size?: number }>
}

interface ContextPanelProps {
  sessionId: string
  workingDirectory?: string
  open: boolean
  onClose: () => void
  onSendContext?: () => void
}

/** 上下文类别定义 — 匹配 CLI /context 输出 */
interface ContextCategory {
  key: string
  label: string
  tokens: number
  color: string       // Tailwind bg 色
  gridColor: string   // 网格方块色
  emoji: string       // 类别色块标记
}

/* ======================== 常量 ======================== */

const MAX_TOKENS = 200000

/** 模型名称 → 最大 token */
const MODEL_MAX_TOKENS: Record<string, number> = {
  'claude-opus-4-6': 200000,
  'claude-sonnet-4-6': 200000,
  'claude-haiku-4-5-20251001': 200000,
  'claude-sonnet-4-5-20250514': 200000,
}

/* ======================== 工具函数 ======================== */

function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`
  if (tokens < 100000) return `${(tokens / 1000).toFixed(1)}k`
  return `${Math.round(tokens / 1000)}k`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ======================== 彩色网格组件 ======================== */

/** 渲染类似 CLI /context 的彩色方块网格 */
function ContextGrid({ categories, maxTokens }: { categories: ContextCategory[]; maxTokens: number }) {
  const GRID_SIZE = 10
  const TOTAL_CELLS = GRID_SIZE * GRID_SIZE

  // 根据各类别 token 占比分配方块数
  const cells: { color: string; category: string }[] = useMemo(() => {
    const result: { color: string; category: string }[] = []
    for (const cat of categories) {
      const count = Math.round((cat.tokens / maxTokens) * TOTAL_CELLS)
      for (let i = 0; i < count && result.length < TOTAL_CELLS; i++) {
        result.push({ color: cat.gridColor, category: cat.label })
      }
    }
    // 剩余填充为空闲
    while (result.length < TOTAL_CELLS) {
      result.push({ color: 'bg-muted/40', category: '空闲' })
    }
    return result
  }, [categories, maxTokens])

  return (
    <div className="grid grid-cols-10 gap-[3px]">
      {cells.map((cell, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'w-full aspect-square rounded-[3px] transition-all cursor-default hover:scale-110',
                cell.color
              )}
            />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px]">
            {cell.category}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

/* ======================== 类别明细组件 ======================== */

function CategoryBreakdown({ categories, maxTokens }: { categories: ContextCategory[]; maxTokens: number }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground italic">Estimated usage by category</p>
      {categories.map((cat) => {
        const pct = ((cat.tokens / maxTokens) * 100).toFixed(1)
        return (
          <div key={cat.key} className="flex items-center gap-2 text-[12px]">
            <div className={cn('size-3 rounded-[2px] flex-shrink-0', cat.gridColor)} />
            <span className="text-foreground min-w-[120px]">{cat.label}:</span>
            <span className="text-muted-foreground">
              {formatTokens(cat.tokens)} tokens ({pct}%)
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ======================== MCP 工具列表 ======================== */

function McpToolsList() {
  const [mcpServers, setMcpServers] = useState<Record<string, any>>({})
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/config/mcp-servers')
      .then(r => r.ok ? r.json() : {})
      .then(data => setMcpServers(data || {}))
      .catch(() => {})
  }, [])

  const serverNames = Object.keys(mcpServers)
  if (serverNames.length === 0) return null

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[12px] font-medium text-foreground hover:text-primary transition-colors"
      >
        <Server className="size-3.5" />
        <span>MCP tools · /mcp (loaded on-demand)</span>
        {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
      </button>
      {expanded && (
        <div className="pl-5 space-y-0.5">
          <p className="text-[11px] text-muted-foreground">Available</p>
          {serverNames.map(name => (
            <div key={name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
              <span className="opacity-40">├</span>
              <span>mcp__{name.replace(/[^a-zA-Z0-9]/g, '_')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ======================== Skills 列表 ======================== */

function SkillsList({ workingDirectory }: { workingDirectory?: string }) {
  const [skills, setSkills] = useState<Array<{ name: string; description?: string }>>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!workingDirectory) return
    fetch(`/api/config/skills?workingDirectory=${encodeURIComponent(workingDirectory)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSkills(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [workingDirectory])

  if (skills.length === 0) return null

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[12px] font-medium text-foreground hover:text-primary transition-colors"
      >
        <Puzzle className="size-3.5" />
        <span>Skills ({skills.length})</span>
        {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
      </button>
      {expanded && (
        <div className="pl-5 space-y-0.5">
          {skills.map(s => (
            <div key={s.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
              <span className="opacity-40">├</span>
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ======================== 文件选择器子组件 ======================== */

function FileBrowser({
  mode,
  initialPath,
  onSelect,
  onCancel,
}: {
  mode: 'file' | 'directory'
  initialPath?: string
  onSelect: (entry: { name: string; path: string; isDirectory: boolean; size?: number }) => void
  onCancel: () => void
}) {
  const [currentPath, setCurrentPath] = useState(initialPath || '')
  const [entries, setEntries] = useState<BrowseEntry[]>([])
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const browse = useCallback(async (path?: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = path
        ? `/api/filesystem/browse?path=${encodeURIComponent(path)}&includeFiles=true`
        : `/api/filesystem/browse?includeFiles=true`
      const res = await fetch(url)
      if (!res.ok) throw new Error('无法浏览此路径')
      const data: BrowseResult = await res.json()
      setCurrentPath(data.current)
      setParentPath(data.parent)
      const allEntries: BrowseEntry[] = [
        ...(data.directories || []).map((d) => ({
          name: d.name, path: d.path, isDirectory: true, isGitRepo: d.isGitRepo,
        })),
        ...(data.files || []).map((f) => ({
          name: f.name, path: f.path, isDirectory: false, size: f.size,
        })),
      ]
      setEntries(allEntries)
    } catch (e: any) {
      setError(e.message || '浏览失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    browse(initialPath || undefined)
  }, [initialPath, browse])

  return (
    <div className="flex flex-col gap-2 p-3 border rounded-lg bg-accent/30">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground truncate flex-1 font-mono">
          {currentPath || '...'}
        </span>
        <Button variant="ghost" size="icon-xs" onClick={onCancel}>
          <X className="size-3" />
        </Button>
      </div>
      <div className="max-h-[200px] overflow-y-auto space-y-0.5">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-4 text-primary animate-spin" />
            <span className="ml-2 text-[12px] text-muted-foreground">加载中...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-6 gap-1.5">
            <AlertCircle className="size-3.5 text-destructive" />
            <span className="text-[12px] text-destructive">{error}</span>
          </div>
        ) : (
          <>
            {parentPath && (
              <button
                onClick={() => browse(parentPath)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-foreground hover:bg-accent transition-colors"
              >
                <ArrowUp className="size-3.5 opacity-60" />
                <span>返回上级</span>
              </button>
            )}
            {entries.map((entry) => (
              <button
                key={entry.path}
                onClick={() => {
                  if (entry.isDirectory) {
                    browse(entry.path)
                  } else if (mode === 'file') {
                    onSelect(entry)
                  }
                }}
                onDoubleClick={() => onSelect(entry)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] hover:bg-accent transition-colors group',
                  !entry.isDirectory && mode === 'directory' && 'opacity-40 pointer-events-none',
                )}
              >
                {entry.isDirectory
                  ? <Folder className="size-3.5 text-muted-foreground flex-shrink-0" />
                  : <File className="size-3.5 text-muted-foreground flex-shrink-0" />
                }
                <span className="truncate flex-1 text-left text-foreground">{entry.name}</span>
                {entry.size !== undefined && (
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatSize(entry.size)}</span>
                )}
                {entry.isDirectory && (
                  <ChevronRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
                )}
              </button>
            ))}
            {entries.length === 0 && !parentPath && (
              <p className="text-[11px] text-muted-foreground text-center py-4">此目录为空</p>
            )}
          </>
        )}
      </div>
      {mode === 'directory' && currentPath && (
        <Button
          variant="outline"
          size="sm"
          className="text-[12px]"
          onClick={() => onSelect({
            name: currentPath.split(/[/\\]/).filter(Boolean).pop() || currentPath,
            path: currentPath,
            isDirectory: true,
          })}
        >
          <FolderOpen className="size-3.5 mr-1" />
          选择当前目录
        </Button>
      )}
    </div>
  )
}

/* ======================== 主面板组件 ======================== */

export default function ContextPanel({
  sessionId,
  workingDirectory,
  open,
  onClose,
  onSendContext,
}: ContextPanelProps) {
  const { sessionContexts, addItem, removeItem, clearSession, getTotalEstimatedTokens } = useContextStore()
  const items = sessionContexts[sessionId] || []
  const contextTokens = getTotalEstimatedTokens(sessionId)

  const { sessions, activeSessionId } = useSessionStore()
  const session = sessions.find(s => s.id === (sessionId || activeSessionId))
  const model = (session as any)?.model || 'claude-sonnet-4-6'
  const maxTokens = MODEL_MAX_TOKENS[model] || MAX_TOKENS

  // Tab 切换: usage | manage
  const [activeTab, setActiveTab] = useState<'usage' | 'manage'>('usage')

  // 文件管理状态
  const [browserMode, setBrowserMode] = useState<'file' | 'directory' | null>(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  // 计算消息 token 用量（从 session.messages 中汇总）
  const messagesTokens = useMemo(() => {
    if (!session) return 0
    return session.messages.reduce((sum, msg) => {
      if (msg.tokenUsage) {
        return sum + msg.tokenUsage.inputTokens + msg.tokenUsage.outputTokens
      }
      // 无 tokenUsage 时简单估算：1 token ≈ 4 字符
      return sum + Math.ceil(msg.content.length / 4)
    }, 0)
  }, [session])

  // 估算各类别 token（模拟 CLI /context 输出）
  const categories: ContextCategory[] = useMemo(() => {
    const systemPromptTokens = 4700    // 系统提示词（约 4.7k）
    const systemToolsTokens = 8600     // 系统工具定义（约 8.6k）
    const memoryTokens = 4500          // Memory 文件 (~/.claude/memory/)
    const skillsTokens = 600           // Skills 定义
    const msgTokens = messagesTokens || 0
    const userContextTokens = contextTokens || 0
    const usedTotal = systemPromptTokens + systemToolsTokens + memoryTokens + skillsTokens + msgTokens + userContextTokens
    const autocompactTokens = Math.round(maxTokens * 0.165) // ~16.5% 用于 autocompact buffer
    const freeTokens = Math.max(0, maxTokens - usedTotal - autocompactTokens)

    return [
      { key: 'system_prompt', label: 'System prompt', tokens: systemPromptTokens, color: 'bg-orange-500', gridColor: 'bg-orange-500', emoji: '🟠' },
      { key: 'system_tools', label: 'System tools', tokens: systemToolsTokens, color: 'bg-orange-400', gridColor: 'bg-orange-400', emoji: '🟠' },
      { key: 'memory', label: 'Memory files', tokens: memoryTokens, color: 'bg-yellow-500', gridColor: 'bg-yellow-500', emoji: '🟡' },
      { key: 'skills', label: 'Skills', tokens: skillsTokens, color: 'bg-yellow-400', gridColor: 'bg-yellow-400', emoji: '🟡' },
      { key: 'messages', label: 'Messages', tokens: msgTokens, color: 'bg-purple-500', gridColor: 'bg-purple-500', emoji: '🟣' },
      ...(userContextTokens > 0 ? [{
        key: 'user_context', label: 'User context', tokens: userContextTokens, color: 'bg-blue-500', gridColor: 'bg-blue-500', emoji: '🔵',
      }] : []),
      { key: 'free', label: 'Free space', tokens: freeTokens, color: 'bg-muted/30', gridColor: 'bg-muted/40', emoji: '⚪' },
      { key: 'autocompact', label: 'Autocompact buffer', tokens: autocompactTokens, color: 'bg-muted/60', gridColor: 'bg-muted-foreground/20', emoji: '⊠' },
    ]
  }, [messagesTokens, contextTokens, maxTokens])

  const usedTokens = categories.filter(c => !['free', 'autocompact'].includes(c.key)).reduce((s, c) => s + c.tokens, 0)
  const usedPct = ((usedTokens / maxTokens) * 100).toFixed(0)

  const handleBrowseSelect = (entry: { name: string; path: string; isDirectory: boolean; size?: number }) => {
    addItem(sessionId, {
      type: entry.isDirectory ? 'directory' : 'file',
      path: entry.path,
      displayName: entry.name,
      size: entry.size,
    })
    setBrowserMode(null)
  }

  const handleAddUrl = () => {
    const trimmed = urlValue.trim()
    if (!trimmed) return
    try { new URL(trimmed) } catch {
      try { new URL('https://' + trimmed) } catch { return }
    }
    const finalUrl = trimmed.startsWith('http') ? trimmed : 'https://' + trimmed
    addItem(sessionId, { type: 'url', path: finalUrl, displayName: '' })
    setUrlValue('')
    setShowUrlInput(false)
  }

  const handleClear = () => {
    if (confirmClear) {
      clearSession(sessionId)
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-[420px] max-w-full sm:max-w-[420px] flex flex-col p-0 gap-0"
      >
        <TooltipProvider delayDuration={200}>
        {/* 标题栏 */}
        <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-[15px] font-semibold font-mono">
              /context
            </SheetTitle>
            <div className="flex items-center gap-1">
              {onSendContext && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={onSendContext}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Send className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>发送 /context 到 CLI 获取精确数据</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Tab 切换 */}
        <div className="flex border-b border-border px-4">
          <button
            onClick={() => setActiveTab('usage')}
            className={cn(
              'px-3 py-2 text-[12px] font-medium border-b-2 transition-colors',
              activeTab === 'usage'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Context Usage
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={cn(
              'px-3 py-2 text-[12px] font-medium border-b-2 transition-colors',
              activeTab === 'manage'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            管理上下文
            {items.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-primary/15 text-primary rounded-full">
                {items.length}
              </span>
            )}
          </button>
        </div>

        {/* 内容区域 */}
        <ScrollArea className="flex-1 min-h-0">
          {activeTab === 'usage' ? (
            /* ==================== Context Usage 可视化 ==================== */
            <div className="p-4 space-y-4">
              {/* 模型 + 总量 */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">├</span>
                  <span className="text-[13px] font-medium text-foreground">Context Usage</span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground ml-4">
                  <span className="font-mono">{model}</span>
                  <span>·</span>
                  <span>{formatTokens(usedTokens)}/{formatTokens(maxTokens)} tokens ({usedPct}%)</span>
                </div>
              </div>

              {/* 彩色网格 */}
              <div className="px-2">
                <ContextGrid categories={categories} maxTokens={maxTokens} />
              </div>

              {/* 类别明细 */}
              <CategoryBreakdown categories={categories} maxTokens={maxTokens} />

              <Separator />

              {/* MCP Tools */}
              <McpToolsList />

              {/* Skills */}
              <SkillsList workingDirectory={workingDirectory} />

              {/* 提示 */}
              <p className="text-[10px] text-muted-foreground italic">
                * Token 估算基于消息长度和默认系统开销，精确数据请点击右上角发送 /context 到 CLI
              </p>
            </div>
          ) : (
            /* ==================== 管理上下文（文件/目录/URL） ==================== */
            <div className="p-4 space-y-4">
              {/* 添加按钮 */}
              <div className="space-y-2">
                <span className="text-[12px] font-medium text-foreground">添加上下文</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-[12px] gap-1.5"
                    onClick={() => { setBrowserMode('file'); setShowUrlInput(false) }}>
                    <File className="size-3.5" />文件
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-[12px] gap-1.5"
                    onClick={() => { setBrowserMode('directory'); setShowUrlInput(false) }}>
                    <Folder className="size-3.5" />目录
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-[12px] gap-1.5"
                    onClick={() => { setShowUrlInput(true); setBrowserMode(null) }}>
                    <Link className="size-3.5" />URL
                  </Button>
                </div>

                {browserMode && (
                  <FileBrowser
                    mode={browserMode}
                    initialPath={workingDirectory}
                    onSelect={handleBrowseSelect}
                    onCancel={() => setBrowserMode(null)}
                  />
                )}

                {showUrlInput && (
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-accent/30">
                    <Input
                      value={urlValue}
                      onChange={(e) => setUrlValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                      placeholder="https://example.com/doc"
                      className="text-[12px] h-8 bg-background"
                      autoFocus
                    />
                    <Button variant="default" size="sm" onClick={handleAddUrl}
                      disabled={!urlValue.trim()} className="text-[12px] flex-shrink-0">
                      <Plus className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-xs"
                      onClick={() => { setShowUrlInput(false); setUrlValue('') }}>
                      <X className="size-3" />
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* 上下文项列表 */}
              <div className="space-y-1">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <File className="size-8 text-muted-foreground/30" />
                    <p className="text-[12px] text-muted-foreground text-center">
                      暂无上下文项，点击上方按钮添加文件、目录或 URL
                    </p>
                  </div>
                ) : (
                  items.map((item) => (
                    <div key={item.id}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-accent transition-colors group">
                      {item.type === 'file' && <File className="size-4 text-blue-400 flex-shrink-0" />}
                      {item.type === 'directory' && <Folder className="size-4 text-green-400 flex-shrink-0" />}
                      {item.type === 'url' && <Link className="size-4 text-purple-400 flex-shrink-0" />}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-1 text-[13px] text-foreground truncate cursor-default">
                            {item.displayName}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[300px]">
                          <div className="space-y-1 text-[11px]">
                            <div className="font-mono break-all">{item.path}</div>
                            {item.size !== undefined && <div>大小: {formatSize(item.size)}</div>}
                            {item.language && <div>语言: {item.language}</div>}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      {item.size !== undefined && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatSize(item.size)}</span>
                      )}
                      {item.language && (
                        <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded flex-shrink-0">
                          {item.language}
                        </span>
                      )}
                      <Button variant="ghost" size="icon-xs"
                        onClick={() => removeItem(sessionId, item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0">
                        <X className="size-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* 底部统计 */}
        <div className="border-t border-border px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {activeTab === 'usage'
                ? `${formatTokens(usedTokens)} / ${formatTokens(maxTokens)} tokens used`
                : `${items.length} 项，约 ${formatTokens(contextTokens)} tokens`
              }
            </span>
            {activeTab === 'manage' && items.length > 0 && (
              <Button variant={confirmClear ? 'destructive' : 'ghost'} size="sm"
                onClick={handleClear} className="text-[12px] gap-1">
                <Trash2 className="size-3" />
                {confirmClear ? '确认清空？' : '清空全部'}
              </Button>
            )}
          </div>
        </div>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  )
}
