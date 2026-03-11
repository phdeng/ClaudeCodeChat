import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, RefreshCw, Pencil, Check, X, FolderOpen, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface HookEntry {
  matcher?: string
  command: string
}

type HookEvent = 'PreToolUse' | 'PostToolUse' | 'Notification' | 'Stop' | 'SubagentStop'

const HOOK_EVENTS: { id: HookEvent; label: string; desc: string }[] = [
  { id: 'PreToolUse', label: 'PreToolUse', desc: '工具调用前执行' },
  { id: 'PostToolUse', label: 'PostToolUse', desc: '工具调用后执行' },
  { id: 'Notification', label: 'Notification', desc: '通知时执行' },
  { id: 'Stop', label: 'Stop', desc: 'Claude 停止时执行' },
  { id: 'SubagentStop', label: 'SubagentStop', desc: '子代理停止时执行' },
]

interface HooksPanelProps {
  scope?: 'global' | 'project'
  workingDirectory?: string
}

export default function HooksPanel({ scope = 'global', workingDirectory }: HooksPanelProps) {
  const [hooks, setHooks] = useState<Record<string, HookEntry[]>>({})
  const [loading, setLoading] = useState(true)
  const [addingTo, setAddingTo] = useState<HookEvent | null>(null)
  const [newMatcher, setNewMatcher] = useState('')
  const [newCommand, setNewCommand] = useState('')

  // 编辑模式状态：记录正在编辑的 event + index
  const [editingKey, setEditingKey] = useState<{ event: string; index: number } | null>(null)
  const [editMatcher, setEditMatcher] = useState('')
  const [editCommand, setEditCommand] = useState('')

  const isProject = scope === 'project'
  const needsWorkingDir = isProject && !workingDirectory

  const buildQueryParams = useCallback(() => {
    if (isProject && workingDirectory) {
      return `?scope=project&workingDirectory=${encodeURIComponent(workingDirectory)}`
    }
    return ''
  }, [isProject, workingDirectory])

  const fetchHooks = useCallback(async () => {
    if (needsWorkingDir) {
      setHooks({})
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/config/hooks${buildQueryParams()}`)
      const data = await res.json()
      setHooks(data)
    } catch (err) {
      console.error('Failed to fetch hooks:', err)
      toast.error('获取 Hooks 配置失败')
    }
    setLoading(false)
  }, [buildQueryParams, needsWorkingDir])

  useEffect(() => { fetchHooks() }, [fetchHooks])

  const saveHooksToBackend = async (updatedHooks: Record<string, HookEntry[]>) => {
    const body: Record<string, any> = { hooks: updatedHooks }
    if (isProject && workingDirectory) {
      body.scope = 'project'
      body.workingDirectory = workingDirectory
    }
    const res = await fetch('/api/config/hooks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('保存失败')
  }

  const handleAdd = async (event: HookEvent) => {
    if (!newCommand.trim()) return
    try {
      const entry: HookEntry = { command: newCommand.trim() }
      if (newMatcher.trim()) entry.matcher = newMatcher.trim()

      const updated = { ...hooks }
      if (!updated[event]) updated[event] = []
      updated[event] = [...updated[event], entry]

      await saveHooksToBackend(updated)
      setNewCommand('')
      setNewMatcher('')
      setAddingTo(null)
      toast.success('Hook 已添加')
      fetchHooks()
    } catch (err: any) {
      toast.error(err.message || '添加 Hook 失败')
    }
  }

  const handleRemove = async (event: string, index: number) => {
    try {
      const updated = { ...hooks }
      updated[event] = updated[event].filter((_, i) => i !== index)
      if (updated[event].length === 0) delete updated[event]

      await saveHooksToBackend(updated)
      toast.success('Hook 已删除')
      fetchHooks()
    } catch (err: any) {
      toast.error(err.message || '删除 Hook 失败')
    }
  }

  const startEdit = (event: string, index: number, entry: HookEntry) => {
    setEditingKey({ event, index })
    setEditMatcher(entry.matcher || '')
    setEditCommand(entry.command)
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setEditMatcher('')
    setEditCommand('')
  }

  const handleUpdate = async () => {
    if (!editingKey || !editCommand.trim()) return
    try {
      const { event, index } = editingKey
      const updated = { ...hooks }
      const entries = [...(updated[event] || [])]
      entries[index] = {
        command: editCommand.trim(),
        ...(editMatcher.trim() ? { matcher: editMatcher.trim() } : {}),
      }
      updated[event] = entries

      await saveHooksToBackend(updated)
      cancelEdit()
      toast.success('Hook 已更新')
      fetchHooks()
    } catch (err: any) {
      toast.error(err.message || '更新 Hook 失败')
    }
  }

  // 项目模式但未选择项目
  if (needsWorkingDir) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          管理项目级 Hooks（修改 {'{project}'}/.claude/settings.json）
        </p>
        <Card className="border-dashed border-amber-500/50 py-0">
          <CardContent className="p-6 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={28} className="text-amber-400/80" />
            </div>
            <p className="text-sm font-medium text-foreground">请先选择项目文件夹</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm">
              项目级 Hooks 存放在项目的 <code className="font-mono text-primary">.claude/settings.json</code> 中。请先在顶栏点击文件夹图标选择一个项目。
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm p-4">加载中...</div>
  }

  const configPath = isProject && workingDirectory
    ? `${workingDirectory}/.claude/settings.json`
    : '~/.claude/settings.json'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            管理 Claude Code 的 Hooks（修改 {configPath}）
          </p>
          {isProject && workingDirectory && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <FolderOpen size={11} className="text-primary" />
              <span>项目：<code className="font-mono text-foreground">{workingDirectory}</code></span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={fetchHooks}
          title="刷新"
        >
          <RefreshCw size={16} />
        </Button>
      </div>

      <div className="space-y-4">
        {HOOK_EVENTS.map((event) => {
          const entries = hooks[event.id] || []
          return (
            <Card key={event.id} className="overflow-hidden py-0 gap-0">
              <div className="flex items-center justify-between px-4 py-3 bg-card rounded-t-xl">
                <div>
                  <span className="text-sm font-medium">{event.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{event.desc}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setAddingTo(addingTo === event.id ? null : event.id)}
                >
                  <Plus size={14} />
                </Button>
              </div>

              {addingTo === event.id && (
                <div className="px-4 py-3 border-t border-border space-y-2">
                  <Input
                    value={newMatcher}
                    onChange={(e) => setNewMatcher(e.target.value)}
                    placeholder="匹配器 (可选，如: Bash, Edit)"
                  />
                  <Input
                    value={newCommand}
                    onChange={(e) => setNewCommand(e.target.value)}
                    placeholder="命令 (如: echo $TOOL_INPUT | jq .command)"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAddingTo(null)}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAdd(event.id)}
                      disabled={!newCommand.trim()}
                      className="bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white hover:opacity-90"
                    >
                      添加
                    </Button>
                  </div>
                </div>
              )}

              {entries.length > 0 && (
                <div className="divide-y divide-border">
                  {entries.map((entry, idx) => {
                    const isEditing = editingKey?.event === event.id && editingKey?.index === idx
                    return (
                      <div key={idx} className="px-4 py-2.5">
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={editMatcher}
                              onChange={(e) => setEditMatcher(e.target.value)}
                              placeholder="匹配器 (可选)"
                              className="h-8 text-xs"
                            />
                            <Input
                              value={editCommand}
                              onChange={(e) => setEditCommand(e.target.value)}
                              placeholder="命令"
                              className="h-8 text-xs"
                            />
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={cancelEdit}
                              >
                                <X size={12} className="mr-1" />
                                取消
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white hover:opacity-90"
                                onClick={handleUpdate}
                                disabled={!editCommand.trim()}
                              >
                                <Check size={12} className="mr-1" />
                                保存
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              {entry.matcher && (
                                <Badge className="bg-primary/15 text-primary mr-2">
                                  {entry.matcher}
                                </Badge>
                              )}
                              <code className="text-xs text-foreground">{entry.command}</code>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => startEdit(event.id, idx, entry)}
                                className="text-muted-foreground hover:text-primary"
                                title="编辑"
                              >
                                <Pencil size={12} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleRemove(event.id, idx)}
                                className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                title="删除"
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {entries.length === 0 && addingTo !== event.id && (
                <div className="px-4 py-3 text-xs text-muted-foreground">无已配置的钩子</div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
