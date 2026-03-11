import { useEffect, useCallback, useMemo, useState } from 'react'
import {
  X, Coins, ArrowDownRight, ArrowUpRight, Equal, MessageSquare, Bot,
  TrendingUp, BarChart3, DollarSign, Calendar,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Session, Message } from '@/stores/sessionStore'
import { useSessionStore } from '@/stores/sessionStore'

interface CostPanelProps {
  open: boolean
  onClose: () => void
  session: Session | undefined
}

/** 格式化数字为千位分隔符形式 */
function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

/** 格式化美元金额 */
function formatUSD(amount: number): string {
  if (amount < 0.01) return '<$0.01'
  return `$${amount.toFixed(2)}`
}

/** 格式化人民币金额 */
function formatCNY(amount: number): string {
  const cny = amount * USD_TO_CNY
  if (cny < 0.01) return '<¥0.01'
  return `¥${cny.toFixed(2)}`
}

/** 格式化紧凑数字 */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

// 固定汇率
const USD_TO_CNY = 7.2

// 费率定义（每百万 tokens 的美元价格）
const PRICING: Record<string, { input: number; output: number; label: string }> = {
  sonnet: { input: 3, output: 15, label: 'Sonnet' },
  opus: { input: 15, output: 75, label: 'Opus' },
  haiku: { input: 0.25, output: 1.25, label: 'Haiku' },
}

type TabId = 'session' | 'overview' | 'trend'

/** 计算单个会话的 token 统计 */
function computeSessionTokens(messages: Message[]) {
  let inputTokens = 0
  let outputTokens = 0
  let userMsgCount = 0
  let assistantMsgCount = 0
  for (const msg of messages) {
    if (msg.role === 'user') userMsgCount++
    else if (msg.role === 'assistant') assistantMsgCount++
    if (msg.tokenUsage) {
      inputTokens += msg.tokenUsage.inputTokens
      outputTokens += msg.tokenUsage.outputTokens
    }
  }
  return { inputTokens, outputTokens, total: inputTokens + outputTokens, userMsgCount, assistantMsgCount }
}

/** 估算费用 */
function estimateCost(inputTokens: number, outputTokens: number, pricingKey: string) {
  const rate = PRICING[pricingKey]
  if (!rate) return 0
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output
}

