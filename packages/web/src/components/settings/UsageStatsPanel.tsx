import { useMemo, useState } from 'react'
import { BarChart3, Coins, MessageSquare, Zap, FolderOpen, Cpu } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSessionStore } from '@/stores/sessionStore'
import { useTranslation } from '@/i18n'
import {
  computeOverview,
  computeDailyUsage,
  computeModelUsage,
  computeProjectUsage,
  formatTokens,
  formatUsd,
  MODEL_PRICING,
} from '@/utils/costAnalytics'

/**
 * SVG 柱状图：最近 14 天 token 用量
 */
function DailyBarChart({ data }: { data: { date: string; inputTokens: number; outputTokens: number; totalTokens: number }[] }) {
  const { t } = useTranslation()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const maxVal = Math.max(...data.map((d) => d.totalTokens), 1)
  const barCount = data.length
  const chartWidth = 600
  const chartHeight = 200
  const barGap = 4
  const barWidth = (chartWidth - barGap * (barCount + 1)) / barCount
  const paddingTop = 24
  const paddingBottom = 40
  const drawHeight = chartHeight - paddingTop - paddingBottom

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full min-w-[400px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* 网格线 */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingTop + drawHeight * (1 - ratio)
          return (
            <g key={ratio}>
              <line
                x1={0}
                y1={y}
                x2={chartWidth}
                y2={y}
                stroke="currentColor"
                className="text-muted-foreground/20"
                strokeDasharray="4 4"
              />
              <text
                x={2}
                y={y - 4}
                className="text-muted-foreground fill-current"
                fontSize={9}
              >
                {formatTokens(maxVal * ratio)}
              </text>
            </g>
          )
        })}

        {/* 柱子 */}
        {data.map((d, i) => {
          const x = barGap + i * (barWidth + barGap)
          const totalH = (d.totalTokens / maxVal) * drawHeight
          const inputH = (d.inputTokens / maxVal) * drawHeight
          const outputH = totalH - inputH
          const y = paddingTop + drawHeight - totalH
          const isHovered = hoveredIndex === i
          const dateLabel = d.date.slice(5) // MM-DD

          return (
            <g
              key={d.date}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              {/* 悬浮高亮背景 */}
              {isHovered && (
                <rect
                  x={x - 2}
                  y={paddingTop}
                  width={barWidth + 4}
                  height={drawHeight}
                  rx={3}
                  className="fill-primary/5"
                />
              )}

              {/* Output (上层) */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(outputH, 0)}
                rx={2}
                className={isHovered ? 'fill-primary/80' : 'fill-primary/60'}
              />

              {/* Input (下层) */}
              <rect
                x={x}
                y={y + outputH}
                width={barWidth}
                height={Math.max(inputH, 0)}
                rx={0}
                className={isHovered ? 'fill-primary/50' : 'fill-primary/30'}
              />

              {/* 日期标签 */}
              <text
                x={x + barWidth / 2}
                y={chartHeight - paddingBottom + 14}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {dateLabel}
              </text>

              {/* 悬浮 tooltip */}
              {isHovered && d.totalTokens > 0 && (
                <g>
                  <rect
                    x={Math.min(x - 20, chartWidth - 120)}
                    y={Math.max(y - 48, 0)}
                    width={110}
                    height={40}
                    rx={6}
                    className="fill-popover stroke-border"
                    strokeWidth={0.5}
                  />
                  <text
                    x={Math.min(x - 20, chartWidth - 120) + 8}
                    y={Math.max(y - 48, 0) + 16}
                    className="fill-foreground"
                    fontSize={10}
                    fontWeight={600}
                  >
                    {t('usage.total')}: {formatTokens(d.totalTokens)}
                  </text>
                  <text
                    x={Math.min(x - 20, chartWidth - 120) + 8}
                    y={Math.max(y - 48, 0) + 32}
                    className="fill-muted-foreground"
                    fontSize={9}
                  >
                    In: {formatTokens(d.inputTokens)} / Out: {formatTokens(d.outputTokens)}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>

      {/* 图例 */}
      <div className="flex items-center gap-4 mt-2 justify-center text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-primary/30 inline-block" />
          Input
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-primary/60 inline-block" />
          Output
        </span>
      </div>
    </div>
  )
}

/**
 * 横向进度条组件
 */
function HorizontalBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-2 w-full rounded-full bg-accent/50 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${className || 'bg-primary/60'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function UsageStatsPanel() {
  const { t } = useTranslation()
  const sessions = useSessionStore((s) => s.sessions)

  const overview = useMemo(() => computeOverview(sessions), [sessions])
  const dailyUsage = useMemo(() => computeDailyUsage(sessions, 14), [sessions])
  const modelUsage = useMemo(() => computeModelUsage(sessions), [sessions])
  const projectUsage = useMemo(() => computeProjectUsage(sessions, 5), [sessions])

  const maxProjectTokens = projectUsage.length > 0 ? projectUsage[0].totalTokens : 1
  const maxModelTokens = modelUsage.length > 0 ? modelUsage[0].totalTokens : 1

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="bg-card/50 backdrop-blur-sm rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <BarChart3 size={24} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base mb-1.5">{t('usage.title')}</CardTitle>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('usage.description')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 概览卡片 4-grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* 总 Token */}
        <Card className="py-0 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <Zap size={16} className="text-blue-400" />
              </div>
              <span className="text-xs text-muted-foreground">{t('usage.totalTokens')}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{formatTokens(overview.totalTokens)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              In: {formatTokens(overview.totalInputTokens)} / Out: {formatTokens(overview.totalOutputTokens)}
            </p>
          </CardContent>
        </Card>

        {/* 估算成本 */}
        <Card className="py-0 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-green-500/15 flex items-center justify-center">
                <Coins size={16} className="text-green-400" />
              </div>
              <span className="text-xs text-muted-foreground">{t('usage.estimatedCost')}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{formatUsd(overview.totalCostUsd)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t('usage.basedOnPricing')}</p>
          </CardContent>
        </Card>

        {/* 总对话数 */}
        <Card className="py-0 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center">
                <MessageSquare size={16} className="text-purple-400" />
              </div>
              <span className="text-xs text-muted-foreground">{t('usage.totalSessions')}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{overview.totalSessions}</p>
          </CardContent>
        </Card>

        {/* 平均每次对话 Token */}
        <Card className="py-0 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center">
                <BarChart3 size={16} className="text-orange-400" />
              </div>
              <span className="text-xs text-muted-foreground">{t('usage.avgPerSession')}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{formatTokens(overview.avgTokensPerSession)}</p>
          </CardContent>
        </Card>
      </div>

      {/* 时间趋势图 */}
      <Card className="py-0 rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" />
            <CardTitle className="text-sm">{t('usage.dailyTrend')}</CardTitle>
          </div>
          <DailyBarChart data={dailyUsage} />
        </CardContent>
      </Card>

      {/* 模型使用分布 */}
      <Card className="py-0 rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-primary" />
            <CardTitle className="text-sm">{t('usage.modelDistribution')}</CardTitle>
          </div>
          {modelUsage.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('usage.noData')}</p>
          ) : (
            <div className="space-y-3">
              {modelUsage.map((m) => (
                <div key={m.model} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground flex items-center gap-2">
                      {m.model}
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {m.messageCount} {t('usage.messages')}
                      </Badge>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatTokens(m.totalTokens)} / {formatUsd(m.costUsd)}
                    </span>
                  </div>
                  <HorizontalBar value={m.totalTokens} max={maxModelTokens} className="bg-primary/50" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 项目 Top-5 */}
      <Card className="py-0 rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-primary" />
            <CardTitle className="text-sm">{t('usage.projectRanking')}</CardTitle>
          </div>
          {projectUsage.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('usage.noData')}</p>
          ) : (
            <div className="space-y-3">
              {projectUsage.map((p, idx) => (
                <div key={p.project} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate max-w-[200px]" title={p.project}>
                        {p.displayName}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {p.sessionCount} {t('usage.sessions')}
                      </Badge>
                    </span>
                    <span className="text-muted-foreground text-xs flex-shrink-0">
                      {formatTokens(p.totalTokens)} / {formatUsd(p.costUsd)}
                    </span>
                  </div>
                  <HorizontalBar value={p.totalTokens} max={maxProjectTokens} className="bg-primary/40" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token 单价表 */}
      <Card className="py-0 rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Coins size={16} className="text-primary" />
            <CardTitle className="text-sm">{t('usage.pricingTable')}</CardTitle>
          </div>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-accent/30">
                  <th className="text-left p-2.5 font-medium text-muted-foreground">{t('usage.model')}</th>
                  <th className="text-right p-2.5 font-medium text-muted-foreground">Input ($/1M)</th>
                  <th className="text-right p-2.5 font-medium text-muted-foreground">Output ($/1M)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(MODEL_PRICING).map(([name, price]) => (
                  <tr key={name} className="border-b last:border-0 hover:bg-accent/20 transition-colors">
                    <td className="p-2.5 capitalize font-medium text-foreground">{name}</td>
                    <td className="p-2.5 text-right text-muted-foreground">${price.input}</td>
                    <td className="p-2.5 text-right text-muted-foreground">${price.output}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">{t('usage.pricingNote')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
