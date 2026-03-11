import { useState } from 'react'
import { Users, ChevronDown, ChevronUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

// ============================================
// Types
// ============================================

export interface AgentState {
  agentId: string
  agentType: string
  prompt: string
  content: string
  status: 'running' | 'done'
}

// ============================================
// Agent Card
// ============================================

function AgentCard({
  agent,
  isExpanded,
  onToggle,
}: {
  agent: AgentState
  isExpanded: boolean
  onToggle: () => void
}) {
  const agentColor = agent.agentType === 'Explore'
    ? 'bg-blue-500/15 text-blue-400/80 border-blue-500/30'
    : agent.agentType === 'Plan'
      ? 'bg-purple-500/15 text-purple-400/80 border-purple-500/30'
      : 'bg-primary/15 text-primary border-primary/30'

  const shortId = agent.agentId.slice(0, 8)

  return (
    <div className="flex-shrink-0">
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-t-lg border border-b-0 border-border transition-colors text-left',
          isExpanded ? 'bg-card' : 'bg-card/50 hover:bg-card/80'
        )}
      >
        {/* 状态指示 */}
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            agent.status === 'running'
              ? 'bg-green-400/80 shadow-[0_0_3px_rgba(74,222,128,0.3)] animate-agent-pulse'
              : 'bg-muted-foreground/50'
          )}
        />

        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 border', agentColor)}>
          {agent.agentType}
        </Badge>

        <span className="text-[11px] text-muted-foreground font-mono">{shortId}</span>

        {isExpanded ? (
          <ChevronDown size={11} className="text-muted-foreground" />
        ) : (
          <ChevronUp size={11} className="text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <Card className="rounded-tl-none rounded-tr-none rounded-b-xl border-border bg-card animate-fade-in">
          <CardContent className="p-3">
            <ScrollArea className="max-h-[200px]">
              <div className="text-[12px] text-foreground whitespace-pre-wrap break-words leading-relaxed font-mono">
                {agent.content || (
                  <span className="text-muted-foreground italic">
                    {agent.status === 'running' ? '等待输出...' : '无输出内容'}
                  </span>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================
// AgentTeamsPanel
// ============================================

export default function AgentTeamsPanel({ agents }: { agents: Map<string, AgentState> }) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  const agentList = Array.from(agents.values())

  if (agentList.length === 0) return null

  const runningCount = agentList.filter((a) => a.status === 'running').length

  return (
    <div className="flex-shrink-0 border-t border-border bg-card/20">
      {/* 标题栏 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-accent/30 transition-colors"
      >
        <Users size={13} className="text-primary opacity-70" />
        <span className="text-[12px] font-medium text-foreground">子代理</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
          {agentList.length}
        </Badge>
        {runningCount > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-green-500/15 text-green-400/80 gap-0.5">
            <span className="w-1 h-1 rounded-full bg-green-400/80 animate-agent-pulse" />
            {runningCount} 运行中
          </Badge>
        )}
        <div className="flex-1" />
        {collapsed ? (
          <ChevronUp size={12} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={12} className="text-muted-foreground" />
        )}
      </button>

      {/* 代理卡片列表 */}
      {!collapsed && (
        <div className="px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {agentList.map((agent) => (
              <AgentCard
                key={agent.agentId}
                agent={agent}
                isExpanded={expandedAgent === agent.agentId}
                onToggle={() =>
                  setExpandedAgent(expandedAgent === agent.agentId ? null : agent.agentId)
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
