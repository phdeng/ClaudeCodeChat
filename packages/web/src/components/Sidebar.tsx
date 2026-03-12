import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Settings, History, X, MessageSquare, Sparkles, Search, Trash2, FolderOpen, Download, FileText, FileJson, FileCode, AlignLeft, Pin, Upload, Tag, Eye, Archive, ArchiveRestore, ChevronRight, ChevronDown, GripVertical, BookTemplate, ScrollText, Loader2, Palette, Check, XCircle, MoreHorizontal, BookOpen, GitBranch, Star, Store } from 'lucide-react'
import { toast } from 'sonner'
import { useSessionStore, type Session } from '../stores/sessionStore'
import { useSessionTabsStore } from '../stores/sessionTabsStore'
import { useCategoryStore } from '../stores/categoryStore'
import { useTranslation } from '../i18n'
import { exportSessionAsMarkdown, exportSessionAsJson, exportSessionAsHtml, exportSessionAsTxt, importSessionFromJson } from '../utils/exportChat'
import ChatExportPreview from './ChatExportPreview'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import TagCloudPanel from './TagCloudPanel'
import SessionTreeView from './SessionTreeView'
import FavoritesPanel from './FavoritesPanel'
import { useFavoritesStore } from '../stores/favoritesStore'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'

interface SidebarProps {
  onClose: () => void
}

function classifyDate(timestamp: number): 'today' | 'yesterday' | 'earlier' {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86_400_000

  if (timestamp >= todayStart) return 'today'
  if (timestamp >= yesterdayStart) return 'yesterday'
  return 'earlier'
}

/** 获取会话中第一个匹配搜索词的消息片段 */
function getMatchSnippet(
  session: { title: string; messages: { content: string }[] },
  searchQuery: string
) {
  if (!searchQuery.trim()) return null
  const q = searchQuery.trim().toLowerCase()
  // 标题已匹配，不需要显示消息片段
  if (session.title.toLowerCase().includes(q)) return null
  for (const msg of session.messages) {
    const idx = msg.content.toLowerCase().indexOf(q)
    if (idx >= 0) {
      const start = Math.max(0, idx - 20)
      const end = Math.min(msg.content.length, idx + q.length + 20)
      return {
        before: msg.content.slice(start, idx),
        match: msg.content.slice(idx, idx + q.length),
        after: msg.content.slice(idx + q.length, end),
        prefix: start > 0 ? '...' : '',
        suffix: end < msg.content.length ? '...' : '',
      }
    }
  }
  return null
}

// 标签颜色映射：6 种预定义颜色
const TAG_COLORS = [
  'bg-foreground/8 text-foreground/70 border-foreground/10',
  'bg-foreground/6 text-foreground/65 border-foreground/8',
  'bg-foreground/10 text-foreground/75 border-foreground/12',
  'bg-foreground/8 text-foreground/70 border-foreground/10',
  'bg-foreground/6 text-foreground/65 border-foreground/8',
  'bg-foreground/10 text-foreground/75 border-foreground/12',
]

/** 根据标签名 hash 获取对应颜色 */
function getTagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash + tag.charCodeAt(i)) | 0
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

/** 计算会话距今的天数（基于最后一条消息或创建时间） */
function daysSinceLastActivity(session: { messages: { timestamp: number }[]; createdAt: number }): number {
  const lastMsg = session.messages[session.messages.length - 1]
  const lastTime = lastMsg ? lastMsg.timestamp : session.createdAt
  return Math.floor((Date.now() - lastTime) / (1000 * 60 * 60 * 24))
}

// 预设常用标签
const PRESET_TAGS = ['编程', '学习', '翻译', '工作', '想法']

// 颜色标签：8 种预设颜色（textKey 在渲染时通过 t() 翻译）
const LABEL_COLORS = [
  { name: 'red', bg: 'bg-red-400/90', textKey: 'sidebar.colorRed' },
  { name: 'orange', bg: 'bg-orange-400/90', textKey: 'sidebar.colorOrange' },
  { name: 'yellow', bg: 'bg-yellow-400/90', textKey: 'sidebar.colorYellow' },
  { name: 'green', bg: 'bg-green-400/90', textKey: 'sidebar.colorGreen' },
  { name: 'blue', bg: 'bg-blue-400/90', textKey: 'sidebar.colorBlue' },
  { name: 'purple', bg: 'bg-purple-400/90', textKey: 'sidebar.colorPurple' },
  { name: 'pink', bg: 'bg-pink-400/90', textKey: 'sidebar.colorPink' },
  { name: 'gray', bg: 'bg-gray-400/90', textKey: 'sidebar.colorGray' },
]

