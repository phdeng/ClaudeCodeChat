import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/i18n'

interface BudgetAlertProps {
  currentTokens: number      // 当前消耗（单位：token）
  budgetTokens: number       // 预算上限（单位：token）
  warningThreshold?: number  // 预警阈值百分比，默认 0.8
}

/** 格式化 token 数量为易读字符串（如 170K、1.2M） */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}K`
  }
  return String(tokens)
}

/**
 * 预算警告条组件
 * 当 token 消耗接近或超出预算时，在输入框上方显示警告
 */
export default function BudgetAlert({
  currentTokens,
  budgetTokens,
  warningThreshold = 0.8,
}: BudgetAlertProps) {
  const [dismissed, setDismissed] = useState(false)
  const { t } = useTranslation()

  // 未设置预算或已关闭提醒，不渲染
  if (budgetTokens <= 0 || dismissed) return null

  const ratio = currentTokens / budgetTokens
  const percent = Math.round(ratio * 100)

  // 未达到预警阈值，不渲染
  if (ratio < warningThreshold) return null

  const isExceeded = ratio >= 1
  const bgClass = isExceeded
    ? 'bg-red-500/10 border-red-500/30'
    : 'bg-yellow-500/10 border-yellow-500/30'
  const textClass = isExceeded ? 'text-red-400' : 'text-yellow-400'
  const barColor = isExceeded ? 'bg-red-500' : 'bg-yellow-500'

  const message = isExceeded
    ? t('budget.exceeded')
    : t('budget.warning').replace('{percent}', String(percent))

  return (
    <div className={`flex-shrink-0 mx-auto w-full max-w-[960px] px-4`}>
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${bgClass} animate-fade-in`}
      >
        <AlertTriangle size={16} className={`flex-shrink-0 ${textClass}`} />

        {/* 内容区 */}
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-medium ${textClass}`}>{message}</div>
          <div className="flex items-center gap-2 mt-1.5">
            {/* 进度条 */}
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
            {/* 数字标签 */}
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {formatTokens(currentTokens)} / {formatTokens(budgetTokens)}
            </span>
          </div>
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"
          title={t('budget.dismiss')}
        >
          <X size={14} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
