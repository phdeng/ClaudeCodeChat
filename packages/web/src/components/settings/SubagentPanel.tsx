import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp, Brain, Compass, Search, ListChecks, Edit2, FolderOpen, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface CustomAgent {
  name: string
  frontmatter: {
    description?: string
    model?: string
    tools?: string | string[]
    [key: string]: unknown
  }
  body: string
}

/** 将 tools 转为数组（后端可能返回字符串或数组） */
function parseTools(tools?: string | string[]): string[] {
  if (!tools) return []
  if (Array.isArray(tools)) return tools
  return tools.split(',').map(t => t.trim()).filter(Boolean)
}

const subagentTypes = [
  {
    name: 'General Purpose',
    label: '通用代理',
    description: '全能型子代理，可以处理各种常见任务，包括代码编写、文件操作和信息查询。适用于大多数场景。',
    icon: Brain,
  },
  {
    name: 'Explore',
    label: '探索代理',
    description: '专注于代码库搜索和理解，快速定位相关文件、函数和代码模式。擅长大型项目的代码导航。',
    icon: Compass,
  },
  {
    name: 'Search',
    label: '搜索代理',
    description: '利用网络搜索能力获取最新信息、文档和技术资料。适用于需要外部知识的场景。',
    icon: Search,
  },
  {
    name: 'Plan',
    label: '规划代理',
    description: '分析复杂需求并制定详细的实施计划，将大任务拆解为可执行的步骤和子任务。',
    icon: ListChecks,
  },
]

const MODEL_OPTIONS = [
  { value: 'inherit', label: '继承 (inherit)' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'opus', label: 'Opus' },
  { value: 'haiku', label: 'Haiku' },
]

const selectClassName =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30'

interface SubagentPanelProps {
  scope?: 'global' | 'project'
  workingDirectory?: string
}

