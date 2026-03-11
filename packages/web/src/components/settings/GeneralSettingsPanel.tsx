import { useState, useEffect, useCallback } from 'react'
import { SlidersHorizontal, RefreshCw, Plus, X, Info, Palette, Code2, AlertTriangle, FolderOpen, Languages, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import EnvVarsPanel from './EnvVarsPanel'
import { useThemeStore, ACCENT_COLOR_OPTIONS, CODE_THEME_OPTIONS } from '@/stores/themeStore'
import type { AccentColor, CodeTheme } from '@/stores/themeStore'
import { useTranslation, langNames, type LangCode } from '@/i18n'
import { cn } from '@/lib/utils'

interface Settings {
  permissions?: {
    allow?: string[]
    deny?: string[]
    ask?: string[]
    defaultMode?: string
  }
  env?: Record<string, string>
  [key: string]: unknown
}

const PERMISSION_MODES = [
  { value: 'default', label: '默认 (default)' },
  { value: 'auto', label: '自动 (auto)' },
  { value: 'acceptEdits', label: '接受编辑 (acceptEdits)' },
  { value: 'plan', label: '仅规划 (plan)' },
  { value: 'dontAsk', label: '不询问 (dontAsk)' },
  { value: 'bypassPermissions', label: '跳过权限 (bypassPermissions)' },
]

const selectClassName =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30'

interface GeneralSettingsPanelProps {
  scope?: 'global' | 'project'
  workingDirectory?: string
}

export default function GeneralSettingsPanel({ scope, workingDirectory }: GeneralSettingsPanelProps) {
  const { t, lang, setLang } = useTranslation()
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isProject = scope === 'project'
  const needsWorkingDir = isProject && !workingDirectory

  // 主题色与代码高亮主题
  const accentColor = useThemeStore((s) => s.accentColor)
  const codeTheme = useThemeStore((s) => s.codeTheme)
  const setAccentColor = useThemeStore((s) => s.setAccentColor)
  const setCodeTheme = useThemeStore((s) => s.setCodeTheme)

  // 新增权限规则表单
  const [newRuleType, setNewRuleType] = useState<'allow' | 'deny' | 'ask'>('allow')
  const [newRulePattern, setNewRulePattern] = useState('')

  // 成本预算设置（localStorage 存储）
  const [budgetTokensK, setBudgetTokensK] = useState(0)
  const [budgetWarningThreshold, setBudgetWarningThreshold] = useState(80)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('budget-settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (typeof parsed.budgetTokensK === 'number') setBudgetTokensK(parsed.budgetTokensK)
        if (typeof parsed.warningThreshold === 'number') setBudgetWarningThreshold(parsed.warningThreshold)
      }
    } catch { /* 忽略解析错误 */ }
  }, [])

  const saveBudgetSettings = useCallback((tokensK: number, threshold: number) => {
    localStorage.setItem('budget-settings', JSON.stringify({
      budgetTokensK: tokensK,
      warningThreshold: threshold,
    }))
  }, [])

  const buildQueryParams = useCallback(() => {
    if (isProject && workingDirectory) {
      return `?scope=project&workingDirectory=${encodeURIComponent(workingDirectory)}`
    }
    return ''
  }, [isProject, workingDirectory])

  const fetchSettings = useCallback(async () => {
    if (needsWorkingDir) {
      setSettings({})
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/config/settings${buildQueryParams()}`)
      const data = await res.json()
      setSettings(data)
    } catch (err) {
      console.error('Failed to fetch settings:', err)
      setError('加载设置失败，请重试')
    }
    setLoading(false)
  }, [buildQueryParams, needsWorkingDir])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const saveSettings = async (updated: Settings) => {
    setError(null)
    try {
      const body: Record<string, unknown> = { ...updated }
      if (isProject && workingDirectory) {
        body.scope = 'project'
        body.workingDirectory = workingDirectory
      }
      const res = await fetch('/api/config/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('保存失败')
      setSettings(updated)
    } catch (err) {
      console.error('Failed to save settings:', err)
      setError('保存设置失败，请重试')
    }
  }

  const handlePermissionModeChange = (mode: string) => {
    const updated = { ...settings }
    if (!updated.permissions) updated.permissions = {}
    if (mode === 'default') {
      delete updated.permissions.defaultMode
    } else {
      updated.permissions.defaultMode = mode
    }
    saveSettings(updated)
  }

  const handleAddRule = () => {
    if (!newRulePattern.trim()) return
    const updated = { ...settings }
    if (!updated.permissions) updated.permissions = {}
    const arr = updated.permissions[newRuleType] || []
    updated.permissions = {
      ...updated.permissions,
      [newRuleType]: [...arr, newRulePattern.trim()],
    }
    setNewRulePattern('')
    saveSettings(updated)
  }

  const handleRemoveRule = (type: 'allow' | 'deny' | 'ask', index: number) => {
    const updated = { ...settings }
    if (!updated.permissions?.[type]) return
    const arr = [...updated.permissions[type]!]
    arr.splice(index, 1)
    updated.permissions = { ...updated.permissions, [type]: arr }
    if (arr.length === 0) delete updated.permissions[type]
    saveSettings(updated)
  }

  // 项目模式但未选择项目
  if (needsWorkingDir) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          管理项目级通用设置（修改项目目录下的 <code className="font-mono text-primary">.claude/settings.json</code>）
        </p>
        <Card className="border-dashed border-amber-500/50 py-0">
          <CardContent className="p-6 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={28} className="text-amber-400/80" />
            </div>
            <p className="text-sm font-medium text-foreground">请先选择项目文件夹</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm">
              项目级设置存放在项目目录的 <code className="font-mono text-primary">.claude/settings.json</code> 中。请先在顶栏点击文件夹图标选择一个项目。
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm p-4">{t('common.loading')}</div>
  }

  const permissions = settings.permissions || {}
  const allowRules = permissions.allow || []
  const denyRules = permissions.deny || []
  const askRules = permissions.ask || []
  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="bg-card/50 backdrop-blur-sm rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <SlidersHorizontal size={24} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base mb-1.5">通用设置管理</CardTitle>
              <CardDescription className="leading-relaxed">
                管理 Claude Code 的{isProject ? '项目级' : '全局'}设置（修改{' '}
                <code className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                  {isProject && workingDirectory
                    ? `${workingDirectory.replace(/\\/g, '/')}/.claude/settings.json`
                    : '~/.claude/settings.json'}
                </code>
                ）。更改会自动保存。
              </CardDescription>
              {isProject && (
                <div className="text-[12px] text-muted-foreground mt-2">
                  项目级设置会覆盖全局设置，仅对当前项目生效
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={fetchSettings}
              title="刷新"
              className="flex-shrink-0"
            >
              <RefreshCw size={16} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3 animate-fade-in">
          {error}
        </div>
      )}

      {/* 提示信息：模型与语言 */}
      <Card className="py-0 rounded-2xl">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info size={16} className="text-primary" />
            使用提示
          </div>
          <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed list-disc list-inside">
            <li>
              <span className="font-medium text-foreground">模型切换</span>：在顶栏的模型选择器中为每个会话单独选择模型
            </li>
            <li>
              <span className="font-medium text-foreground">语言偏好</span>：在项目的{' '}
              <code className="px-1 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px]">
                CLAUDE.md
              </code>{' '}
              中通过提示词设置（如"永远使用中文回复"）
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 语言切换 */}
      <Card className="py-0 rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Languages size={16} className="text-primary" />
            <CardTitle className="text-sm">{t('settings.language')}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {(Object.entries(langNames) as [LangCode, string][]).map(([code, name]) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm transition-all',
                  lang === code
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/30 font-medium'
                    : 'bg-accent/50 text-foreground hover:bg-accent'
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 外观设置：主题色 + 代码高亮主题 */}
      <Card className="py-0 rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-primary" />
            <CardTitle className="text-sm">{t('settings.accentColor')}</CardTitle>
          </div>

          {/* 主题色选择 */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">{t('settings.accentColor')}</label>
            <div className="flex items-center gap-3 flex-wrap">
              {ACCENT_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAccentColor(opt.value)}
                  className={cn(
                    'w-7 h-7 rounded-full transition-all duration-200 flex items-center justify-center',
                    accentColor === opt.value
                      ? 'ring-2 ring-offset-2 ring-offset-background scale-110'
                      : 'hover:scale-110 opacity-80 hover:opacity-100'
                  )}
                  style={{
                    backgroundColor: opt.color,
                    ...(accentColor === opt.value
                      ? { boxShadow: `0 0 12px ${opt.color}40` }
                      : {}),
                  }}
                  title={opt.label}
                >
                  {accentColor === opt.value && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 代码高亮主题 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Code2 size={13} className="text-muted-foreground" />
              <label className="text-xs text-muted-foreground">{t('settings.codeTheme')}</label>
            </div>
            <select
              value={codeTheme}
              onChange={(e) => setCodeTheme(e.target.value as CodeTheme)}
              className={selectClassName}
            >
              {CODE_THEME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* 权限规则 */}
      <Card className="py-0 rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <CardTitle className="text-sm">权限规则</CardTitle>

          {/* Default permission mode */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">默认权限模式</label>
            <select
              value={permissions.defaultMode || 'default'}
              onChange={(e) => handlePermissionModeChange(e.target.value)}
              className={selectClassName}
            >
              {PERMISSION_MODES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Allow rules */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">允许 (allow)</label>
            <div className="flex flex-wrap gap-1.5">
              {allowRules.length === 0 && (
                <span className="text-xs text-muted-foreground">无规则</span>
              )}
              {allowRules.map((rule, idx) => (
                <Badge
                  key={idx}
                  className="bg-green-500/15 text-green-400/80 gap-1 cursor-default"
                >
                  {rule}
                  <button
                    onClick={() => handleRemoveRule('allow', idx)}
                    className="ml-0.5 hover:text-destructive transition-colors"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Deny rules */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">拒绝 (deny)</label>
            <div className="flex flex-wrap gap-1.5">
              {denyRules.length === 0 && (
                <span className="text-xs text-muted-foreground">无规则</span>
              )}
              {denyRules.map((rule, idx) => (
                <Badge
                  key={idx}
                  className="bg-red-500/15 text-red-400/80 gap-1 cursor-default"
                >
                  {rule}
                  <button
                    onClick={() => handleRemoveRule('deny', idx)}
                    className="ml-0.5 hover:text-destructive transition-colors"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Ask rules */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">询问 (ask)</label>
            <div className="flex flex-wrap gap-1.5">
              {askRules.length === 0 && (
                <span className="text-xs text-muted-foreground">无规则</span>
              )}
              {askRules.map((rule, idx) => (
                <Badge
                  key={idx}
                  className="bg-yellow-500/15 text-yellow-400/80 gap-1 cursor-default"
                >
                  {rule}
                  <button
                    onClick={() => handleRemoveRule('ask', idx)}
                    className="ml-0.5 hover:text-destructive transition-colors"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Add rule form */}
          <div className="flex gap-2 items-end pt-1">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">类型</label>
              <select
                value={newRuleType}
                onChange={(e) => setNewRuleType(e.target.value as 'allow' | 'deny' | 'ask')}
                className={selectClassName}
              >
                <option value="allow">allow</option>
                <option value="deny">deny</option>
                <option value="ask">ask</option>
              </select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">规则模式</label>
              <Input
                value={newRulePattern}
                onChange={(e) => setNewRulePattern(e.target.value)}
                placeholder='如: Bash(npm run *), Edit'
                onKeyDown={(e) => e.key === 'Enter' && handleAddRule()}
              />
            </div>
            <Button
              size="sm"
              onClick={handleAddRule}
              disabled={!newRulePattern.trim()}
              className="bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white hover:opacity-90"
            >
              <Plus size={14} />
              添加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 成本预算设置 */}
      <Card className="py-0 rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-primary" />
            <div>
              <CardTitle className="text-sm">{t('settings.budgetTitle')}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{t('settings.budgetDescription')}</CardDescription>
            </div>
          </div>

          {/* 单会话 Token 预算 */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">{t('settings.sessionBudget')}</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={10}
                value={budgetTokensK}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0)
                  setBudgetTokensK(val)
                  saveBudgetSettings(val, budgetWarningThreshold)
                }}
                className="w-32"
              />
              <span className="text-xs text-muted-foreground">{t('settings.budgetUnit')}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{t('settings.sessionBudgetHint')}</p>
          </div>

          {/* 预警阈值 */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              {t('settings.warningThreshold')}: {budgetWarningThreshold}%
            </label>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground">50%</span>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={budgetWarningThreshold}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  setBudgetWarningThreshold(val)
                  saveBudgetSettings(budgetTokensK, val)
                }}
                className="flex-1 h-1.5 accent-primary cursor-pointer"
              />
              <span className="text-[11px] text-muted-foreground">100%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: 环境变量（独立组件管理） */}
      <Card className="py-0 rounded-2xl">
        <CardContent className="p-5">
          <EnvVarsPanel scope={scope} workingDirectory={workingDirectory} />
        </CardContent>
      </Card>
    </div>
  )
}
