import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  FolderOpen,
  MessageSquare,
  MessagesSquare,
  Coins,
  CircleDollarSign,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Clock,
  Bot,
  User,
  Wrench,
  Brain,
  Info,
  Users,
  X,
  Download,
  Check,
  Loader2,
  Terminal,
} from 'lucide-react'
import { useSessionStore, type Session, type Message } from '@/stores/sessionStore'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// ============================================
// Types
// ============================================

interface ProjectInfo {
  name: string
  path: string
  projectPath: string | null
  sessionCount: number
}

interface SessionInfo {
  sessionId: string
  summary: string | null
  firstPrompt: string | null
  messageCount: number | null
  created: string | null
  modified: string | null
  gitBranch: string | null
}

interface SessionEvent {
  type: string
  timestamp?: string
  content?: string
  role?: string
  toolName?: string
  toolInput?: any
  toolResult?: string
  agentType?: string
  agentId?: string
  thinkingContent?: string
  model?: string
  usage?: { input_tokens: number; output_tokens: number }
  isSidechain?: boolean
}

interface AgentInfo {
  agentId: string
  agentType: string | null
  eventCount: number
  fileSize: number
}

// ============================================
// Helpers
// ============================================

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  if (isNaN(then)) return dateStr

  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`
  if (days < 365) return `${Math.floor(days / 30)} 个月前`
  return `${Math.floor(days / 365)} 年前`
}

function formatEventTime(timestamp?: string): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function truncate(text: string, maxLen: number): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

/** 格式化大数值：超过 100万 显示 M，超过 1000 显示 k */
function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toString()
}

/** 格式化费用：带 $ 前缀 */
function formatCost(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`
  if (value >= 0.01) return `$${value.toFixed(3)}`
  if (value > 0) return `$${value.toFixed(4)}`
  return '$0.00'
}

/** 将项目目录名（如 D--git-hub-ClaudeCodeChat）转成可读名称 */
function projectDisplayName(project: ProjectInfo): string {
  if (project.projectPath) {
    return project.projectPath.split(/[\\/]/).pop() || project.name
  }
  // 编码规则有损（- 既是路径分隔也可能是名称连字符），用 -- 拆分取最后一段
  // D--git-hub-ClaudeCodeChat → ["D", "git-hub-ClaudeCodeChat"] → "git-hub-ClaudeCodeChat"
  const segments = project.name.split('--').filter(Boolean)
  return segments.length > 1 ? segments.slice(1).join(' / ') : project.name
}

/** 获取项目完整路径提示 */
function projectFullPath(project: ProjectInfo): string {
  if (project.projectPath) return project.projectPath
  // 近似还原：X-- → X:\，-- → \
  return project.name.replace(/^([A-Za-z])--/, '$1:\\').replace(/--/g, '\\')
}

// ============================================
// Stats Dashboard — 统计仪表盘
// ============================================

/** 单个统计卡片 */
function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
      <Icon size={16} className="text-primary opacity-70" />
      <div className="font-mono font-bold text-[20px] leading-none text-foreground">
        {value}
      </div>
      <div className="text-[12px] text-muted-foreground">{label}</div>
    </div>
  )
}

/** 统计仪表盘：汇总 Zustand store 中所有会话的数据 */
function StatsDashboard() {
  const sessions = useSessionStore((s) => s.sessions)

  const stats = useMemo(() => {
    let totalMessages = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0

    for (const session of sessions) {
      totalMessages += session.messages.length
      for (const msg of session.messages) {
        if (msg.tokenUsage) {
          totalInputTokens += msg.tokenUsage.inputTokens
          totalOutputTokens += msg.tokenUsage.outputTokens
        }
      }
    }

    const totalTokens = totalInputTokens + totalOutputTokens
    // Sonnet 费率：$3 / 1M input tokens, $15 / 1M output tokens
    const estimatedCost =
      (totalInputTokens / 1_000_000) * 3 + (totalOutputTokens / 1_000_000) * 15

    return {
      sessionCount: sessions.length,
      totalMessages,
      totalTokens,
      estimatedCost,
    }
  }, [sessions])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-3">
      <StatCard
        icon={MessageSquare}
        label="总会话数"
        value={formatNumber(stats.sessionCount)}
      />
      <StatCard
        icon={MessagesSquare}
        label="总消息数"
        value={formatNumber(stats.totalMessages)}
      />
      <StatCard
        icon={Coins}
        label="总 Token 用量"
        value={formatNumber(stats.totalTokens)}
      />
      <StatCard
        icon={CircleDollarSign}
        label="估算总费用"
        value={formatCost(stats.estimatedCost)}
      />
    </div>
  )
}