export default function SubagentPanel({ scope = 'global', workingDirectory }: SubagentPanelProps) {
  const [agents, setAgents] = useState<CustomAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  // 创建表单
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newModel, setNewModel] = useState('inherit')
  const [newTools, setNewTools] = useState('')
  const [newBody, setNewBody] = useState('')

  // 编辑表单
  const [editingAgent, setEditingAgent] = useState<string | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editModel, setEditModel] = useState('inherit')
  const [editTools, setEditTools] = useState('')
  const [editBody, setEditBody] = useState('')

  const isProject = scope === 'project'
  const needsWorkingDir = isProject && !workingDirectory

  const buildQueryParams = useCallback(() => {
    if (isProject && workingDirectory) {
      return `?scope=project&workingDirectory=${encodeURIComponent(workingDirectory)}`
    }
    return ''
  }, [isProject, workingDirectory])

  const fetchAgents = useCallback(async () => {
    if (needsWorkingDir) {
      setAgents([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/config/agents${buildQueryParams()}`)
      const data = await res.json()
      setAgents(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch agents:', err)
      setError('加载自定义代理失败，请重试')
    }
    setLoading(false)
  }, [buildQueryParams, needsWorkingDir])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const resetCreateForm = () => {
    setNewName('')
    setNewDescription('')
    setNewModel('inherit')
    setNewTools('')
    setNewBody('')
    setShowAdd(false)
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newDescription.trim()) return
    setError(null)
    try {
      const tools = newTools.trim()
        ? newTools.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined
      const body: Record<string, any> = {
        name: newName.trim(),
        frontmatter: {
          description: newDescription.trim(),
          model: newModel !== 'inherit' ? newModel : undefined,
          tools,
        },
        body: newBody,
      }
      if (isProject && workingDirectory) {
        body.scope = 'project'
        body.workingDirectory = workingDirectory
      }
      const res = await fetch('/api/config/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('创建失败')
      resetCreateForm()
      fetchAgents()
    } catch (err) {
      console.error('Failed to create agent:', err)
      setError('创建代理失败，请重试')
    }
  }

  const startEdit = (agent: CustomAgent) => {
    setEditingAgent(agent.name)
    setEditDescription(agent.frontmatter.description || '')
    setEditModel(agent.frontmatter.model || 'inherit')
    setEditTools(parseTools(agent.frontmatter.tools).join(', '))
    setEditBody(agent.body || '')
    setExpandedAgent(agent.name)
  }

  const handleUpdate = async (name: string) => {
    if (!editDescription.trim()) return
    setError(null)
    try {
      const tools = editTools.trim()
        ? editTools.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined
      const body: Record<string, any> = {
        name,
        frontmatter: {
          description: editDescription.trim(),
          model: editModel !== 'inherit' ? editModel : undefined,
          tools,
        },
        body: editBody,
      }
      if (isProject && workingDirectory) {
        body.scope = 'project'
        body.workingDirectory = workingDirectory
      }
      const res = await fetch(`/api/config/agents/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('更新失败')
      setEditingAgent(null)
      fetchAgents()
    } catch (err) {
      console.error('Failed to update agent:', err)
      setError('更新代理失败，请重试')
    }
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`确定删除自定义代理 "${name}" 吗？`)) return
    setError(null)
    try {
      const res = await fetch(`/api/config/agents/${encodeURIComponent(name)}${buildQueryParams()}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('删除失败')
      if (expandedAgent === name) setExpandedAgent(null)
      if (editingAgent === name) setEditingAgent(null)
      fetchAgents()
    } catch (err) {
      console.error('Failed to delete agent:', err)
      setError('删除代理失败，请重试')
    }
  }

  const toggleExpand = (name: string) => {
    if (editingAgent === name) return
    setExpandedAgent(expandedAgent === name ? null : name)
  }

  // 项目模式但未选择项目
  if (needsWorkingDir) {
    return (
      <div className="space-y-5">
        <Card className="bg-card/50 backdrop-blur-sm rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Users size={24} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base mb-1.5">Subagent 子代理管理</CardTitle>
                <CardDescription className="leading-relaxed">
                  管理项目级子代理（存放在项目的 <code className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">.claude/agents/</code> 目录中）。
                </CardDescription>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-dashed border-amber-500/50 py-0">
          <CardContent className="p-6 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={28} className="text-amber-400/80" />
            </div>
            <p className="text-sm font-medium text-foreground">请先选择项目文件夹</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm">
              项目级子代理存放在项目的 <code className="font-mono text-primary">.claude/agents/</code> 目录中。请先在顶栏点击文件夹图标选择一个项目。
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const configPath = isProject && workingDirectory
    ? `${workingDirectory}/.claude/agents/`
    : '~/.claude/agents/'

  return (
    <div className="space-y-5">
      {/* Header section */}
      <Card className="bg-card/50 backdrop-blur-sm rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Users size={24} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base mb-1.5">Subagent 子代理管理</CardTitle>
              <CardDescription className="leading-relaxed">
                子代理是 Claude Code 可以调用的专门化助手，用于并行处理复杂任务。你可以创建自定义子代理来满足特定需求。
                {isProject ? (
                  <span className="block mt-1 text-xs">
                    配置路径：<code className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">{configPath}</code>
                  </span>
                ) : null}
              </CardDescription>
            </div>
          </div>
        </CardContent>
      </Card>

      {isProject && workingDirectory && (
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <FolderOpen size={12} className="text-primary" />
          <span>
            当前项目：<code className="font-mono text-foreground">{workingDirectory}</code>
          </span>
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3 animate-fade-in">
          {error}
        </div>
      )}

      {/* Built-in subagent types (only show for global scope) */}
      {!isProject && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">
            内置子代理类型
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subagentTypes.map((agent) => (
              <Card
                key={agent.name}
                className="bg-card/50 backdrop-blur-sm rounded-2xl hover:border-border transition-colors animate-fade-in group"
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                      <agent.icon size={18} className="text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {agent.name}
                      </h4>
                      <Badge variant="outline" className="text-xs mt-0.5">
                        {agent.label}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {agent.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Custom subagents */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-medium text-muted-foreground">
            {isProject ? '项目子代理' : '自定义子代理'}
          </h3>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={fetchAgents}
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

        {/* Add form */}
        {showAdd && (
          <Card className="animate-fade-in py-0 mb-3">
            <CardContent className="p-4 space-y-3">
              <CardTitle className="text-sm">创建{isProject ? '项目' : '自定义'}子代理</CardTitle>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">名称（小写字母和连字符）</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="如: code-reviewer"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">描述</label>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="描述该代理的功能和用途"
                  className="min-h-12"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <label className="text-xs text-muted-foreground">模型</label>
                  <select
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    className={selectClassName}
                  >
                    {MODEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-xs text-muted-foreground">工具（逗号分隔，可选）</label>
                  <Input
                    value={newTools}
                    onChange={(e) => setNewTools(e.target.value)}
                    placeholder="如: Bash, Read, Edit"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">系统提示词（Markdown）</label>
                <Textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="输入该代理的系统提示词..."
                  className="min-h-24"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetCreateForm}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!newName.trim() || !newDescription.trim()}
                  className="bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white hover:opacity-90"
                >
                  创建
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Custom agents list */}
        {loading ? (
          <div className="text-muted-foreground text-sm p-4">加载中...</div>
        ) : agents.length === 0 ? (
          <Card className="border-dashed py-0">
            <CardContent className="p-8 text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-3">
                <Users size={28} className="text-muted-foreground opacity-40" />
              </div>
              <p className="text-sm text-muted-foreground">暂无{isProject ? '项目' : '自定义'}子代理</p>
              <p className="text-xs text-muted-foreground mt-1">点击上方"添加"按钮创建新的子代理</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => {
              const isExpanded = expandedAgent === agent.name
              const isEditing = editingAgent === agent.name

              return (
                <Card
                  key={agent.name}
                  className={cn(
                    'py-0 transition-colors animate-fade-in',
                    isExpanded ? 'border-primary/30' : 'hover:border-muted-foreground'
                  )}
                >
                  {/* Card header row */}
                  <CardContent
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => toggleExpand(agent.name)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-primary flex-shrink-0" />
                        <span className="font-medium text-sm truncate">{agent.name}</span>
                        {agent.frontmatter.model && (
                          <Badge variant="secondary" className="text-xs">
                            {agent.frontmatter.model}
                          </Badge>
                        )}
                      </div>
                      {agent.frontmatter.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate pl-5">
                          {agent.frontmatter.description}
                        </p>
                      )}
                      {(() => {
                        const toolList = parseTools(agent.frontmatter.tools)
                        return toolList.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1.5 pl-5">
                            {toolList.map((tool) => (
                              <Badge key={tool} variant="outline" className="text-xs">
                                {tool}
                              </Badge>
                            ))}
                          </div>
                        ) : null
                      })()}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          startEdit(agent)
                        }}
                        className="text-muted-foreground hover:text-primary"
                        title="编辑"
                      >
                        <Edit2 size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(agent.name)
                        }}
                        className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title="删除"
                      >
                        <Trash2 size={13} />
                      </Button>
                      {isExpanded ? (
                        <ChevronUp size={14} className="text-muted-foreground" />
                      ) : (
                        <ChevronDown size={14} className="text-muted-foreground" />
                      )}
                    </div>
                  </CardContent>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 space-y-3 animate-fade-in">
                      {isEditing ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs text-muted-foreground">描述</label>
                            <Textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="描述该代理的功能和用途"
                              className="min-h-12"
                            />
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-1 space-y-2">
                              <label className="text-xs text-muted-foreground">模型</label>
                              <select
                                value={editModel}
                                onChange={(e) => setEditModel(e.target.value)}
                                className={selectClassName}
                              >
                                {MODEL_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-1 space-y-2">
                              <label className="text-xs text-muted-foreground">工具（逗号分隔）</label>
                              <Input
                                value={editTools}
                                onChange={(e) => setEditTools(e.target.value)}
                                placeholder="如: Bash, Read, Edit"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-muted-foreground">系统提示词（Markdown）</label>
                            <Textarea
                              value={editBody}
                              onChange={(e) => setEditBody(e.target.value)}
                              placeholder="输入该代理的系统提示词..."
                              className="min-h-24"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingAgent(null)}
                            >
                              取消
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleUpdate(agent.name)}
                              disabled={!editDescription.trim()}
                              className="bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white hover:opacity-90"
                            >
                              保存
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          {agent.body && (
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">系统提示词</label>
                              <pre className="text-xs text-foreground bg-accent/50 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                {agent.body}
                              </pre>
                            </div>
                          )}
                          {!agent.body && (
                            <p className="text-xs text-muted-foreground">无系统提示词</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
