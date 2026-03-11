import { useState, useEffect, useCallback } from 'react'
import { Puzzle, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp, Edit2, FolderOpen, FileText, Code, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Skill {
  name: string
  content: string
  hasReferences: boolean
  hasScripts: boolean
}

interface SkillsPanelProps {
  workingDirectory?: string
}

export default function SkillsPanel({ workingDirectory }: SkillsPanelProps) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)

  // 创建表单
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')

  // 编辑表单
  const [editingSkill, setEditingSkill] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const fetchSkills = useCallback(async () => {
    if (!workingDirectory) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/config/skills?workingDirectory=${encodeURIComponent(workingDirectory)}`)
      if (!res.ok) throw new Error('加载失败')
      const data = await res.json()
      setSkills(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch skills:', err)
      setError('加载技能列表失败，请重试')
    }
    setLoading(false)
  }, [workingDirectory])

  useEffect(() => {
    if (workingDirectory) {
      fetchSkills()
    } else {
      setSkills([])
    }
  }, [workingDirectory, fetchSkills])

  const resetCreateForm = () => {
    setNewName('')
    setNewContent('')
    setShowAdd(false)
  }

  const handleCreate = async () => {
    if (!newName.trim() || !workingDirectory) return
    setError(null)
    try {
      const res = await fetch('/api/config/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          content: newContent,
          workingDirectory,
        }),
      })
      if (res.status === 409) {
        setError(`技能 "${newName.trim()}" 已存在`)
        return
      }
      if (!res.ok) throw new Error('创建失败')
      resetCreateForm()
      fetchSkills()
    } catch (err) {
      console.error('Failed to create skill:', err)
      setError('创建技能失败，请重试')
    }
  }

  const startEdit = (skill: Skill) => {
    setEditingSkill(skill.name)
    setEditContent(skill.content)
    setExpandedSkill(skill.name)
  }

  const handleUpdate = async (name: string) => {
    if (!workingDirectory) return
    setError(null)
    try {
      const res = await fetch(`/api/config/skills/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent,
          workingDirectory,
        }),
      })
      if (!res.ok) throw new Error('更新失败')
      setEditingSkill(null)
      fetchSkills()
    } catch (err) {
      console.error('Failed to update skill:', err)
      setError('更新技能失败，请重试')
    }
  }

  const handleDelete = async (name: string) => {
    if (!workingDirectory) return
    if (!confirm(`确定删除技能 "${name}" 吗？该操作将删除整个技能目录（包括 references 和 scripts 子目录）。`)) return
    setError(null)
    try {
      const res = await fetch(`/api/config/skills/${encodeURIComponent(name)}?workingDirectory=${encodeURIComponent(workingDirectory)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('删除失败')
      if (expandedSkill === name) setExpandedSkill(null)
      if (editingSkill === name) setEditingSkill(null)
      fetchSkills()
    } catch (err) {
      console.error('Failed to delete skill:', err)
      setError('删除技能失败，请重试')
    }
  }

  const toggleExpand = (name: string) => {
    if (editingSkill === name) return
    setExpandedSkill(expandedSkill === name ? null : name)
  }

  /** 截取内容摘要（前 100 字） */
  const getSummary = (content: string) => {
    const trimmed = content.trim()
    if (trimmed.length <= 100) return trimmed
    return trimmed.slice(0, 100) + '...'
  }

  return (
    <div className="space-y-5">
      {/* Header section */}
      <Card className="bg-card/50 backdrop-blur-sm rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Puzzle size={24} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base mb-1.5">Skills 技能管理</CardTitle>
              <CardDescription className="leading-relaxed">
                Skills 允许你定义自定义命令来扩展 Claude Code 的能力。技能文件存放在项目的{' '}
                <code className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                  .claude/skills/
                </code>{' '}
                目录中。每个技能是一个包含{' '}
                <code className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                  SKILL.md
                </code>{' '}
                的子目录。
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
              Skills 是项目级配置，存放在项目的 <code className="font-mono text-primary">.claude/skills/</code> 目录中。请先在顶栏点击文件夹图标选择一个项目。
            </p>
          </CardContent>
        </Card>
      )}

      {/* 有项目时显示内容 */}
      {workingDirectory && (
        <>
          {/* 当前项目路径提示 */}
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <FolderOpen size={12} className="text-primary" />
            <span>
              当前项目：<code className="font-mono text-foreground">{workingDirectory}</code>
            </span>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3 animate-fade-in">
              {error}
            </div>
          )}

          {/* Skills 列表 */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-medium text-muted-foreground">
                项目技能
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={fetchSkills}
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
                  <CardTitle className="text-sm">创建新技能</CardTitle>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">技能名称（将作为目录名，建议使用小写字母和连字符）</label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                      placeholder="如: code-review, deploy-helper"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">
                      SKILL.md 内容（Markdown 格式，描述技能的触发条件和行为）
                    </label>
                    <Textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder={`# 技能名称\n\n## 触发条件\n当用户执行 /skill-name 命令时触发\n\n## 行为\n1. 步骤一\n2. 步骤二`}
                      className="min-h-40 font-mono text-sm"
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
                      disabled={!newName.trim()}
                      className="bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white hover:opacity-90"
                    >
                      创建
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Skills list */}
            {loading ? (
              <div className="text-muted-foreground text-sm p-4">加载中...</div>
            ) : skills.length === 0 ? (
              <Card className="border-dashed py-0">
                <CardContent className="p-8 text-center flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-3">
                    <Puzzle size={28} className="text-muted-foreground opacity-40" />
                  </div>
                  <p className="text-sm text-muted-foreground">暂无项目技能</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    点击上方"添加"按钮创建新的技能，或在项目的 .claude/skills/ 目录中手动添加
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {skills.map((skill) => {
                  const isExpanded = expandedSkill === skill.name
                  const isEditing = editingSkill === skill.name

                  return (
                    <Card
                      key={skill.name}
                      className={cn(
                        'py-0 transition-colors animate-fade-in',
                        isExpanded ? 'border-primary/30' : 'hover:border-muted-foreground'
                      )}
                    >
                      {/* Card header row */}
                      <CardContent
                        className="flex items-center justify-between p-4 cursor-pointer"
                        onClick={() => toggleExpand(skill.name)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Puzzle size={14} className="text-primary flex-shrink-0" />
                            <span className="font-medium text-sm truncate">{skill.name}</span>
                            {skill.hasReferences && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <FileText size={10} />
                                references
                              </Badge>
                            )}
                            {skill.hasScripts && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Code size={10} />
                                scripts
                              </Badge>
                            )}
                          </div>
                          {!isExpanded && skill.content && (
                            <p className="text-xs text-muted-foreground mt-1 truncate pl-5">
                              {getSummary(skill.content)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              startEdit(skill)
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
                              handleDelete(skill.name)
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
                                <label className="text-xs text-muted-foreground">SKILL.md 内容（Markdown）</label>
                                <Textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  placeholder="输入技能描述..."
                                  className="min-h-48 font-mono text-sm"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingSkill(null)}
                                >
                                  取消
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdate(skill.name)}
                                  className="bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white hover:opacity-90"
                                >
                                  保存
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* 目录结构信息 */}
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">目录结构</label>
                                <div className="text-xs text-foreground bg-accent/50 rounded-lg p-3 font-mono">
                                  <div>.claude/skills/{skill.name}/</div>
                                  <div className="pl-4">SKILL.md</div>
                                  {skill.hasReferences && <div className="pl-4 text-primary">references/</div>}
                                  {skill.hasScripts && <div className="pl-4 text-primary">scripts/</div>}
                                </div>
                              </div>
                              {/* SKILL.md 内容 */}
                              {skill.content ? (
                                <div className="space-y-1">
                                  <label className="text-xs text-muted-foreground">SKILL.md 内容</label>
                                  <pre className="text-xs text-foreground bg-accent/50 rounded-lg p-3 whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
                                    {skill.content}
                                  </pre>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">SKILL.md 内容为空</p>
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
        </>
      )}
    </div>
  )
}