// ============================================
// Activity Chart — 每日消息活跃度柱状图
// ============================================

/** 最近 14 天每天的消息数量柱状图 */
function ActivityChart({ sessions }: { sessions: Session[] }) {
  // 计算最近 14 天每天的消息数量
  const dailyData = useMemo(() => {
    const days: { date: string; count: number }[] = []
    const now = new Date()

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`

      let count = 0
      for (const session of sessions) {
        for (const msg of session.messages) {
          const msgDate = new Date(msg.timestamp)
          if (
            msgDate.getFullYear() === d.getFullYear() &&
            msgDate.getMonth() === d.getMonth() &&
            msgDate.getDate() === d.getDate()
          ) {
            count++
          }
        }
      }

      days.push({ date: dateStr, count })
    }

    return days
  }, [sessions])

  const maxCount = Math.max(...dailyData.map((d) => d.count), 1)

  return (
    <div className="space-y-2">
      <h3 className="text-[13px] font-medium text-foreground">消息活跃度（近 14 天）</h3>
      <div className="flex items-end gap-1 h-[100px]">
        {dailyData.map((day, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors min-h-[2px]"
              style={{ height: `${(day.count / maxCount) * 80}px` }}
              title={`${day.date}: ${day.count} 条消息`}
            />
            <span className="text-[9px] text-muted-foreground">{day.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// Message Distribution Chart — 消息角色分布饼图（纯 SVG）
// ============================================

/** 用户消息与 Claude 回复的消息角色分布饼图 */
function MessageDistributionChart({ sessions }: { sessions: Session[] }) {
  // 统计各角色的消息数量
  const data = useMemo(() => {
    let userMessages = 0
    let assistantMessages = 0

    for (const session of sessions) {
      for (const msg of session.messages) {
        if (msg.role === 'user') {
          userMessages++
        } else {
          assistantMessages++
        }
      }
    }

    return [
      { label: '用户消息', count: userMessages, color: '#3b82f6' },
      { label: 'Claude 回复', count: assistantMessages, color: '#a855f7' },
    ]
  }, [sessions])

  const total = data.reduce((sum, d) => sum + d.count, 0)
  if (total === 0) return null

  // SVG 饼图路径计算
  let currentAngle = 0
  const paths = data.map((d) => {
    const angle = (d.count / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const startRad = ((startAngle - 90) * Math.PI) / 180
    const endRad = ((endAngle - 90) * Math.PI) / 180

    const x1 = 50 + 40 * Math.cos(startRad)
    const y1 = 50 + 40 * Math.sin(startRad)
    const x2 = 50 + 40 * Math.cos(endRad)
    const y2 = 50 + 40 * Math.sin(endRad)

    const largeArc = angle > 180 ? 1 : 0

    return {
      d: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`,
      fill: d.color,
      label: d.label,
      count: d.count,
      percent: ((d.count / total) * 100).toFixed(1),
    }
  })

  return (
    <div className="space-y-2">
      <h3 className="text-[13px] font-medium text-foreground">消息分布</h3>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="w-[80px] h-[80px]">
          {paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill={p.fill}
              className="opacity-80 hover:opacity-100 transition-opacity"
            />
          ))}
        </svg>
        <div className="space-y-1.5">
          {paths.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: p.fill }}
              />
              <span className="text-muted-foreground">{p.label}</span>
              <span className="text-foreground font-medium">{p.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Collapsible Section
// ============================================

function CollapsibleSection({
  label,
  badge,
  children,
  defaultOpen = false,
}: {
  label: string
  badge?: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card/30">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:bg-accent/50 transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>{label}</span>
        {badge && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-auto">
            {badge}
          </Badge>
        )}
      </button>
      {open && (
        <div className="px-3 pb-2.5 pt-0.5 text-[12px] text-foreground whitespace-pre-wrap break-words">
          {children}
        </div>
      )}
    </div>
  )
}

