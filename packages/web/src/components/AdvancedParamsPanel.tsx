/**
 * 高级参数面板 — 从顶部工具栏按钮以 Popover 形式展开
 * 包含：推理深度、预算硬限制、备选模型、工具权限
 */
import { useEffect, useRef, useCallback } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { useTranslation } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

interface AdvancedParamsPanelProps {
  sessionId: string
  open: boolean
  onClose: () => void
  onOpenChange: (open: boolean) => void
}

/** 可选的工具列表 */
const TOOL_LIST = [
  'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Agent', 'WebSearch', 'WebFetch',
] as const

/** 推理深度选项 */
const EFFORT_OPTIONS = ['low', 'medium', 'high', 'max'] as const

/** 备选模型列表 */
const FALLBACK_MODELS = [
  { value: '', label: '' }, // noFallback
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
]

export default function AdvancedParamsPanel({
  sessionId,
  open,
  onClose,
  onOpenChange,
}: AdvancedParamsPanelProps) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)

  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId))
  const setSessionEffort = useSessionStore((s) => s.setSessionEffort)
  const setSessionMaxBudget = useSessionStore((s) => s.setSessionMaxBudget)
  const setSessionFallbackModel = useSessionStore((s) => s.setSessionFallbackModel)
  const setSessionAllowedTools = useSessionStore((s) => s.setSessionAllowedTools)
  const setSessionDisallowedTools = useSessionStore((s) => s.setSessionDisallowedTools)

  // 点击面板外部时关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // 延迟绑定，避免触发按钮的点击事件同时触发关闭
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [open, onClose])

  // Escape 关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  /** 当前工具权限模式：'none' 无限制 / 'allow' 白名单 / 'disallow' 黑名单 */
  const toolMode =
    session?.allowedTools && session.allowedTools.length > 0
      ? 'allow'
      : session?.disallowedTools && session.disallowedTools.length > 0
        ? 'disallow'
        : 'none'

  /** 推理深度描述映射 */
  const effortDescMap: Record<string, string> = {
    low: t('advancedParams.effortLowDesc'),
    medium: t('advancedParams.effortMediumDesc'),
    high: t('advancedParams.effortHighDesc'),
    max: t('advancedParams.effortMaxDesc'),
  }

  /** 推理深度标签映射 */
  const effortLabelMap: Record<string, string> = {
    low: t('advancedParams.effortLow'),
    medium: t('advancedParams.effortMedium'),
    high: t('advancedParams.effortHigh'),
    max: t('advancedParams.effortMax'),
  }

  /** 切换工具白名单 */
  const toggleAllowedTool = useCallback(
    (tool: string) => {
      const current = session?.allowedTools || []
      const next = current.includes(tool)
        ? current.filter((t) => t !== tool)
        : [...current, tool]
      setSessionAllowedTools(sessionId, next)
    },
    [session?.allowedTools, sessionId, setSessionAllowedTools],
  )

  /** 切换工具黑名单 */
  const toggleDisallowedTool = useCallback(
    (tool: string) => {
      const current = session?.disallowedTools || []
      const next = current.includes(tool)
        ? current.filter((t) => t !== tool)
        : [...current, tool]
      setSessionDisallowedTools(sessionId, next)
    },
    [session?.disallowedTools, sessionId, setSessionDisallowedTools],
  )

  /** 重置为默认 */
  const resetToDefault = useCallback(() => {
    setSessionEffort(sessionId, undefined)
    setSessionMaxBudget(sessionId, 0)
    setSessionFallbackModel(sessionId, '')
    setSessionAllowedTools(sessionId, [])
    setSessionDisallowedTools(sessionId, [])
  }, [
    sessionId,
    setSessionEffort,
    setSessionMaxBudget,
    setSessionFallbackModel,
    setSessionAllowedTools,
    setSessionDisallowedTools,
  ])

  if (!open || !session) return null

  return (
    <div
      ref={panelRef}
      className="absolute top-full right-0 z-50 mt-2 w-[360px] rounded-lg border bg-background shadow-lg"
      style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}
    >
      {/* 标题 */}
      <div className="px-4 py-3 font-medium text-sm">
        {t('advancedParams.title')}
      </div>
      <Separator />

      {/* 1. 推理深度 */}
      <div className="px-4 py-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          {t('advancedParams.effort')}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {EFFORT_OPTIONS.map((level) => (
            <button
              key={level}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                session.effort === level
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
              onClick={() =>
                setSessionEffort(sessionId, session.effort === level ? undefined : level)
              }
            >
              {effortLabelMap[level]}
            </button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          {session.effort
            ? effortDescMap[session.effort]
            : t('advancedParams.effortMediumDesc')}
        </div>
      </div>
      <Separator />

      {/* 2. 预算硬限制 */}
      <div className="px-4 py-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          {t('advancedParams.budgetLimit')}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">$</span>
          <Input
            type="number"
            min={0}
            step={0.1}
            value={session.maxBudgetUsd ?? ''}
            placeholder={t('advancedParams.noLimit')}
            className="h-8 text-xs"
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              setSessionMaxBudget(sessionId, isNaN(val) ? 0 : val)
            }}
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {t('advancedParams.budgetUnit')}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {t('advancedParams.budgetLimitDesc')}
        </div>
      </div>
      <Separator />

      {/* 3. 备选模型 */}
      <div className="px-4 py-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          {t('advancedParams.fallbackModel')}
        </div>
        <select
          value={session.fallbackModel || ''}
          onChange={(e) => setSessionFallbackModel(sessionId, e.target.value)}
          className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
        >
          {FALLBACK_MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.value ? m.label : t('advancedParams.noFallback')}
            </option>
          ))}
        </select>
        <div className="text-xs text-muted-foreground">
          {t('advancedParams.fallbackModelDesc')}
        </div>
      </div>
      <Separator />

      {/* 4. 工具权限 */}
      <div className="px-4 py-3 space-y-3">
        <div className="text-xs font-medium text-muted-foreground">
          {t('advancedParams.toolPermissions')}
        </div>

        {/* 允许的工具（白名单） */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground">
              {t('advancedParams.allowedTools')}
            </span>
            {toolMode === 'none' && (
              <span className="text-xs text-muted-foreground">
                {t('advancedParams.allAllowed')}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TOOL_LIST.map((tool) => {
              const isAllowed = session.allowedTools?.includes(tool) ?? false
              const disabled = toolMode === 'disallow'
              return (
                <button
                  key={`allow-${tool}`}
                  disabled={disabled}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    disabled
                      ? 'cursor-not-allowed opacity-40 bg-secondary text-secondary-foreground'
                      : isAllowed
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                  onClick={() => !disabled && toggleAllowedTool(tool)}
                >
                  {tool}
                </button>
              )
            })}
          </div>
        </div>

        {/* 禁止的工具（黑名单） */}
        <div className="space-y-1.5">
          <span className="text-xs text-foreground">
            {t('advancedParams.disallowedTools')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {TOOL_LIST.map((tool) => {
              const isDisallowed = session.disallowedTools?.includes(tool) ?? false
              const disabled = toolMode === 'allow'
              return (
                <button
                  key={`disallow-${tool}`}
                  disabled={disabled}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    disabled
                      ? 'cursor-not-allowed opacity-40 bg-secondary text-secondary-foreground'
                      : isDisallowed
                        ? 'bg-destructive text-white'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                  onClick={() => !disabled && toggleDisallowedTool(tool)}
                >
                  {tool}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <Separator />

      {/* 重置按钮 */}
      <div className="px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={resetToDefault}
        >
          {t('advancedParams.resetDefault')}
        </Button>
      </div>
    </div>
  )
}
