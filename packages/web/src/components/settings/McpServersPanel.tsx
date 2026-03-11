import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Server, RefreshCw, Pencil, X, Check, FolderOpen, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface McpServer {
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  type?: string
}

interface McpServersPanelProps {
  scope?: 'global' | 'project'
  workingDirectory?: string
}

export default function McpServersPanel({ scope = 'global', workingDirectory }: McpServersPanelProps) {
  const [servers, setServers] = useState<Record<string, McpServer>>({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'stdio' | 'sse'>('stdio')
  const [newCommand, setNewCommand] = useState('')
  const [newArgs, setNewArgs] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newEnvPairs, setNewEnvPairs] = useState<{ key: string; value: string }[]>([])

  // 编辑模式状态
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editCommand, setEditCommand] = useState('')
  const [editArgs, setEditArgs] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editEnvPairs, setEditEnvPairs] = useState<{ key: string; value: string }[]>([])

  const isProject = scope === 'project'
  const needsWorkingDir = isProject && !workingDirectory

  const buildQueryParams = useCallback(() => {
    if (isProject && workingDirectory) {
      return `?scope=project&workingDirectory=${encodeURIComponent(workingDirectory)}`
    }
    return ''
  }, [isProject, workingDirectory])

  const fetchServers = useCallback(async () => {
    if (needsWorkingDir) {
      setServers({})
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/config/mcp-servers${buildQueryParams()}`)
      const data = await res.json()
      setServers(data)
    } catch (err) {
      console.error('Failed to fetch MCP servers:', err)
      toast.error('获取 MCP 服务器列表失败')
    }
    setLoading(false)
  }, [buildQueryParams, needsWorkingDir])

  useEffect(() => { fetchServers() }, [fetchServers])

  const handleAdd = async () => {
    if (!newName.trim()) return
    try {
      const env: Record<string, string> = {}
      for (const pair of newEnvPairs) {
        if (pair.key.trim()) {
          env[pair.key.trim()] = pair.value
        }
      }
      const config: McpServer = newType === 'stdio'
        ? { command: newCommand, args: newArgs ? newArgs.split(/\s+/) : [], ...(Object.keys(env).length > 0 ? { env } : {}) }
        : { url: newUrl, type: 'sse', ...(Object.keys(env).length > 0 ? { env } : {}) }

      const body: Record<string, any> = { name: newName.trim(), config }
      if (isProject && workingDirectory) {
        body.scope = 'project'
        body.workingDirectory = workingDirectory
      }

      const res = await fetch('/api/config/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '添加失败')
      }
      setNewName('')
      setNewCommand('')
      setNewArgs('')
      setNewUrl('')
      setNewEnvPairs([])
      setShowAdd(false)
      toast.success(`MCP 服务器 "${newName.trim()}" 已添加`)
      fetchServers()
    } catch (err: any) {
      toast.error(err.message || '添加 MCP 服务器失败')
    }
  }

  const handleRemove = async (name: string) => {
    if (!confirm(`确定删除 MCP 服务器 "${name}" 吗？`)) return
    try {
      const res = await fetch(`/api/config/mcp-servers/${encodeURIComponent(name)}${buildQueryParams()}`, { method: 'DELETE' })
      if (!res.ok) {
        throw new Error('删除失败')
      }
      toast.success(`MCP 服务器 "${name}" 已删除`)
      fetchServers()
    } catch (err: any) {
      toast.error(err.message || '删除 MCP 服务器失败')
    }
  }

  const startEdit = (name: string, config: McpServer) => {
    setEditingName(name)
    setEditCommand(config.command || '')
    setEditArgs((config.args || []).join(' '))
    setEditUrl(config.url || '')
    const envEntries = Object.entries(config.env || {})
    setEditEnvPairs(envEntries.length > 0 ? envEntries.map(([key, value]) => ({ key, value })) : [])
  }

  const cancelEdit = () => {
    setEditingName(null)
    setEditCommand('')
    setEditArgs('')
    setEditUrl('')
    setEditEnvPairs([])
  }

  const handleUpdate = async (name: string, isSSE: boolean) => {
    try {
      const env: Record<string, string> = {}
      for (const pair of editEnvPairs) {
        if (pair.key.trim()) {
          env[pair.key.trim()] = pair.value
        }
      }
      const config: McpServer = isSSE
        ? { url: editUrl, type: 'sse', ...(Object.keys(env).length > 0 ? { env } : {}) }
        : { command: editCommand, args: editArgs ? editArgs.split(/\s+/) : [], ...(Object.keys(env).length > 0 ? { env } : {}) }

      const body: Record<string, any> = { config }
      if (isProject && workingDirectory) {
        body.scope = 'project'
        body.workingDirectory = workingDirectory
      }

      const res = await fetch(`/api/config/mcp-servers/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '更新失败')
      }
      cancelEdit()
      toast.success(`MCP 服务器 "${name}" 已更新`)
      fetchServers()
    } catch (err: any) {
      toast.error(err.message || '更新 MCP 服务器失败')
    }
  }

  const renderEnvEditor = (
    pairs: { key: string; value: string }[],
    setPairs: (pairs: { key: string; value: string }[]) => void
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">环境变量</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => setPairs([...pairs, { key: '', value: '' }])}
        >
          <Plus size={12} className="mr-1" />
          添加变量
        </Button>
      </div>
      {pairs.map((pair, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <Input
            value={pair.key}
            onChange={(e) => {
              const updated = [...pairs]
              updated[idx] = { ...updated[idx], key: e.target.value }
              setPairs(updated)
            }}
            placeholder="变量名"
            className="flex-1 h-8 text-xs"
          />
          <span className="text-muted-foreground text-xs">=</span>
          <Input
            value={pair.value}
            onChange={(e) => {
              const updated = [...pairs]
              updated[idx] = { ...updated[idx], value: e.target.value }
              setPairs(updated)
            }}
            placeholder="值"
            className="flex-1 h-8 text-xs"
          />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setPairs(pairs.filter((_, i) => i !== idx))}
            className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0"
          >
            <X size={12} />
          </Button>
        </div>
      ))}
    </div>
  )

  // 项目模式但未选择项目
  if (needsWorkingDir) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          管理项目级 MCP 服务器（修改 ~/.claude.json 中的项目配置）
        </p>
        <Card className="border-dashed border-amber-500/50 py-0">
          <CardContent className="p-6 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={28} className="text-amber-400/80" />
            </div>
            <p className="text-sm font-medium text-foreground">请先选择项目文件夹</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm">
              项目级 MCP 服务器配置存放在 <code className="font-mono text-primary">~/.claude.json</code> 的 projects 字段中。请先在顶栏点击文件夹图标选择一个项目。
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm p-4">加载中...</div>
  }

  const serverEntries = Object.entries(servers)
  const configPath = isProject && workingDirectory
    ? `~/.claude.json → projects["${workingDirectory.replace(/\\/g, '/')}"].mcpServers`
    : '~/.claude.json → mcpServers'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            管理 Claude Code 使用的 MCP 服务器（修改 {configPath}）
          </p>
          {isProject && workingDirectory && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <FolderOpen size={11} className="text-primary" />
              <span>项目：<code className="font-mono text-foreground">{workingDirectory}</code></span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={fetchServers}
            title="刷新"
          >
            <RefreshCw size={16} />
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAdd(!showAdd)}
            className="bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white hover:opacity-90"
          >
            <Plus size={14} />
            添加
          </Button>
        </div>
      </div>

      {showAdd && (
        <Card className="animate-fade-in py-0">
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-3">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="服务器名称"
                className="flex-1"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'stdio' | 'sse')}
                className="rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground outline-none"
              >
                <option value="stdio">stdio</option>
                <option value="sse">SSE</option>
              </select>
            </div>
            {newType === 'stdio' ? (
              <>
                <Input
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                  placeholder="命令 (如: npx, node, python)"
                />
                <Input
                  value={newArgs}
                  onChange={(e) => setNewArgs(e.target.value)}
                  placeholder="参数 (空格分隔，如: -y @modelcontextprotocol/server-filesystem /path)"
                />
              </>
            ) : (
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="服务器 URL (如: http://localhost:8080/sse)"
              />
            )}
            {renderEnvEditor(newEnvPairs, setNewEnvPairs)}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowAdd(false); setNewEnvPairs([]) }}
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white hover:opacity-90"
              >
                保存
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {serverEntries.length === 0 ? (
        <Card className="border-dashed py-0">
          <CardContent className="p-8 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-3">
              <Server size={28} className="text-muted-foreground opacity-40" />
            </div>
            <p className="text-sm text-muted-foreground">暂无 MCP 服务器</p>
            <p className="text-xs text-muted-foreground mt-1">点击上方"添加"按钮配置新的 MCP 服务器</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {serverEntries.map(([name, config]) => {
            const isSSE = !!config.url
            const isEditing = editingName === name
            const envEntries = Object.entries(config.env || {})

            return (
              <Card
                key={name}
                className="py-0 hover:border-muted-foreground transition-colors animate-fade-in"
              >
                <CardContent className="p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Server size={14} className="text-primary flex-shrink-0" />
                        <span className="font-medium text-sm">{name}</span>
                        <Badge variant="secondary">{isSSE ? 'SSE' : 'stdio'}</Badge>
                      </div>
                      {isSSE ? (
                        <Input
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          placeholder="服务器 URL"
                        />
                      ) : (
                        <>
                          <Input
                            value={editCommand}
                            onChange={(e) => setEditCommand(e.target.value)}
                            placeholder="命令"
                          />
                          <Input
                            value={editArgs}
                            onChange={(e) => setEditArgs(e.target.value)}
                            placeholder="参数 (空格分隔)"
                          />
                        </>
                      )}
                      {renderEnvEditor(editEnvPairs, setEditEnvPairs)}
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={cancelEdit}>
                          取消
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleUpdate(name, isSSE)}
                          className="bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white hover:opacity-90"
                        >
                          <Check size={14} className="mr-1" />
                          保存
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Server size={14} className="text-primary flex-shrink-0" />
                            <span className="font-medium text-sm truncate">{name}</span>
                            <Badge variant="secondary">
                              {isSSE ? 'SSE' : 'stdio'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate pl-5">
                            {config.command ? `${config.command} ${(config.args || []).join(' ')}` : config.url || ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => startEdit(name, config)}
                            className="text-muted-foreground hover:text-primary"
                            title="编辑"
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleRemove(name)}
                            className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="删除"
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </div>
                      {envEntries.length > 0 && (
                        <div className="mt-2 pl-5 space-y-0.5">
                          <span className="text-xs text-muted-foreground">环境变量:</span>
                          {envEntries.map(([k, v]) => (
                            <div key={k} className="text-xs font-mono text-muted-foreground">
                              {k}={v}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