// ============================================
// Event Timeline Item
// ============================================

function EventItem({ event }: { event: SessionEvent }) {
  const time = formatEventTime(event.timestamp)

  // Tool use (先于 role 判断，因为 tool_use 可能有 role='assistant')
  if (event.type === 'tool_use') {
    return (
      <div className="mb-2 animate-fade-in">
        <CollapsibleSection
          label="工具调用"
          badge={event.toolName}
        >
          <div className="text-[11px] text-muted-foreground font-mono">
            {truncate(
              typeof event.toolInput === 'object'
                ? JSON.stringify(event.toolInput, null, 2)
                : event.toolInput || event.content || '',
              500
            )}
          </div>
        </CollapsibleSection>
        {time && <div className="text-[10px] text-muted-foreground mt-0.5 ml-3">{time}</div>}
      </div>
    )
  }

  // Tool result (先于 role 判断)
  if (event.type === 'tool_result') {
    return (
      <div className="mb-2 animate-fade-in">
        <CollapsibleSection label="工具结果">
          <div className="text-[11px] text-muted-foreground font-mono">
            {truncate(event.toolResult || event.content || '', 500)}
          </div>
        </CollapsibleSection>
        {time && <div className="text-[10px] text-muted-foreground mt-0.5 ml-3">{time}</div>}
      </div>
    )
  }

  // User message
  if (event.type === 'user' || event.role === 'user') {
    return (
      <div className="flex justify-end mb-3 animate-fade-in">
        <div className="max-w-[80%] flex items-start gap-2">
          {time && <span className="text-[10px] text-muted-foreground mt-2.5 flex-shrink-0">{time}</span>}
          <div className="bg-primary/15 rounded-2xl rounded-br-sm px-3.5 py-2 border border-border">
            <div className="text-[13px] text-foreground whitespace-pre-wrap break-words leading-[1.65]">
              {event.content || ''}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Assistant message
  if (event.type === 'assistant' || event.role === 'assistant') {
    return (
      <div className="flex gap-2.5 mb-3 animate-fade-in">
        <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] flex items-center justify-center mt-0.5">
          <Bot size={11} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-foreground break-words leading-[1.7] markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {event.content || ''}
            </ReactMarkdown>
          </div>
          {time && <div className="text-[10px] text-muted-foreground mt-1">{time}</div>}
        </div>
      </div>
    )
  }

  // Thinking
  if (event.type === 'thinking') {
    return (
      <div className="mb-2 animate-fade-in">
        <CollapsibleSection label="思考过程">
          <div className="text-[12px] text-muted-foreground italic leading-relaxed">
            {event.thinkingContent || event.content || ''}
          </div>
        </CollapsibleSection>
        {time && <div className="text-[10px] text-muted-foreground mt-0.5 ml-3">{time}</div>}
      </div>
    )
  }

  // Agent progress
  if (event.type === 'agent_progress' || event.type === 'agent') {
    const agentColor = event.agentType === 'Explore'
      ? 'bg-blue-500/15 text-blue-400/80 border-blue-500/30'
      : event.agentType === 'Plan'
        ? 'bg-purple-500/15 text-purple-400/80 border-purple-500/30'
        : 'bg-primary/15 text-primary border-primary/30'

    return (
      <div className="mb-2 animate-fade-in">
        <Card className="bg-card/40 border-border rounded-xl">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Users size={12} className="text-muted-foreground" />
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 border', agentColor)}>
                {event.agentType || '子代理'}
              </Badge>
              {event.agentId && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {event.agentId.slice(0, 8)}
                </span>
              )}
              {time && <span className="text-[10px] text-muted-foreground ml-auto">{time}</span>}
            </div>
            <div className="text-[12px] text-foreground whitespace-pre-wrap break-words">
              {truncate(event.content || '', 300)}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // System / other events
  return (
    <div className="flex justify-center mb-2 animate-fade-in">
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent/30">
        <Info size={10} className="text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">
          {event.type}: {truncate(event.content || '', 100)}
        </span>
        {time && <span className="text-[10px] text-muted-foreground">{time}</span>}
      </div>
    </div>
  )
}

// ============================================
// Agent Transcript Modal
// ============================================

function AgentTranscriptModal({
  agent,
  projectDir,
  sessionId,
  onClose,
}: {
  agent: AgentInfo
  projectDir: string
  sessionId: string
  onClose: () => void
}) {
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/sessions/${encodeURIComponent(projectDir)}/${sessionId}/agents/${agent.agentId}`)
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || data.transcript || [])
      })
      .catch(() => {
        setEvents([])
      })
      .finally(() => setLoading(false))
  }, [projectDir, sessionId, agent.agentId])

  const agentColor = agent.agentType === 'Explore'
    ? 'bg-blue-500/15 text-blue-400/80'
    : agent.agentType === 'Plan'
      ? 'bg-purple-500/15 text-purple-400/80'
      : 'bg-primary/15 text-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <Card
        className="w-[700px] max-w-[90vw] max-h-[80vh] flex flex-col bg-card border-border rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Users size={15} className="text-muted-foreground" />
            <span className="text-[13px] font-medium text-foreground">子代理详情</span>
            <Badge variant="secondary" className={cn('text-[10px]', agentColor)}>
              {agent.agentType || '未知类型'}
            </Badge>
            <span className="text-[11px] text-muted-foreground font-mono">
              {agent.agentId.slice(0, 12)}
            </span>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose} className="text-foreground">
            <X size={14} />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground">加载中...</div>
          ) : events.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground">暂无事件记录</div>
          ) : (
            <div className="space-y-1">
              {events.map((event, i) => (
                <EventItem key={i} event={event} />
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  )
}

// ============================================
// CLI Import Dialog
// ============================================

interface CliSessionForImport {
  sessionId: string
  summary: string | null
  firstPrompt: string | null
  messageCount: number | null
  created: string | null
  modified: string | null
  gitBranch: string | null
  selected?: boolean
}

function CliImportDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const importSession = useSessionStore((s) => s.importSession)

  const [step, setStep] = useState<'projects' | 'sessions' | 'importing'>('projects')
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null)
  const [cliSessions, setCliSessions] = useState<CliSessionForImport[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [importingCount, setImportingCount] = useState(0)
  const [importedCount, setImportedCount] = useState(0)

  // Load projects on mount
  useEffect(() => {
    setLoadingProjects(true)
    fetch('/api/sessions/projects')
      .then((res) => res.json())
      .then((data: { projects: ProjectInfo[] }) => {
        setProjects((data.projects || []).filter((p) => p.sessionCount > 0))
      })
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false))
  }, [])

  // Load sessions when project selected
  const handleSelectProject = useCallback((project: ProjectInfo) => {
    setSelectedProject(project)
    setStep('sessions')
    setLoadingSessions(true)
    fetch(`/api/sessions/${encodeURIComponent(project.name)}`)
      .then((res) => res.json())
      .then((data: { sessions: CliSessionForImport[] }) => {
        setCliSessions((data.sessions || []).map((s) => ({ ...s, selected: false })))
      })
      .catch(() => setCliSessions([]))
      .finally(() => setLoadingSessions(false))
  }, [])

  // Toggle session selection
  const toggleSession = useCallback((sessionId: string) => {
    setCliSessions((prev) =>
      prev.map((s) => (s.sessionId === sessionId ? { ...s, selected: !s.selected } : s))
    )
  }, [])

  // Select/deselect all
  const toggleAll = useCallback(() => {
    const allSelected = cliSessions.every((s) => s.selected)
    setCliSessions((prev) => prev.map((s) => ({ ...s, selected: !allSelected })))
  }, [cliSessions])

  const selectedCount = cliSessions.filter((s) => s.selected).length

  // Import selected sessions
  const handleImport = useCallback(async () => {
    if (!selectedProject) return

    const toImport = cliSessions.filter((s) => s.selected)
    if (toImport.length === 0) {
      toast.error('请先选择要导入的会话')
      return
    }

    setStep('importing')
    setImportingCount(toImport.length)
    setImportedCount(0)

    let successCount = 0
    let lastImportedSessionId: string | null = null

    for (const cliSession of toImport) {
      try {
        // Fetch full session events
        const res = await fetch(
          `/api/sessions/${encodeURIComponent(selectedProject.name)}/${cliSession.sessionId}?limit=1000&types=user,assistant`
        )
        const data = await res.json()
        const events: SessionEvent[] = data.events || []

        // Convert CLI events to app messages
        const messages: Message[] = []
        for (const event of events) {
          if (event.type === 'user' && event.content) {
            messages.push({
              id: crypto.randomUUID(),
              role: 'user',
              content: event.content,
              timestamp: event.timestamp ? new Date(event.timestamp).getTime() : Date.now(),
            })
          } else if (event.type === 'assistant' && event.content) {
            messages.push({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: event.content,
              timestamp: event.timestamp ? new Date(event.timestamp).getTime() : Date.now(),
              tokenUsage: event.usage
                ? { inputTokens: event.usage.input_tokens, outputTokens: event.usage.output_tokens }
                : undefined,
            })
          }
        }

        if (messages.length === 0) {
          setImportedCount((c) => c + 1)
          continue
        }

        // Create session object
        const title = cliSession.summary
          || (cliSession.firstPrompt ? truncate(cliSession.firstPrompt, 50) : null)
          || `CLI 导入 - ${new Date(cliSession.modified || cliSession.created || '').toLocaleDateString('zh-CN')}`

        const session: Session = {
          id: crypto.randomUUID(),
          title,
          messages,
          createdAt: cliSession.created ? new Date(cliSession.created).getTime() : Date.now(),
          tags: ['CLI 导入'],
        }

        importSession(session)
        lastImportedSessionId = session.id
        successCount++
      } catch (err) {
        console.error(`导入会话 ${cliSession.sessionId} 失败:`, err)
      }

      setImportedCount((c) => c + 1)
    }

    if (successCount > 0) {
      toast.success(`成功导入 ${successCount} 个会话`)
      // Navigate to the last imported session
      if (lastImportedSessionId) {
        navigate(`/chat/${lastImportedSessionId}`)
      }
    } else {
      toast.error('未能导入任何会话')
    }
    onClose()
  }, [selectedProject, cliSessions, importSession, navigate, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col bg-card border-border rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Terminal size={15} className="text-primary" />
            <span className="text-[14px] font-medium text-foreground">从 CLI 历史导入</span>
            {step === 'sessions' && selectedProject && (
              <Badge variant="secondary" className="text-[10px]">
                {projectDisplayName(selectedProject)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === 'sessions' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStep('projects'); setSelectedProject(null); setCliSessions([]) }}
                className="text-[12px] text-muted-foreground"
              >
                <ArrowLeft size={12} />
                返回
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="text-foreground"
            >
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          {step === 'projects' && (
            <div className="p-4 space-y-2">
              <p className="text-[12px] text-muted-foreground mb-3">
                选择一个项目来浏览其 CLI 对话历史：
              </p>
              {loadingProjects ? (
                <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  加载项目列表...
                </div>
              ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Terminal size={24} className="text-muted-foreground opacity-20 mb-3" />
                  <p className="text-[13px] text-muted-foreground">
                    未找到 CLI 对话历史
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    请先在命令行中使用 Claude Code 创建一些对话
                  </p>
                </div>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => handleSelectProject(p)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-accent/50 border border-transparent hover:border-border transition-colors"
                  >
                    <FolderOpen size={16} className="text-primary opacity-60 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-foreground font-medium truncate">
                        {projectDisplayName(p)}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {projectFullPath(p)}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                      {p.sessionCount} 个会话
                    </Badge>
                    <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}

          {step === 'sessions' && (
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] text-muted-foreground">
                  勾选要导入的会话 ({selectedCount}/{cliSessions.length})：
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAll}
                  className="text-[11px] text-muted-foreground"
                >
                  {cliSessions.every((s) => s.selected) ? '取消全选' : '全选'}
                </Button>
              </div>
              {loadingSessions ? (
                <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  加载会话列表...
                </div>
              ) : cliSessions.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground">
                  该项目下暂无会话记录
                </div>
              ) : (
                cliSessions.map((s) => (
                  <button
                    key={s.sessionId}
                    onClick={() => toggleSession(s.sessionId)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-colors',
                      s.selected
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-accent/50 border border-transparent'
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors',
                        s.selected
                          ? 'bg-primary border-primary'
                          : 'border-border'
                      )}
                    >
                      {s.selected && <Check size={12} className="text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-foreground truncate leading-snug">
                        {s.summary || truncate(s.firstPrompt || '', 60) || '(无标题)'}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {s.messageCount != null && (
                          <span className="text-[10px] text-muted-foreground">
                            {s.messageCount} 条消息
                          </span>
                        )}
                        {s.gitBranch && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 gap-0.5 border-border text-muted-foreground">
                            <GitBranch size={8} />
                            {truncate(s.gitBranch, 12)}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatRelativeTime(s.modified || s.created || '')}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <Loader2 size={28} className="animate-spin text-primary mb-4" />
              <p className="text-[14px] text-foreground font-medium mb-2">
                正在导入会话...
              </p>
              <p className="text-[12px] text-muted-foreground">
                {importedCount} / {importingCount} 已完成
              </p>
              <div className="w-48 h-1.5 mt-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${importingCount > 0 ? (importedCount / importingCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer with import button */}
        {step === 'sessions' && selectedCount > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-[12px] text-muted-foreground">
              已选择 {selectedCount} 个会话
            </span>
            <Button size="sm" onClick={handleImport} className="text-[12px] gap-1.5">
              <Download size={13} />
              导入选中会话
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

// ============================================
// Main SessionsPage
// ============================================

export default function SessionsPage() {
  const navigate = useNavigate()
  // 从 Zustand store 获取会话数据，用于统计图表
  const storeSessions = useSessionStore((s) => s.sessions)

  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([])
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)

  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [loadingAgents, setLoadingAgents] = useState(false)

  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const [showAgentTab, setShowAgentTab] = useState(false)
  const [showCliImport, setShowCliImport] = useState(false)

  // Load projects
  useEffect(() => {
    setLoadingProjects(true)
    fetch('/api/sessions/projects')
      .then((res) => res.json())
      .then((data: { projects: ProjectInfo[] }) => {
        // 过滤掉没有会话的项目
        const list = (data.projects || []).filter((p) => p.sessionCount > 0)
        setProjects(list)
        if (list.length > 0) {
          setSelectedProject(list[0].name)
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false))
  }, [])

  // Load sessions when project changes
  useEffect(() => {
    if (!selectedProject) {
      setSessions([])
      return
    }
    setLoadingSessions(true)
    setSelectedSessionId(null)
    setSessionEvents([])
    setAgents([])
    fetch(`/api/sessions/${encodeURIComponent(selectedProject)}`)
      .then((res) => res.json())
      .then((data: { sessions: SessionInfo[] }) => {
        setSessions(data.sessions || [])
      })
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false))
  }, [selectedProject])

  // Load session detail when session selected
  const loadSessionDetail = useCallback(
    (sessionId: string) => {
      if (!selectedProject) return
      setSelectedSessionId(sessionId)
      setLoadingEvents(true)
      setLoadingAgents(true)
      setShowAgentTab(false)

      fetch(`/api/sessions/${encodeURIComponent(selectedProject)}/${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          setSessionEvents(Array.isArray(data.events) ? data.events : [])
        })
        .catch(() => setSessionEvents([]))
        .finally(() => setLoadingEvents(false))

      fetch(`/api/sessions/${encodeURIComponent(selectedProject)}/${sessionId}/agents`)
        .then((res) => res.json())
        .then((data: { agents: AgentInfo[] }) => {
          setAgents(data.agents || [])
        })
        .catch(() => setAgents([]))
        .finally(() => setLoadingAgents(false))
    },
    [selectedProject]
  )

  const selectedProjectInfo = projects.find((p) => p.name === selectedProject)
  const selectedProjectName = selectedProjectInfo
    ? projectDisplayName(selectedProjectInfo)
    : '选择项目'

  return (
    <div className="flex h-full">
      {/* 左侧面板 */}
      <div className="w-[300px] flex-shrink-0 flex flex-col border-r border-border bg-card/30">
        {/* 头部 */}
        <div className="h-[52px] flex items-center gap-2.5 px-4 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => navigate('/')}
            className="text-foreground"
          >
            <ArrowLeft size={16} />
          </Button>
          <Clock size={15} className="text-primary opacity-70" />
          <span className="text-[14px] font-semibold text-foreground">会话历史</span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCliImport(true)}
            className="text-[11px] gap-1.5 h-7"
          >
            <Download size={12} />
            从 CLI 导入
          </Button>
        </div>

        <Separator />

        {/* 项目选择器 */}
        <div className="px-3 py-2.5 relative">
          <button
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-accent/50 border border-border hover:border-primary/50 transition-colors text-left"
          >
            <FolderOpen size={13} className="text-primary opacity-70 flex-shrink-0" />
            <span className="text-[13px] text-foreground truncate flex-1">{selectedProjectName}</span>
            <ChevronDown
              size={12}
              className={cn('text-muted-foreground transition-transform', showProjectDropdown && 'rotate-180')}
            />
          </button>

          {showProjectDropdown && (
            <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-lg py-1 max-h-[240px] overflow-y-auto">
              {loadingProjects ? (
                <div className="px-3 py-4 text-[12px] text-muted-foreground text-center">加载中...</div>
              ) : projects.length === 0 ? (
                <div className="px-3 py-4 text-[12px] text-muted-foreground text-center">暂无项目</div>
              ) : (
                projects.map((p) => {
                  return (
                    <button
                      key={p.name}
                      onClick={() => {
                        setSelectedProject(p.name)
                        setShowProjectDropdown(false)
                      }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/50 transition-colors',
                        selectedProject === p.name && 'bg-accent text-primary'
                      )}
                      title={projectFullPath(p)}
                    >
                      <FolderOpen size={12} className={cn('flex-shrink-0', selectedProject === p.name ? 'text-primary' : 'text-muted-foreground')} />
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] truncate block">{projectDisplayName(p)}</span>
                        <span className="text-[10px] text-muted-foreground truncate block">{projectFullPath(p)}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                        {p.sessionCount}
                      </Badge>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* 会话列表 */}
        <ScrollArea className="flex-1 px-2 py-1.5">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground">加载中...</div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <MessageSquare size={20} className="text-muted-foreground mb-2" />
              <span className="text-[12px] text-muted-foreground">暂无会话记录</span>
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.sessionId}
                onClick={() => loadSessionDetail(s.sessionId)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-colors duration-150',
                  selectedSessionId === s.sessionId
                    ? 'bg-accent border border-primary/30'
                    : 'hover:bg-accent/50 border border-transparent'
                )}
              >
                <div className="text-[13px] text-foreground truncate leading-snug">
                  {s.summary || truncate(s.firstPrompt || '', 50) || '(无标题)'}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {s.messageCount != null && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                      <MessageSquare size={9} />
                      {s.messageCount}
                    </Badge>
                  )}
                  {s.gitBranch && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 border-border text-muted-foreground">
                      <GitBranch size={9} />
                      {truncate(s.gitBranch, 15)}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                    {formatRelativeTime(s.modified || s.created || '')}
                  </span>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* 右侧面板 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 统计仪表盘 — 始终显示在右侧面板顶部 */}
        <StatsDashboard />
        {/* 统计图表 — 活跃度 & 消息分布 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 px-4">
          <Card>
            <CardContent className="p-4">
              <ActivityChart sessions={storeSessions} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <MessageDistributionChart sessions={storeSessions} />
            </CardContent>
          </Card>
        </div>
        <Separator className="mt-4" />

        {!selectedSessionId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center animate-fade-in">
              <Clock size={32} className="text-muted-foreground opacity-20 mx-auto mb-3" />
              <p className="text-[13px] text-muted-foreground">选择一个会话查看详情</p>
            </div>
          </div>
        ) : (
          <>
            {/* 顶部标签 */}
            {agents.length > 0 && (
              <div className="flex items-center gap-1 px-4 pt-3 pb-1">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowAgentTab(false)}
                  className={cn(
                    'text-[12px]',
                    !showAgentTab ? 'text-primary bg-primary/10' : 'text-muted-foreground'
                  )}
                >
                  <MessageSquare size={12} />
                  事件记录
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowAgentTab(true)}
                  className={cn(
                    'text-[12px] gap-1.5',
                    showAgentTab ? 'text-primary bg-primary/10' : 'text-muted-foreground'
                  )}
                >
                  <Users size={12} />
                  子代理
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 ml-0.5">
                    {agents.length}
                  </Badge>
                </Button>
              </div>
            )}

            {/* 内容区域 */}
            {!showAgentTab ? (
              <ScrollArea className="flex-1">
                <div className="max-w-[960px] mx-auto px-5 pt-4 pb-6">
                  {loadingEvents ? (
                    <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground">加载中...</div>
                  ) : sessionEvents.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground">暂无事件记录</div>
                  ) : (
                    sessionEvents.map((event, i) => <EventItem key={i} event={event} />)
                  )}
                </div>
              </ScrollArea>
            ) : (
              <ScrollArea className="flex-1">
                <div className="max-w-[960px] mx-auto px-5 pt-4 pb-6">
                  {loadingAgents ? (
                    <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground">加载中...</div>
                  ) : agents.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground">暂无子代理</div>
                  ) : (
                    <div className="space-y-2">
                      {agents.map((agent) => {
                        const agentColor = agent.agentType === 'Explore'
                          ? 'bg-blue-500/15 text-blue-400/80 border-blue-500/30'
                          : agent.agentType === 'Plan'
                            ? 'bg-purple-500/15 text-purple-400/80 border-purple-500/30'
                            : 'bg-primary/15 text-primary border-primary/30'

                        return (
                          <Card
                            key={agent.agentId}
                            className="bg-card/50 rounded-xl cursor-pointer hover:border-primary/40 transition-colors"
                            onClick={() => setSelectedAgent(agent)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                                  <Users size={15} className="text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 border', agentColor)}>
                                      {agent.agentType || '未知'}
                                    </Badge>
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                      {agent.agentId.slice(0, 12)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                      {agent.eventCount} 条事件
                                    </Badge>
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground">
                                      {(agent.fileSize / 1024).toFixed(0)} KB
                                    </Badge>
                                  </div>
                                </div>
                                <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </>
        )}
      </div>

      {/* Agent transcript modal */}
      {selectedAgent && selectedProject && selectedSessionId && (
        <AgentTranscriptModal
          agent={selectedAgent}
          projectDir={selectedProject}
          sessionId={selectedSessionId}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {/* CLI Import dialog */}
      {showCliImport && (
        <CliImportDialog onClose={() => setShowCliImport(false)} />
      )}
    </div>
  )
}
