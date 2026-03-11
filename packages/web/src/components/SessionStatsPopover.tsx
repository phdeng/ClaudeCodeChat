import { useMemo } from 'react'
import { BarChart3, MessageSquare, Hash, Clock, Zap, DollarSign } from 'lucide-react'
import type { Message } from '../stores/sessionStore'

// 费率定义（每百万 tokens 的美元价格）
const PRICING: Record<string, { input: number; output: number; label: string }> = {
  sonnet: { input: 3, output: 15, label: 'Sonnet' },
  opus: { input: 15, output: 75, label: 'Opus' },
  haiku: { input: 0.25, output: 1.25, label: 'Haiku' },
}
const USD_TO_CNY = 7.2

function formatUSD(amount: number): string {
  if (amount < 0.01) return '<$0.01'
  return `$${amount.toFixed(2)}`
}

function formatCNY(amount: number): string {
  const cny = amount * USD_TO_CNY
  if (cny < 0.01) return '<¥0.01'
  return `¥${cny.toFixed(2)}`
}

interface SessionStatsPopoverProps {
  messages: Message[]
  open: boolean
  onClose: () => void
  /** 当前会话使用的模型名称（可选），用于高亮费用估算 */
  modelName?: string
}

export default function SessionStatsPopover({ messages, open, onClose, modelName }: SessionStatsPopoverProps) {
  const stats = useMemo(() => {
    const userMsgs = messages.filter(m => m.role === 'user')
    const assistantMsgs = messages.filter(m => m.role === 'assistant')

    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
    const userChars = userMsgs.reduce((sum, m) => sum + m.content.length, 0)
    const assistantChars = assistantMsgs.reduce((sum, m) => sum + m.content.length, 0)

    const totalInputTokens = messages.reduce((sum, m) => sum + (m.tokenUsage?.inputTokens || 0), 0)
    const totalOutputTokens = messages.reduce((sum, m) => sum + (m.tokenUsage?.outputTokens || 0), 0)

    const avgUserLen = userMsgs.length ? Math.round(userChars / userMsgs.length) : 0
    const avgAssistantLen = assistantMsgs.length ? Math.round(assistantChars / assistantMsgs.length) : 0

    // 对话时长
    const firstMsg = messages[0]
    const lastMsg = messages[messages.length - 1]
    const durationMs = firstMsg && lastMsg ? lastMsg.timestamp - firstMsg.timestamp : 0
    const durationMin = Math.round(durationMs / 60000)

    // 代码块统计
    const codeBlockCount = messages.reduce((sum, m) => {
      const matches = m.content.match(/```/g)
      return sum + (matches ? Math.floor(matches.length / 2) : 0)
    }, 0)

    // 费用估算
    const estimates = Object.entries(PRICING).map(([key, rate]) => {
      const cost =
        (totalInputTokens / 1_000_000) * rate.input +
        (totalOutputTokens / 1_000_000) * rate.output
      return { key, label: rate.label, cost }
    })

    // 推断当前模型的定价 key
    let activeModelKey = 'sonnet'
    if (modelName) {
      const lower = modelName.toLowerCase()
      if (lower.includes('opus')) activeModelKey = 'opus'
      else if (lower.includes('haiku')) activeModelKey = 'haiku'
      else activeModelKey = 'sonnet'
    }

    return {
      totalMessages: messages.length,
      userMessages: userMsgs.length,
      assistantMessages: assistantMsgs.length,
      totalChars,
      userChars,
      assistantChars,
      totalInputTokens,
      totalOutputTokens,
      avgUserLen,
      avgAssistantLen,
      durationMin,
      codeBlockCount,
      estimates,
      activeModelKey,
    }
  }, [messages, modelName])

  if (!open) return null

  const totalTokens = stats.totalInputTokens + stats.totalOutputTokens

  return (
    // 浮层 overlay + 面板
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div
        className="absolute right-4 top-16 w-[300px] rounded-xl border border-border bg-popover shadow-2xl p-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-[14px] font-semibold mb-3 flex items-center gap-2">
          <BarChart3 size={16} className="text-primary" />
          对话统计
        </h3>

        <div className="space-y-3">
          {/* 消息数量 */}
          <StatRow
            icon={MessageSquare}
            label="总消息"
            value={`${stats.totalMessages}`}
            sub={`用户 ${stats.userMessages} / Claude ${stats.assistantMessages}`}
          />

          {/* 字符数 */}
          <StatRow
            icon={Hash}
            label="总字数"
            value={formatNumber(stats.totalChars)}
            sub={`用户 ${formatNumber(stats.userChars)} / Claude ${formatNumber(stats.assistantChars)}`}
          />

          {/* Token 明细 */}
          <StatRow
            icon={Zap}
            label="Token 用量"
            value={formatNumber(totalTokens)}
            sub={`输入 ${formatNumber(stats.totalInputTokens)} / 输出 ${formatNumber(stats.totalOutputTokens)}`}
          />

          {/* 输入/输出比例条 */}
          {totalTokens > 0 && (
            <div className="ml-6 space-y-0.5">
              <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden flex">
                <div
                  className="h-full bg-blue-400"
                  style={{ width: `${(stats.totalInputTokens / totalTokens) * 100}%` }}
                />
                <div
                  className="h-full bg-emerald-400"
                  style={{ width: `${(stats.totalOutputTokens / totalTokens) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground/60">
                <span className="flex items-center gap-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />输入</span>
                <span className="flex items-center gap-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />输出</span>
              </div>
            </div>
          )}

          {/* 费用估算 */}
          {totalTokens > 0 && (
            <div className="ml-6 rounded-lg border border-border bg-secondary/20 p-2 space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                <DollarSign size={10} />
                费用估算
              </div>
              {stats.estimates.map((est) => (
                <div
                  key={est.key}
                  className={`flex items-center justify-between text-[11px] ${
                    est.key === stats.activeModelKey
                      ? 'text-primary font-medium'
                      : 'text-muted-foreground'
                  }`}
                >
                  <span>
                    {est.label}
                    {est.key === stats.activeModelKey && (
                      <span className="text-[9px] ml-1 opacity-60">(当前)</span>
                    )}
                  </span>
                  <span className="font-mono">
                    {formatUSD(est.cost)}
                    <span className="text-muted-foreground/60 ml-1 text-[10px]">
                      ({formatCNY(est.cost)})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 代码块数 */}
          {stats.codeBlockCount > 0 && (
            <StatRow
              icon={Hash}
              label="代码块"
              value={`${stats.codeBlockCount} 个`}
            />
          )}

          {/* 平均长度 */}
          <StatRow
            icon={BarChart3}
            label="平均消息长度"
            value={`${formatNumber(stats.avgUserLen)} / ${formatNumber(stats.avgAssistantLen)}`}
            sub="用户 / Claude"
          />

          {/* 对话时长 */}
          {stats.durationMin > 0 && (
            <StatRow icon={Clock} label="对话时长" value={`${stats.durationMin} 分钟`} />
          )}
        </div>
      </div>
    </div>
  )
}

function StatRow({ icon: Icon, label, value, sub }: {
  icon: React.ComponentType<any>; label: string; value: string; sub?: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-muted-foreground">{label}</span>
          <span className="text-[13px] font-medium font-mono">{value}</span>
        </div>
        {sub && <span className="text-[10px] text-muted-foreground/70">{sub}</span>}
      </div>
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}
