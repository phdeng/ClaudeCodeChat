import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Save, Variable, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface EnvVar {
  key: string
  value: string
}

interface EnvVarsPanelProps {
  scope?: 'global' | 'project'
  workingDirectory?: string
}

export default function EnvVarsPanel({ scope, workingDirectory }: EnvVarsPanelProps) {
  const [envVars, setEnvVars] = useState<EnvVar[]>([])
  const [loading, setLoading] = useState(true)
  // 跟踪哪些行的值处于可见状态
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set())
  // 跟踪是否有未保存的更改
  const [dirty, setDirty] = useState(false)

  const isProject = scope === 'project'

  const buildQueryParams = useCallback(() => {
    if (isProject && workingDirectory) {
      return `?scope=project&workingDirectory=${encodeURIComponent(workingDirectory)}`
    }
    return ''
  }, [isProject, workingDirectory])

  // 从后端加载环境变量
  const fetchEnvVars = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/config/settings${buildQueryParams()}`)
      const data = await res.json()
      const vars = data.env || {}
      setEnvVars(
        Object.entries(vars).map(([key, value]) => ({
          key,
          value: value as string,
        }))
      )
      setDirty(false)
    } catch {
      toast.error('加载环境变量失败')
    }
    setLoading(false)
  }, [buildQueryParams])

  useEffect(() => {
    fetchEnvVars()
  }, [fetchEnvVars])

  // 添加新环境变量行
  const addVar = () => {
    setEnvVars((prev) => [...prev, { key: '', value: '' }])
    setDirty(true)
  }

  // 删除指定行
  const removeVar = (index: number) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== index))
    setVisibleIndices((prev) => {
      const next = new Set<number>()
      for (const idx of prev) {
        if (idx < index) next.add(idx)
        else if (idx > index) next.add(idx - 1)
      }
      return next
    })
    setDirty(true)
  }

  // 更新指定行的 key 或 value
  const updateVar = (index: number, field: 'key' | 'value', val: string) => {
    setEnvVars((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: val } : v))
    )
    setDirty(true)
  }

  // 切换值的可见性
  const toggleVisibility = (index: number) => {
    setVisibleIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // 保存到后端
  const save = async () => {
    // 验证：检查是否有空的变量名
    const hasEmptyKey = envVars.some((v) => v.key.trim() === '' && v.value !== '')
    if (hasEmptyKey) {
      toast.error('存在空的变量名，请填写或删除该行')
      return
    }

    // 检查重复的变量名
    const keys = envVars.filter((v) => v.key.trim()).map((v) => v.key.trim())
    const uniqueKeys = new Set(keys)
    if (uniqueKeys.size !== keys.length) {
      toast.error('存在重复的变量名，请修正')
      return
    }

    // 构建环境变量对象（过滤掉空行）
    const env: Record<string, string> = {}
    for (const v of envVars) {
      if (v.key.trim()) {
        env[v.key.trim()] = v.value
      }
    }

    try {
      const body: Record<string, unknown> = { env: Object.keys(env).length > 0 ? env : null }
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

      // 移除空行
      setEnvVars(envVars.filter((v) => v.key.trim()))
      setDirty(false)
      toast.success('环境变量已保存，新的 CLI 进程将使用更新后的配置')
    } catch {
      toast.error('保存环境变量失败')
    }
  }

  if (loading) {
    return (
      <div className="text-muted-foreground text-sm py-4">加载中...</div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Variable size={16} className="text-primary" />
          环境变量
        </h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={addVar}>
            <Plus size={14} className="mr-1" />
            添加
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={save}
            disabled={!dirty}
            className={
              dirty
                ? 'bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white hover:opacity-90'
                : ''
            }
          >
            <Save size={14} className="mr-1" />
            保存
          </Button>
        </div>
      </div>

      {/* 说明文字 */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        这些环境变量将传递给 Claude CLI 进程。常用变量如{' '}
        <code className="px-1 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px]">
          ANTHROPIC_API_KEY
        </code>
        、
        <code className="px-1 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px]">
          CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
        </code>{' '}
        等。保存后新启动的对话将使用更新后的变量。
      </p>

      {/* 未保存提示 */}
      {dirty && (
        <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-500/10 rounded-lg px-3 py-2 animate-fade-in">
          <AlertCircle size={14} />
          有未保存的更改
        </div>
      )}

      {/* 环境变量列表 */}
      {envVars.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          暂无环境变量，点击"添加"按钮新增
        </div>
      ) : (
        <div className="space-y-2">
          {/* 列表头 */}
          <div className="flex items-center gap-2 px-1">
            <span className="flex-1 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              变量名
            </span>
            <span className="w-3" />
            <span className="flex-1 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              值
            </span>
            <span className="w-16" />
          </div>

          {envVars.map((v, i) => (
            <div
              key={i}
              className="flex items-center gap-2 animate-fade-in"
            >
              <Input
                value={v.key}
                onChange={(e) => updateVar(i, 'key', e.target.value)}
                placeholder="VARIABLE_NAME"
                className="flex-1 font-mono text-xs"
              />
              <span className="text-muted-foreground text-sm">=</span>
              <div className="flex-1 relative">
                <Input
                  value={v.value}
                  onChange={(e) => updateVar(i, 'value', e.target.value)}
                  placeholder="value"
                  type={visibleIndices.has(i) ? 'text' : 'password'}
                  className="font-mono text-xs pr-8"
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility(i)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground transition-colors"
                  title={visibleIndices.has(i) ? '隐藏值' : '显示值'}
                >
                  {visibleIndices.has(i) ? (
                    <EyeOff size={14} />
                  ) : (
                    <Eye size={14} />
                  )}
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => removeVar(i)}
                className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0"
                title="删除"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