export default function CostPanel({ open, onClose, session }: CostPanelProps) {
  const sessions = useSessionStore(s => s.sessions)
  const [activeTab, setActiveTab] = useState<TabId>('session')

  // Escape 键关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <Card className="w-[540px] max-w-[95vw] max-h-[85vh] border-border shadow-2xl bg-card flex flex-col">
        <CardHeader className="pb-0 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins size={18} className="text-primary" />
              <CardTitle className="text-base">Token 用量与费用分析</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="text-foreground"
            >
              <X size={16} />
            </Button>
          </div>
          {/* 标签页切换 */}
          <div className="flex gap-1 mt-3 border-b border-border">
            <TabButton
              active={activeTab === 'session'}
              onClick={() => setActiveTab('session')}
              icon={<MessageSquare size={13} />}
              label="当前会话"
            />
            <TabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              icon={<BarChart3 size={13} />}
              label="会话对比"
            />
            <TabButton
              active={activeTab === 'trend'}
              onClick={() => setActiveTab('trend')}
              icon={<TrendingUp size={13} />}
              label="使用趋势"
            />
          </div>
        </CardHeader>

        <CardContent className="overflow-y-auto flex-1 min-h-0">
          {activeTab === 'session' && <SessionTab session={session} />}
          {activeTab === 'overview' && <OverviewTab sessions={sessions} />}
          {activeTab === 'trend' && <TrendTab sessions={sessions} />}
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== 标签页按钮 ====================

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

// ==================== Tab 1: 当前会话详情 ====================

function SessionTab({ session }: { session: Session | undefined }) {
  const stats = useMemo(() => {
    if (!session) return null
    return computeSessionTokens(session.messages)
  }, [session])

  if (!session || !stats) {
    return (
      <div className="py-8 text-center text-muted-foreground text-[13px]">
        未选择会话
      </div>
    )
  }

  const estimates = Object.entries(PRICING).map(([key, rate]) => {
    const cost =
      (stats.inputTokens / 1_000_000) * rate.input +
      (stats.outputTokens / 1_000_000) * rate.output
    return { key, label: rate.label, cost }
  })

  // Token 输入/输出比例条
  const inputRatio = stats.total > 0 ? (stats.inputTokens / stats.total) * 100 : 50

  return (
    <div className="space-y-5">
      {/* 会话标题 */}
      <p className="text-[12px] text-muted-foreground truncate">
        会话：{session.title}
      </p>

      {/* Token 统计 */}
      <div className="space-y-2.5">
        <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          Token 用量
        </h3>
        <div className="grid grid-cols-1 gap-2">
          <StatRow
            icon={<ArrowUpRight size={14} className="text-blue-400" />}
            label="输入 Tokens"
            value={formatNumber(stats.inputTokens)}
          />
          <StatRow
            icon={<ArrowDownRight size={14} className="text-emerald-400/80" />}
            label="输出 Tokens"
            value={formatNumber(stats.outputTokens)}
          />
          <div className="border-t border-border my-1" />
          <StatRow
            icon={<Equal size={14} className="text-primary" />}
            label="合计 Tokens"
            value={formatNumber(stats.total)}
            highlight
          />
        </div>

        {/* 输入/输出比例条 */}
        {stats.total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>输入 {inputRatio.toFixed(1)}%</span>
              <span>输出 {(100 - inputRatio).toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary/50 overflow-hidden flex">
              <div
                className="h-full bg-blue-400 transition-all"
                style={{ width: `${inputRatio}%` }}
              />
              <div
                className="h-full bg-emerald-400 transition-all"
                style={{ width: `${100 - inputRatio}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 费用估算（双币种） */}
      <div className="space-y-2.5">
        <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <DollarSign size={12} />
          费用估算
        </h3>
        <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
          {estimates.map((est) => (
            <div key={est.key} className="flex items-center justify-between">
              <span className="text-[12.5px] text-muted-foreground">
                {est.label}
              </span>
              <div className="text-right">
                <span className="text-[13px] font-mono text-foreground">
                  {stats.total > 0 ? `~${formatUSD(est.cost)}` : '-'}
                </span>
                {stats.total > 0 && est.cost >= 0.01 && (
                  <span className="text-[11px] font-mono text-muted-foreground ml-2">
                    ({formatCNY(est.cost)})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10.5px] text-muted-foreground">
          * 基于公开定价估算，汇率按 1 USD = {USD_TO_CNY} CNY 换算
        </p>
      </div>

      {/* 消息统计 */}
      <div className="space-y-2.5">
        <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          消息统计
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <MsgStatCard
            icon={<MessageSquare size={14} className="text-blue-400" />}
            label="用户消息"
            count={stats.userMsgCount}
          />
          <MsgStatCard
            icon={<Bot size={14} className="text-emerald-400/80" />}
            label="助手消息"
            count={stats.assistantMsgCount}
          />
        </div>
      </div>
    </div>
  )
}

// ==================== Tab 2: 会话对比概览 ====================

interface SessionTokenInfo {
  id: string
  title: string
  inputTokens: number
  outputTokens: number
  total: number
  cost: number // sonnet 定价估算
}

function OverviewTab({ sessions }: { sessions: Session[] }) {
  const data = useMemo(() => {
    const infos: SessionTokenInfo[] = sessions
      .map(s => {
        const t = computeSessionTokens(s.messages)
        return {
          id: s.id,
          title: s.title,
          inputTokens: t.inputTokens,
          outputTokens: t.outputTokens,
          total: t.total,
          cost: estimateCost(t.inputTokens, t.outputTokens, 'sonnet'),
        }
      })
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    const grandInputTokens = infos.reduce((s, i) => s + i.inputTokens, 0)
    const grandOutputTokens = infos.reduce((s, i) => s + i.outputTokens, 0)
    const grandTotal = grandInputTokens + grandOutputTokens
    const grandCost = estimateCost(grandInputTokens, grandOutputTokens, 'sonnet')
    const maxTotal = infos.length > 0 ? infos[0].total : 1

    // 全部会话（不仅 top 10）的总计
    let allInputTokens = 0
    let allOutputTokens = 0
    for (const s of sessions) {
      const t = computeSessionTokens(s.messages)
      allInputTokens += t.inputTokens
      allOutputTokens += t.outputTokens
    }
    const allTotal = allInputTokens + allOutputTokens
    const allCost = estimateCost(allInputTokens, allOutputTokens, 'sonnet')

    return { infos, grandTotal, grandCost, maxTotal, allTotal, allCost, allInputTokens, allOutputTokens }
  }, [sessions])

  if (data.infos.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-[13px]">
        暂无 Token 使用数据
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 全局汇总 */}
      <div className="rounded-lg border border-border bg-secondary/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Coins size={14} className="text-primary" />
          <span className="text-[12.5px] font-medium">全部会话汇总</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
          <div className="text-muted-foreground">总 Token</div>
          <div className="font-mono text-right">{formatNumber(data.allTotal)}</div>
          <div className="text-muted-foreground">输入</div>
          <div className="font-mono text-right text-blue-400">{formatNumber(data.allInputTokens)}</div>
          <div className="text-muted-foreground">输出</div>
          <div className="font-mono text-right text-emerald-400/80">{formatNumber(data.allOutputTokens)}</div>
          <div className="text-muted-foreground">估算费用 (Sonnet)</div>
          <div className="font-mono text-right">
            {formatUSD(data.allCost)}
            <span className="text-muted-foreground ml-1">({formatCNY(data.allCost)})</span>
          </div>
        </div>
      </div>

      {/* 条形图：Top 10 会话 */}
      <div className="space-y-2">
        <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          Top {data.infos.length} 活跃会话
        </h3>
        <div className="space-y-1.5">
          {data.infos.map((info) => (
            <SessionBarRow
              key={info.id}
              info={info}
              maxTotal={data.maxTotal}
            />
          ))}
        </div>
      </div>

      {/* 各模型费用估算 */}
      <div className="space-y-2">
        <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          全部会话费用估算（按模型）
        </h3>
        <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
          {Object.entries(PRICING).map(([key, rate]) => {
            const cost = estimateCost(data.allInputTokens, data.allOutputTokens, key)
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-[12.5px] text-muted-foreground">{rate.label}</span>
                <div className="text-right">
                  <span className="text-[13px] font-mono">{formatUSD(cost)}</span>
                  <span className="text-[11px] font-mono text-muted-foreground ml-2">
                    ({formatCNY(cost)})
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** 单个会话的条形图行 */
function SessionBarRow({ info, maxTotal }: { info: SessionTokenInfo; maxTotal: number }) {
  const [hovered, setHovered] = useState(false)
  const widthPct = maxTotal > 0 ? (info.total / maxTotal) * 100 : 0
  const inputPct = info.total > 0 ? (info.inputTokens / info.total) * 100 : 50

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground truncate w-[120px] flex-shrink-0" title={info.title}>
          {info.title.length > 12 ? info.title.slice(0, 12) + '...' : info.title}
        </span>
        <div className="flex-1 h-5 rounded bg-secondary/40 overflow-hidden relative">
          <div
            className="h-full flex transition-all duration-300"
            style={{ width: `${Math.max(widthPct, 2)}%` }}
          >
            <div className="h-full bg-blue-400/80" style={{ width: `${inputPct}%` }} />
            <div className="h-full bg-emerald-400/80" style={{ width: `${100 - inputPct}%` }} />
          </div>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground w-[50px] text-right flex-shrink-0">
          {formatCompact(info.total)}
        </span>
      </div>
      {/* 悬浮提示 */}
      {hovered && (
        <div className="absolute left-[130px] -top-1 z-10 rounded-lg border border-border bg-popover shadow-xl p-2.5 text-[11px] space-y-0.5 min-w-[200px]">
          <div className="font-medium text-[12px] mb-1 truncate max-w-[220px]">{info.title}</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">输入 Tokens</span>
            <span className="font-mono text-blue-400">{formatNumber(info.inputTokens)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">输出 Tokens</span>
            <span className="font-mono text-emerald-400/80">{formatNumber(info.outputTokens)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-0.5 mt-0.5">
            <span className="text-muted-foreground">合计</span>
            <span className="font-mono font-medium">{formatNumber(info.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">费用 (Sonnet)</span>
            <span className="font-mono">
              {formatUSD(info.cost)} ({formatCNY(info.cost)})
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== Tab 3: 使用趋势 ====================

interface DayUsage {
  date: string // YYYY-MM-DD
  label: string // MM/DD
  inputTokens: number
  outputTokens: number
  total: number
  cost: number
}

function TrendTab({ sessions }: { sessions: Session[] }) {
  const days = useMemo(() => {
    // 最近 7 天
    const now = new Date()
    const dayMap = new Map<string, { input: number; output: number }>()

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      dayMap.set(key, { input: 0, output: 0 })
    }

    // 遍历所有会话的所有消息
    for (const s of sessions) {
      for (const m of s.messages) {
        if (!m.tokenUsage) continue
        const msgDate = new Date(m.timestamp).toISOString().slice(0, 10)
        const entry = dayMap.get(msgDate)
        if (entry) {
          entry.input += m.tokenUsage.inputTokens
          entry.output += m.tokenUsage.outputTokens
        }
      }
    }

    const result: DayUsage[] = []
    for (const [date, usage] of dayMap) {
      const total = usage.input + usage.output
      result.push({
        date,
        label: date.slice(5).replace('-', '/'),
        inputTokens: usage.input,
        outputTokens: usage.output,
        total,
        cost: estimateCost(usage.input, usage.output, 'sonnet'),
      })
    }
    return result
  }, [sessions])

  const maxTotal = Math.max(...days.map(d => d.total), 1)
  const totalAllDays = days.reduce((s, d) => s + d.total, 0)
  const totalCost = days.reduce((s, d) => s + d.cost, 0)

  // SVG 折线图
  const svgW = 440
  const svgH = 140
  const padL = 45
  const padR = 15
  const padT = 15
  const padB = 30
  const chartW = svgW - padL - padR
  const chartH = svgH - padT - padB

  const points = days.map((d, i) => {
    const x = padL + (i / Math.max(days.length - 1, 1)) * chartW
    const y = padT + chartH - (d.total / maxTotal) * chartH
    return { x, y, ...d }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = linePath + ` L ${points[points.length - 1]?.x ?? padL} ${padT + chartH} L ${points[0]?.x ?? padL} ${padT + chartH} Z`

  // Y 轴刻度
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(frac => ({
    value: Math.round(maxTotal * frac),
    y: padT + chartH - frac * chartH,
  }))

  return (
    <div className="space-y-5">
      {/* 7 天汇总 */}
      <div className="rounded-lg border border-border bg-secondary/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Calendar size={14} className="text-primary" />
          <span className="text-[12.5px] font-medium">近 7 天汇总</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
          <div className="text-muted-foreground">总 Token</div>
          <div className="font-mono text-right">{formatNumber(totalAllDays)}</div>
          <div className="text-muted-foreground">估算费用 (Sonnet)</div>
          <div className="font-mono text-right">
            {formatUSD(totalCost)}
            <span className="text-muted-foreground ml-1">({formatCNY(totalCost)})</span>
          </div>
          <div className="text-muted-foreground">日均 Token</div>
          <div className="font-mono text-right">{formatNumber(Math.round(totalAllDays / 7))}</div>
        </div>
      </div>

      {/* 折线图 */}
      <div className="space-y-2">
        <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          Token 使用趋势
        </h3>
        <div className="rounded-lg border border-border bg-secondary/20 p-2 overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full"
            style={{ minWidth: 320 }}
          >
            {/* 网格线 */}
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={padL}
                  y1={tick.y}
                  x2={svgW - padR}
                  y2={tick.y}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                  strokeDasharray="3 3"
                />
                <text
                  x={padL - 6}
                  y={tick.y + 3}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity={0.4}
                  fontSize={9}
                  fontFamily="monospace"
                >
                  {formatCompact(tick.value)}
                </text>
              </g>
            ))}

            {/* X 轴标签 */}
            {points.map((p, i) => (
              <text
                key={i}
                x={p.x}
                y={svgH - 5}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.5}
                fontSize={10}
              >
                {p.label}
              </text>
            ))}

            {/* 面积 + 折线 */}
            {totalAllDays > 0 && (
              <>
                <path d={areaPath} fill="url(#trendGradient)" opacity={0.3} />
                <path d={linePath} fill="none" stroke="var(--color-primary, #6366f1)" strokeWidth={2} strokeLinejoin="round" />
              </>
            )}

            {/* 数据点 */}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={3.5} fill="var(--color-primary, #6366f1)" stroke="var(--color-card, #1a1a2e)" strokeWidth={2} />
                {/* 悬浮目标（大透明圆） */}
                <circle cx={p.x} cy={p.y} r={12} fill="transparent" className="cursor-pointer">
                  <title>{`${p.label}\n输入: ${formatNumber(p.inputTokens)}\n输出: ${formatNumber(p.outputTokens)}\n合计: ${formatNumber(p.total)}\n费用: ${formatUSD(p.cost)}`}</title>
                </circle>
              </g>
            ))}

            {/* 渐变定义 */}
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground px-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
            输入
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            输出
          </span>
        </div>
      </div>

      {/* 每日明细条形图 */}
      <div className="space-y-2">
        <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          每日明细
        </h3>
        <div className="space-y-1">
          {days.map((d) => {
            const widthPct = maxTotal > 0 ? (d.total / maxTotal) * 100 : 0
            const inputPct = d.total > 0 ? (d.inputTokens / d.total) * 100 : 50
            return (
              <div key={d.date} className="flex items-center gap-2" title={`${d.label}: 输入 ${formatNumber(d.inputTokens)} / 输出 ${formatNumber(d.outputTokens)} | ${formatUSD(d.cost)}`}>
                <span className="text-[11px] text-muted-foreground w-[40px] flex-shrink-0 text-right font-mono">
                  {d.label}
                </span>
                <div className="flex-1 h-4 rounded bg-secondary/40 overflow-hidden">
                  <div
                    className="h-full flex transition-all duration-300"
                    style={{ width: `${Math.max(widthPct, d.total > 0 ? 2 : 0)}%` }}
                  >
                    <div className="h-full bg-blue-400/80" style={{ width: `${inputPct}%` }} />
                    <div className="h-full bg-emerald-400/80" style={{ width: `${100 - inputPct}%` }} />
                  </div>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground w-[45px] text-right flex-shrink-0">
                  {d.total > 0 ? formatCompact(d.total) : '-'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ==================== 通用子组件 ====================

function StatRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[12.5px] text-muted-foreground">{label}</span>
      </div>
      <span
        className={`text-[13.5px] font-mono tabular-nums ${
          highlight ? 'text-primary font-semibold' : 'text-foreground'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function MsgStatCard({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode
  label: string
  count: number
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
      {icon}
      <div>
        <div className="text-[13.5px] font-mono font-semibold text-foreground tabular-nums">
          {count} <span className="text-[11px] font-normal text-muted-foreground">条</span>
        </div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}