/** 根据颜色名称获取对应的 bg 类 */
function getLabelColorBg(colorName: string): string {
  const found = LABEL_COLORS.find((c) => c.name === colorName)
  return found ? found.bg : 'bg-gray-500'
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { sessions, activeSessionId, createSession, deleteSession, togglePinSession, toggleArchiveSession, importSession, addSessionTag, removeSessionTag, reorderSessions, setSessionColorLabel, projectFilter, setProjectFilter, streamingSessions } = useSessionStore()
  const openTab = useSessionTabsStore((s) => s.openTab)

  // 触摸手势：从右向左滑动关闭侧边栏
  const sidebarRef = useRef<HTMLElement>(null)
  const touchStartX = useRef<number | null>(null)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    // 向左滑动超过 80px 则关闭侧边栏
    if (deltaX < -80) {
      onClose()
    }
    touchStartX.current = null
  }, [onClose])

  // 会话悬浮预览状态
  const [hoverPreview, setHoverPreview] = useState<{ session: Session; rect: DOMRect } | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 分类过滤器
  const { categories } = useCategoryStore()
  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.order - b.order), [categories])
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null)

  // 项目筛选：下拉展开/收起
  const [showProjectFilter, setShowProjectFilter] = useState(false)
  const projectFilterRef = useRef<HTMLDivElement>(null)

  // 从所有会话中提取去重的项目路径列表
  const projectList = useMemo(() => {
    const pathSet = new Set<string>()
    for (const s of sessions) {
      if (s.workingDirectory) {
        pathSet.add(s.workingDirectory)
      }
    }
    return Array.from(pathSet).sort()
  }, [sessions])

  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // 预览导出：记录当前预览的会话 ID
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null)
  // 标签弹窗：记录当前打开标签编辑的会话 ID
  const [tagPopoverId, setTagPopoverId] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const tagPopoverRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 拖拽排序状态
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null)
  const [dragOverSessionId, setDragOverSessionId] = useState<string | null>(null)

  // 会话摘要状态
  const [summaries, setSummaries] = useState<Map<string, string>>(new Map())
  const [summarizingId, setSummarizingId] = useState<string | null>(null)

  // 会话分支树视图状态
  const [treeViewSessionId, setTreeViewSessionId] = useState<string | null>(null)

  // 收藏夹面板状态
  const [showFavoritesPanel, setShowFavoritesPanel] = useState(false)
  const favoritesCount = useFavoritesStore((s) => s.favorites.length)

  /** 调用后端 API 生成会话摘要 */
  const handleGenerateSummary = useCallback(async (session: Session) => {
    if (summarizingId) return // 已有正在生成的摘要
    if (session.messages.length === 0) {
      toast.error(t('sidebar.noMessagesForSummary' as any))
      return
    }
    setSummarizingId(session.id)
    try {
      const resp = await fetch('/api/sessions/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: session.messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: t('sidebar.requestFailed' as any) }))
        throw new Error(data.error || t('sidebar.summaryFailed' as any))
      }
      const data = await resp.json()
      if (data.summary) {
        setSummaries(prev => {
          const next = new Map(prev)
          next.set(session.id, data.summary)
          return next
        })
        toast.success(t('sidebar.summarySuccess' as any))
      }
    } catch (err: any) {
      toast.error(err.message || t('sidebar.summaryFailed' as any))
    } finally {
      setSummarizingId(null)
    }
  }, [summarizingId, t])

  // 点击外部关闭标签弹窗
  useEffect(() => {
    if (!tagPopoverId) return
    const handleClickOutside = (e: MouseEvent) => {
      if (tagPopoverRef.current && !tagPopoverRef.current.contains(e.target as Node)) {
        setTagPopoverId(null)
        setTagInput('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [tagPopoverId])

  // 点击外部关闭项目筛选下拉
  useEffect(() => {
    if (!showProjectFilter) return
    const handleClickOutside = (e: MouseEvent) => {
      if (projectFilterRef.current && !projectFilterRef.current.contains(e.target as Node)) {
        setShowProjectFilter(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProjectFilter])

  const handleNewChat = () => {
    const session = createSession()
    openTab(session.id, session.title)
    navigate(`/chat/${session.id}`)
  }

  const filteredSessions = useMemo(() => {
    // 先排除已归档的会话
    let result = sessions.filter((s) => !s.archived)

    // 项目筛选
    if (projectFilter) {
      if (projectFilter === '__unset__') {
        // 筛选未设置项目的会话
        result = result.filter((s) => !s.workingDirectory)
      } else {
        result = result.filter((s) => s.workingDirectory === projectFilter)
      }
    }

    // 分类过滤：按标签名匹配
    if (activeCategoryFilter) {
      const cat = categories.find((c) => c.id === activeCategoryFilter)
      if (cat) {
        result = result.filter((s) => s.tags?.includes(cat.name))
      }
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((s) => {
        // 搜索标题
        if (s.title.toLowerCase().includes(q)) return true
        // 搜索消息内容
        return s.messages.some((m) => m.content.toLowerCase().includes(q))
      })
    }

    return result
  }, [sessions, searchQuery, activeCategoryFilter, categories, projectFilter])

  // 已归档的会话列表（搜索也适用于归档区域）
  const archivedSessions = useMemo(() => {
    let result = sessions.filter((s) => s.archived)

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((s) => {
        if (s.title.toLowerCase().includes(q)) return true
        return s.messages.some((m) => m.content.toLowerCase().includes(q))
      })
    }

    return result
  }, [sessions, searchQuery])

  const groupedSessions = useMemo(() => {
    const groups: { label: string; items: typeof filteredSessions }[] = []
    const map = new Map<string, typeof filteredSessions>()
    const order = ['pinned', 'today', 'yesterday', 'earlier'] as const

    // 先分离置顶会话
    const pinned = filteredSessions.filter(s => s.pinned)
    const unpinned = filteredSessions.filter(s => !s.pinned)

    if (pinned.length > 0) {
      map.set('pinned', pinned)
    }

    for (const s of unpinned) {
      const label = classifyDate(s.createdAt)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(s)
    }

    for (const label of order) {
      const items = map.get(label)
      if (items && items.length > 0) groups.push({ label, items })
    }

    return groups
  }, [filteredSessions])

  const handleDelete = (sessionId: string) => {
    deleteSession(sessionId)
    setConfirmDeleteId(null)
    toast(t('sidebar.sessionDeleted' as any))
    if (sessionId === activeSessionId) navigate('/')
  }

  /** 处理导入 JSON 文件 */
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // 重置 input 以便重复选择同一文件
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = () => {
      const jsonString = reader.result as string
      const result = importSessionFromJson(jsonString)
      if (result.success && result.session) {
        importSession(result.session)
        openTab(result.session.id, result.session.title)
        navigate(`/chat/${result.session.id}`)
        toast.success(t('sidebar.importedSession' as any, { title: result.session.title }))
        if (window.innerWidth < 768) onClose()
      } else {
        toast.error(t('sidebar.importFailed' as any, { error: result.error || '' }))
      }
    }
    reader.onerror = () => {
      toast.error(t('sidebar.readFileFailed' as any))
    }
    reader.readAsText(file)
  }

  return (
    <>
    <aside
      ref={sidebarRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="w-[272px] h-full flex-shrink-0 bg-sidebar flex flex-col border-r border-border shadow-[1px_0_0_0_rgba(0,0,0,0.3)]"
    >
      {/* 顶部品牌 */}
      <div className="h-[52px] flex items-center justify-between px-5 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] flex items-center justify-center shadow-sm">
            <Sparkles size={13} className="text-white" />
          </div>
          <span className="font-semibold text-[13px] gradient-text tracking-tight">Claude Code</span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          className="text-foreground"
          aria-label={t('sidebar.closeSidebar' as any)}
        >
          <X size={14} />
        </Button>
      </div>

      {/* 新建对话 */}
      <div className="px-4 pb-3 flex gap-2">
        <Button
          variant="outline"
          onClick={handleNewChat}
          className="flex-1 border-dashed border-border text-[13px] text-muted-foreground hover:border-primary hover:bg-primary/15 hover:text-primary"
        >
          <Plus size={14} strokeWidth={2} />
          {t('sidebar.newChat')}
        </Button>
        <Button
          variant="outline"
          onClick={() => window.dispatchEvent(new CustomEvent('shortcut:templates'))}
          className="flex-shrink-0 border-dashed border-border text-[13px] text-muted-foreground hover:border-primary hover:bg-primary/15 hover:text-primary px-2.5"
          title={t('sidebar.createFromTemplate' as any)}
          aria-label={t('sidebar.createFromTemplate' as any)}
        >
          <BookTemplate size={14} strokeWidth={2} />
        </Button>
      </div>

      {/* 搜索 */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50 pointer-events-none" />
          <Input
            type="text"
            placeholder={t('sidebar.searchPlaceholder' as any)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-10 py-[7px] h-auto bg-accent text-[13px] text-foreground placeholder:text-muted-foreground placeholder:opacity-50 border-transparent focus-visible:border-ring"
          />
          {filteredSessions.length > 0 && (
            <Badge
              variant="secondary"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums h-auto px-1 py-0 rounded-sm"
            >
              {filteredSessions.length}
            </Badge>
          )}
        </div>
      </div>

      {/* 项目筛选 */}
      {projectList.length > 0 && (
        <div className="px-4 pb-2" ref={projectFilterRef}>
          <div className="relative">
            <button
              onClick={() => setShowProjectFilter((prev) => !prev)}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-[6px] rounded-md text-[12px] transition-colors duration-150 border',
                projectFilter
                  ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15'
                  : 'text-foreground border-transparent hover:bg-accent'
              )}
            >
              <FolderOpen size={13} className={cn('flex-shrink-0', projectFilter ? 'text-primary' : 'opacity-50')} />
              <span className="truncate flex-1 text-left">
                {projectFilter
                  ? projectFilter === '__unset__'
                    ? t('sidebar.uncategorized' as any)
                    : projectFilter.split(/[/\\]/).filter(Boolean).pop() || projectFilter
                  : t('sidebar.allProjects')}
              </span>
              <ChevronDown size={12} className={cn('flex-shrink-0 transition-transform duration-150', showProjectFilter && 'rotate-180')} />
            </button>
            {showProjectFilter && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border bg-popover shadow-md py-1 max-h-[200px] overflow-y-auto animate-in fade-in-0 zoom-in-95">
                {/* 全部项目 */}
                <button
                  onClick={() => {
                    setProjectFilter(null)
                    setShowProjectFilter(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-[12px] transition-colors hover:bg-accent',
                    !projectFilter ? 'text-primary font-medium' : 'text-popover-foreground'
                  )}
                >
                  <FolderOpen size={12} className="opacity-50 flex-shrink-0" />
                  <span>{t('sidebar.allProjects')}</span>
                  {!projectFilter && <span className="ml-auto text-primary text-[11px]">&#10003;</span>}
                </button>
                {/* 各项目路径 */}
                {projectList.map((path) => {
                  const dirName = path.split(/[/\\]/).filter(Boolean).pop() || path
                  return (
                    <button
                      key={path}
                      onClick={() => {
                        setProjectFilter(path)
                        setShowProjectFilter(false)
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-[12px] transition-colors hover:bg-accent',
                        projectFilter === path ? 'text-primary font-medium' : 'text-popover-foreground'
                      )}
                      title={path}
                    >
                      <FolderOpen size={12} className="flex-shrink-0 opacity-50" />
                      <span className="truncate">{dirName}</span>
                      {projectFilter === path && <span className="ml-auto text-primary text-[11px]">&#10003;</span>}
                    </button>
                  )
                })}
                {/* 未分类 */}
                {sessions.some((s) => !s.archived && !s.workingDirectory) && (
                  <>
                    <div className="border-t border-border my-0.5" />
                    <button
                      onClick={() => {
                        setProjectFilter('__unset__')
                        setShowProjectFilter(false)
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-[12px] transition-colors hover:bg-accent',
                        projectFilter === '__unset__' ? 'text-primary font-medium' : 'text-muted-foreground'
                      )}
                    >
                      <FolderOpen size={12} className="opacity-30 flex-shrink-0" />
                      <span>{t('sidebar.uncategorized' as any)}</span>
                      {projectFilter === '__unset__' && <span className="ml-auto text-primary text-[11px]">&#10003;</span>}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 分类过滤器 */}
      {sortedCategories.length > 0 && (
        <div className="px-4 pb-1.5 flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setActiveCategoryFilter(null)}
            className={cn(
              'text-[10px] px-2 py-0.5 rounded-full border transition-colors duration-150',
              activeCategoryFilter === null
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'text-foreground border-border hover:border-muted-foreground/40'
            )}
          >
            {t('sidebar.all' as any)}
          </button>
          {sortedCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryFilter(activeCategoryFilter === cat.id ? null : cat.id)}
              className={cn(
                'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors duration-150',
                activeCategoryFilter === cat.id
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'text-foreground border-border hover:border-muted-foreground/40'
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cat.color)} />
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* 会话列表 */}
      <ScrollArea className="flex-1 px-3 pt-1 pb-2">
        <nav aria-label={t('sidebar.sessionHistory' as any)}>
          {filteredSessions.length === 0 && (
            <p className="text-[12px] text-muted-foreground text-center mt-10">
              {searchQuery.trim() ? t('sidebar.noMatchingSessions' as any) : t('sidebar.noSessions')}
            </p>
          )}

          {groupedSessions.map((group) => (
            <div key={group.label} className="mb-0.5" role="list" aria-label={t(`sidebar.${group.label}` as any)}>
              <div className="px-2 pt-4 pb-1.5">
                <span className="text-[11px] font-medium text-muted-foreground tracking-wide">
                  {group.label === 'pinned' && <Pin size={10} className="inline mr-1 text-primary opacity-60" />}
                  {t(`sidebar.${group.label}` as any)}
                </span>
              </div>

              {group.items.map((session) => {
                const isConfirming = confirmDeleteId === session.id
                const matchSnippet = getMatchSnippet(session, searchQuery)
                const inactiveDays = daysSinceLastActivity(session)
                const isInactive = !session.pinned && inactiveDays > 30

                return (
                  <div
                    key={session.id}
                    role="listitem"
                    aria-label={session.title}
                    className={cn(
                      "group relative",
                      // 拖拽目标指示线
                      dragOverSessionId === session.id && draggedSessionId !== null && draggedSessionId !== session.id &&
                        "border-t-2 border-primary",
                      // 超过 30 天未活动的会话淡化显示
                      isInactive && "opacity-50"
                    )}
                    draggable
                    onDragStart={(e) => {
                      setDraggedSessionId(session.id)
                      e.dataTransfer.effectAllowed = 'move'
                      // 设置半透明效果
                      if (e.currentTarget instanceof HTMLElement) {
                        e.currentTarget.style.opacity = '0.4'
                      }
                    }}
                    onDragEnd={(e) => {
                      setDraggedSessionId(null)
                      setDragOverSessionId(null)
                      if (e.currentTarget instanceof HTMLElement) {
                        e.currentTarget.style.opacity = '1'
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setDragOverSessionId(session.id)
                    }}
                    onDragLeave={() => {
                      setDragOverSessionId(null)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (draggedSessionId !== null && draggedSessionId !== session.id) {
                        // 根据 session ID 找到在 sessions 数组中的实际索引
                        const fromIndex = sessions.findIndex(s => s.id === draggedSessionId)
                        const toIndex = sessions.findIndex(s => s.id === session.id)
                        if (fromIndex !== -1 && toIndex !== -1) {
                          reorderSessions(fromIndex, toIndex)
                        }
                      }
                      setDraggedSessionId(null)
                      setDragOverSessionId(null)
                    }}
                  >
                    {isConfirming ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-destructive/5 mb-0.5">
                        <Trash2 size={12} className="text-destructive flex-shrink-0 opacity-70" />
                        <span className="text-[12px] text-destructive truncate flex-1 opacity-80">
                          {t('sidebar.deleteConfirm')}
                        </span>
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => handleDelete(session.id)}
                        >
                          {t('common.delete')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-foreground"
                        >
                          {t('common.cancel')}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            openTab(session.id, session.title)
                            navigate(`/chat/${session.id}`)
                            // 移动端自动关闭侧边栏
                            if (window.innerWidth < 768) onClose()
                          }}
                          onMouseEnter={(e) => {
                            // 触摸设备不显示悬浮预览
                            if (window.matchMedia('(hover: none)').matches) return
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            hoverTimerRef.current = setTimeout(() => {
                              setHoverPreview({ session, rect })
                            }, 500) // 500ms 延迟避免快速滑过时频繁弹出
                          }}
                          onMouseLeave={() => {
                            if (hoverTimerRef.current) {
                              clearTimeout(hoverTimerRef.current)
                              hoverTimerRef.current = null
                            }
                            setHoverPreview(null)
                          }}
                          className={cn(
                            'w-full text-left px-2.5 py-2 rounded-lg text-[13px] mb-0.5 flex items-start gap-2.5 transition-colors duration-150',
                            session.id === activeSessionId
                              ? 'bg-accent text-foreground'
                              : 'text-foreground hover:bg-accent'
                          )}
                        >
                          {/* 拖拽手柄 */}
                        <GripVertical
                          size={12}
                          className="opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing flex-shrink-0 mt-0.5 -ml-0.5"
                          role="button"
                          aria-label={t('sidebar.dragToSort' as any)}
                        />
                        <MessageSquare
                            size={13}
                            className={cn(
                              'flex-shrink-0 opacity-50 mt-0.5',
                              session.id === activeSessionId && 'text-primary opacity-80',
                              session.pinned && 'text-primary opacity-70'
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="truncate block flex items-center gap-1.5">
                              {session.colorLabel && (
                                <span
                                  className={cn('rounded-full flex-shrink-0', getLabelColorBg(session.colorLabel))}
                                  style={{ width: 6, height: 6 }}
                                />
                              )}
                              {session.title}
                              {streamingSessions.has(session.id) && (
                                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary animate-pulse" title={t('sidebar.chatting' as any)} />
                              )}
                              {/* 未读消息计数 badge */}
                              {(session.unreadCount ?? 0) > 0 && (
                                <span
                                  className="flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-400/90 text-white text-[10px] font-medium leading-none"
                                  title={t('sidebar.unreadMessages' as any, { count: session.unreadCount ?? 0 })}
                                >
                                  {(session.unreadCount ?? 0) > 9 ? '9+' : session.unreadCount}
                                </span>
                              )}
                              {/* 不活跃会话天数提示 */}
                              {isInactive && (
                                <span className="flex-shrink-0 text-[10px] text-muted-foreground/60 ml-1">
                                  {inactiveDays}{t('sidebar.daysAgo' as any)}
                                </span>
                              )}
                            </span>
                            {matchSnippet && (
                              <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {matchSnippet.prefix}{matchSnippet.before}
                                <span className="text-primary font-medium">{matchSnippet.match}</span>
                                {matchSnippet.after}{matchSnippet.suffix}
                              </div>
                            )}
                            {/* 标签列表 */}
                            {session.tags && session.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {session.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className={cn(
                                      'inline-flex items-center text-[10px] px-1.5 py-0 rounded-full border leading-4',
                                      getTagColor(tag)
                                    )}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {session.workingDirectory && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate mt-0.5">
                                <FolderOpen size={10} className="flex-shrink-0" />
                                {session.workingDirectory.split(/[/\\]/).filter(Boolean).pop()}
                              </span>
                            )}
                          </div>
                        </button>
                        {/* 会话操作下拉菜单 */}
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 rounded hover:bg-accent/80 text-foreground transition-colors duration-150"
                                aria-label={t('sidebar.sessionActions' as any)}
                              >
                                <MoreHorizontal size={14} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="start" className="w-48">
                              {/* 置顶 */}
                              <DropdownMenuItem onSelect={() => togglePinSession(session.id)}>
                                <Pin size={14} className={session.pinned ? 'fill-current text-primary' : 'opacity-60'} />
                                {session.pinned ? t('sidebar.unpinSession' as any) : t('sidebar.pinSession' as any)}
                              </DropdownMenuItem>

                              {/* 标签管理 */}
                              <DropdownMenuItem onSelect={(e) => {
                                e.preventDefault()
                                setTagPopoverId(tagPopoverId === session.id ? null : session.id)
                                setTagInput('')
                              }}>
                                <Tag size={14} className={session.tags && session.tags.length > 0 ? 'text-primary' : 'opacity-60'} />
                                {t('sidebar.manageTags' as any)}
                              </DropdownMenuItem>

                              {/* 颜色标签 */}
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <Palette size={14} className={session.colorLabel ? 'text-primary' : 'opacity-60'} />
                                  {t('sidebar.colorLabel' as any)}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-40">
                                  {LABEL_COLORS.map((color) => {
                                    const isSelected = session.colorLabel === color.name
                                    return (
                                      <DropdownMenuItem
                                        key={color.name}
                                        onSelect={() => setSessionColorLabel(session.id, isSelected ? null : color.name)}
                                      >
                                        <span
                                          className={cn('w-3 h-3 rounded-full flex-shrink-0', color.bg)}
                                        />
                                        <span className="flex-1">{t(color.textKey as any)}</span>
                                        {isSelected && <Check size={12} className="text-primary flex-shrink-0" />}
                                      </DropdownMenuItem>
                                    )
                                  })}
                                  {session.colorLabel && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onSelect={() => setSessionColorLabel(session.id, null)}>
                                        <XCircle size={14} className="opacity-60" />
                                        {t('sidebar.clearColor' as any)}
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>

                              {/* 导出 */}
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <Download size={14} className="opacity-60" />
                                  {t('sidebar.exportChat' as any)}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-40">
                                  <DropdownMenuItem onSelect={() => {
                                    exportSessionAsMarkdown(session)
                                    toast.success(t('sidebar.exportedMarkdown' as any))
                                  }}>
                                    <FileText size={14} className="opacity-60" />
                                    Markdown (.md)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => {
                                    exportSessionAsJson(session)
                                    toast.success(t('sidebar.exportedJSON' as any))
                                  }}>
                                    <FileJson size={14} className="opacity-60" />
                                    JSON (.json)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => {
                                    exportSessionAsHtml(session)
                                    toast.success(t('sidebar.exportedHTML' as any))
                                  }}>
                                    <FileCode size={14} className="opacity-60" />
                                    HTML (.html)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => {
                                    exportSessionAsTxt(session)
                                    toast.success(t('sidebar.exportedTXT' as any))
                                  }}>
                                    <AlignLeft size={14} className="opacity-60" />
                                    TXT (.txt)
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onSelect={() => setPreviewSessionId(session.id)}>
                                    <Eye size={14} className="opacity-60" />
                                    {t('sidebar.previewPrint' as any)}
                                  </DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>

                              {/* 生成摘要 */}
                              {!summaries.has(session.id) && (
                                <DropdownMenuItem
                                  disabled={summarizingId !== null}
                                  onSelect={() => handleGenerateSummary(session)}
                                >
                                  {summarizingId === session.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <ScrollText size={14} className="opacity-60" />
                                  )}
                                  {t('sidebar.generateSummary' as any)}
                                </DropdownMenuItem>
                              )}

                              {/* 查看分支 */}
                              <DropdownMenuItem onSelect={() => setTreeViewSessionId(session.id)}>
                                <GitBranch size={14} className="opacity-60" />
                                查看分支
                              </DropdownMenuItem>

                              {/* 归档 */}
                              <DropdownMenuItem onSelect={() => {
                                toggleArchiveSession(session.id)
                                toast(session.archived ? t('sidebar.sessionRestored' as any) : t('sidebar.sessionArchived' as any))
                              }}>
                                {session.archived ? <ArchiveRestore size={14} className="opacity-60" /> : <Archive size={14} className="opacity-60" />}
                                {session.archived ? t('sidebar.restoreSession' as any) : t('sidebar.archiveSession' as any)}
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              {/* 删除 */}
                              <DropdownMenuItem
                                onSelect={() => setConfirmDeleteId(session.id)}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 size={14} />
                                {t('sidebar.deleteSession' as any)}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* 标签编辑弹窗（从菜单触发，Portal 渲染在 session item 旁） */}
                        {tagPopoverId === session.id && (
                          <div
                            ref={tagPopoverRef}
                            className="absolute right-0 top-full mt-1 z-50 w-52 rounded-md border border-border bg-popover p-2.5 shadow-md animate-in fade-in-0 zoom-in-95"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5 mb-2">
                              <input
                                type="text"
                                placeholder={t('sidebar.tagInputPlaceholder' as any)}
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && tagInput.trim()) {
                                    addSessionTag(session.id, tagInput.trim())
                                    setTagInput('')
                                  }
                                }}
                                className="flex-1 min-w-0 bg-accent text-[12px] text-foreground placeholder:text-muted-foreground placeholder:opacity-50 border border-transparent focus:border-ring rounded px-2 py-1 outline-none"
                                autoFocus
                              />
                            </div>
                            {session.tags && session.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {session.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className={cn(
                                      'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded-full border leading-4',
                                      getTagColor(tag)
                                    )}
                                  >
                                    {tag}
                                    <button
                                      onClick={() => removeSessionTag(session.id, tag)}
                                      className="hover:opacity-70 ml-0.5"
                                    >
                                      <X size={8} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="border-t border-border pt-1.5">
                              <span className="text-[10px] text-muted-foreground mb-1 block">{t('sidebar.quickAdd' as any)}</span>
                              <div className="flex flex-wrap gap-1">
                                {PRESET_TAGS.filter(
                                  (pt) => !session.tags?.includes(pt)
                                ).map((preset) => (
                                  <button
                                    key={preset}
                                    onClick={() => addSessionTag(session.id, preset)}
                                    className={cn(
                                      'inline-flex items-center text-[10px] px-1.5 py-0 rounded-full border leading-4 opacity-60 hover:opacity-100 transition-opacity',
                                      getTagColor(preset)
                                    )}
                                  >
                                    + {preset}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {/* 已归档区域 */}
          {archivedSessions.length > 0 && (
            <div className="mt-2 border-t border-border pt-2">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-foreground transition-colors duration-150"
              >
                <Archive size={13} className="opacity-60" />
                <span>{t('sidebar.archivedCount' as any, { count: archivedSessions.length })}</span>
                <ChevronRight size={12} className={cn("ml-auto transition-transform duration-150", showArchived && "rotate-90")} />
              </button>
              {showArchived && archivedSessions.map((session) => {
                const isConfirming = confirmDeleteId === session.id
                return (
                  <div key={session.id} className="group relative">
                    {isConfirming ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-destructive/5 mb-0.5">
                        <Trash2 size={12} className="text-destructive flex-shrink-0 opacity-70" />
                        <span className="text-[12px] text-destructive truncate flex-1 opacity-80">
                          {t('sidebar.deleteConfirm')}
                        </span>
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => handleDelete(session.id)}
                        >
                          {t('common.delete')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-foreground"
                        >
                          {t('common.cancel')}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            openTab(session.id, session.title)
                            navigate(`/chat/${session.id}`)
                            if (window.innerWidth < 768) onClose()
                          }}
                          className={cn(
                            'w-full text-left px-2.5 py-2 rounded-lg text-[13px] mb-0.5 flex items-start gap-2.5 transition-colors duration-150',
                            session.id === activeSessionId
                              ? 'bg-accent text-foreground'
                              : 'text-foreground hover:bg-accent'
                          )}
                        >
                          <Archive
                            size={13}
                            className="flex-shrink-0 opacity-40 mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="truncate block flex items-center gap-1.5">
                              {session.title}
                              {streamingSessions.has(session.id) && (
                                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary animate-pulse" title={t('sidebar.chatting' as any)} />
                              )}
                            </span>
                            {session.workingDirectory && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate mt-0.5">
                                <FolderOpen size={10} className="flex-shrink-0" />
                                {session.workingDirectory.split(/[/\\]/).filter(Boolean).pop()}
                              </span>
                            )}
                          </div>
                        </button>
                        {/* 归档会话操作下拉菜单 */}
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 rounded hover:bg-accent/80 text-foreground transition-colors duration-150"
                                aria-label={t('sidebar.sessionActions' as any)}
                              >
                                <MoreHorizontal size={14} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="start" className="w-40">
                              <DropdownMenuItem onSelect={() => {
                                toggleArchiveSession(session.id)
                                toast(t('sidebar.sessionRestored' as any))
                              }}>
                                <ArchiveRestore size={14} className="opacity-60" />
                                {t('sidebar.restoreSession' as any)}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => setConfirmDeleteId(session.id)}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 size={14} />
                                {t('sidebar.deleteSession' as any)}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </nav>
      </ScrollArea>

      {/* 标签云面板 */}
      <TagCloudPanel />

      {/* 底部工具栏 */}
      <div className="flex-shrink-0 border-t border-border">
        <div className="flex items-center justify-around px-2 py-1.5">
          <TooltipProvider delayDuration={300}>
            {/* 会话历史 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    navigate('/sessions')
                    if (window.innerWidth < 768) onClose()
                  }}
                  className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <History size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('sidebar.sessionHistory' as any)}</TooltipContent>
            </Tooltip>

            {/* 消息收藏 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowFavoritesPanel(true)}
                  className="relative p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Star size={16} />
                  {favoritesCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] font-medium bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                      {favoritesCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">消息收藏</TooltipContent>
            </Tooltip>

            {/* 知识库 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    navigate('/knowledge')
                    if (window.innerWidth < 768) onClose()
                  }}
                  className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <BookOpen size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('knowledge.title' as any)}</TooltipContent>
            </Tooltip>

            {/* 插件市场 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    navigate('/marketplace')
                    if (window.innerWidth < 768) onClose()
                  }}
                  className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Store size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('marketplace.title' as any)}</TooltipContent>
            </Tooltip>

            {/* 设置 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    navigate('/settings')
                    if (window.innerWidth < 768) onClose()
                  }}
                  className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Settings size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('common.settings')}</TooltipContent>
            </Tooltip>

            {/* 导入会话 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Upload size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('sidebar.importChat' as any)}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {/* 隐藏的文件选择 input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />
      </div>
    </aside>

    {/* 会话悬浮预览卡片 */}
    {hoverPreview && (
      <SessionPreviewCard
        session={hoverPreview.session}
        rect={hoverPreview.rect}
        summary={summaries.get(hoverPreview.session.id)}
        onMouseEnter={() => {
          // 鼠标进入预览卡片时保持显示
        }}
        onMouseLeave={() => setHoverPreview(null)}
      />
    )}

    {/* 对话预览导出弹窗 */}
    {previewSessionId && (
      <ChatExportPreview
        open={!!previewSessionId}
        onClose={() => setPreviewSessionId(null)}
        sessionId={previewSessionId}
      />
    )}

    {/* 会话分支树视图 */}
    {treeViewSessionId && (
      <SessionTreeView
        sessionId={treeViewSessionId}
        open={!!treeViewSessionId}
        onClose={() => setTreeViewSessionId(null)}
        onNavigate={(targetSessionId) => {
          setTreeViewSessionId(null)
          navigate(`/chat/${targetSessionId}`)
        }}
      />
    )}

    {/* 收藏夹面板 */}
    <FavoritesPanel
      open={showFavoritesPanel}
      onClose={() => setShowFavoritesPanel(false)}
    />
    </>
  )
}

/** 会话悬浮预览卡片：在会话项右侧显示最近消息 */
function SessionPreviewCard({
  session,
  rect,
  summary,
  onMouseEnter,
  onMouseLeave,
}: {
  session: Session
  rect: DOMRect
  summary?: string
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const { t } = useTranslation()
  const { streamingSessions } = useSessionStore()
  // 移动端（宽度 < 768px）不显示悬浮预览
  if (window.innerWidth < 768) return null

  const cardWidth = 320
  const cardMaxHeight = 280

  // 使用侧边栏实际右边界而非会话按钮的 rect.right
  // (Radix ScrollArea 内部 display:table 会让内容宽度超出可视区域)
  const sidebarEl = document.querySelector('aside')
  const sidebarRight = sidebarEl ? sidebarEl.getBoundingClientRect().right : rect.right

  // 计算预览卡片位置：默认在侧边栏右侧
  const top = Math.min(rect.top, window.innerHeight - cardMaxHeight)
  let left = sidebarRight + 8

  // 边界检测：如果右侧放不下，改为显示在侧边栏左侧
  if (left + cardWidth > window.innerWidth) {
    left = (sidebarEl ? sidebarEl.getBoundingClientRect().left : rect.left) - cardWidth - 8
    // 如果左侧也放不下，则贴着视口右边缘显示
    if (left < 0) {
      left = Math.max(4, window.innerWidth - cardWidth - 4)
    }
  }

  const lastMessages = session.messages.slice(-4) // 最近 4 条消息

  return (
    <div
      className="fixed z-[60] w-[320px] max-h-[280px] rounded-xl border border-border bg-popover shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ top, left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 标题栏 */}
      <div className="px-3 py-2 border-b border-border">
        <div className="text-[13px] font-medium truncate flex items-center gap-1.5">
          {session.title}
          {streamingSessions.has(session.id) && (
            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary animate-pulse" title={t('sidebar.chatting' as any)} />
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {t('sidebar.messageCount' as any, { count: session.messages.length })} · {new Date(session.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* 摘要 */}
      {summary && (
        <div className="px-3 py-2 border-b border-border bg-primary/5">
          <div className="flex items-center gap-1.5 mb-1">
            <ScrollText size={11} className="text-primary opacity-70 flex-shrink-0" />
            <span className="text-[10px] font-medium text-primary opacity-80">{t('sidebar.summary' as any)}</span>
          </div>
          <div className="text-[11px] text-foreground leading-relaxed">
            {summary}
          </div>
        </div>
      )}

      {/* 消息预览 */}
      <div className="p-2 space-y-2 overflow-auto max-h-[200px]">
        {lastMessages.length === 0 ? (
          <div className="text-center text-[12px] text-muted-foreground py-4">{t('sidebar.noMessages' as any)}</div>
        ) : (
          lastMessages.map((msg) => (
            <div key={msg.id} className="flex gap-2">
              <div
                className={cn(
                  'w-1 flex-shrink-0 rounded-full',
                  msg.role === 'user' ? 'bg-foreground/30' : 'bg-foreground/15'
                )}
              />
              <div className="text-[11px] text-foreground line-clamp-2">
                {msg.content.slice(0, 100)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 标签 */}
      {session.tags && session.tags.length > 0 && (
        <div className="px-3 py-1.5 border-t border-border flex flex-wrap gap-1">
          {session.tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                'inline-flex items-center text-[10px] px-1.5 py-0 rounded-full border leading-4',
                getTagColor(tag)
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
