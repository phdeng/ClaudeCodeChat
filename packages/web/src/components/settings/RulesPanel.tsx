import { useState, useEffect, useCallback } from 'react'
import { FileText, Save, RefreshCw, FolderOpen, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'

interface RulesPanelProps {
  workingDirectory?: string
}

export default function RulesPanel({ workingDirectory }: RulesPanelProps) {
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const isDirty = content !== savedContent

  const fetchRules = useCallback(async () => {
    if (!workingDirectory) return
    setLoading(true)
    try {
      const res = await fetch(`/api/config/rules?workingDirectory=${encodeURIComponent(workingDirectory)}`)
      if (!res.ok) throw new Error('加载失败')
      const data = await res.json()
      const text = data.content || ''
      setContent(text)
      setSavedContent(text)
    } catch (err) {
      console.error('Failed to fetch rules:', err)
      toast.error('加载 CLAUDE.md 失败')
    }
    setLoading(false)
  }, [workingDirectory])

  useEffect(() => {
    if (workingDirectory) {
      fetchRules()
    } else {
      setContent('')
      setSavedContent('')
    }
  }, [workingDirectory, fetchRules])

  const handleSave = async () => {
    if (!workingDirectory) return
    setSaving(true)
    try {
      const res = await fetch('/api/config/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, workingDirectory }),
      })
      if (!res.ok) throw new Error('保存失败')
      setSavedContent(content)
      toast.success('CLAUDE.md 已保存')
    } catch (err) {
      console.error('Failed to save rules:', err)
      toast.error('保存 CLAUDE.md 失败')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      {/* Header section */}
      <Card className="bg-card/50 backdrop-blur-sm rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <FileText size={24} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base mb-1.5">Rules 项目规则</CardTitle>
              <CardDescription className="leading-relaxed">
                编辑项目根目录的{' '}
                <code className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                  CLAUDE.md
                </code>{' '}
                文件。该文件定义了 Claude Code 在此项目中的行为规则和指导方针。
              </CardDescription>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 未选择项目提示 */}
      {!workingDirectory && (
        <Card className="border-dashed border-amber-500/50 py-0">
          <CardContent className="p-6 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={28} className="text-amber-400/80" />
            </div>
            <p className="text-sm font-medium text-foreground">请先选择项目文件夹</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm">
              CLAUDE.md 是项目级配置文件，存放在项目根目录。请先在顶栏点击文件夹图标选择一个项目。
            </p>
          </CardContent>
        </Card>
      )}

      {/* 有项目时显示编辑器 */}
      {workingDirectory && (
        <>
          {/* 当前项目路径 + 操作按钮 */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FolderOpen size={12} className="text-primary" />
              <span>
                当前项目：<code className="font-mono text-foreground">{workingDirectory}</code>
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={fetchRules}
                title="刷新"
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white hover:opacity-90 disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-muted-foreground text-sm p-4">加载中...</div>
          ) : (
            <div className="space-y-2">
              {isDirty && (
                <div className="text-xs text-amber-400/80 px-1 animate-fade-in">
                  * 有未保存的更改
                </div>
              )}
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# CLAUDE.md&#10;&#10;在此输入项目规则和指导方针..."
                className="min-h-[400px] font-mono text-sm leading-relaxed resize-y"
              />
              <p className="text-xs text-muted-foreground px-1">
                支持 Markdown 格式。此文件的内容将作为 Claude Code 在项目中工作时的上下文指令。
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
