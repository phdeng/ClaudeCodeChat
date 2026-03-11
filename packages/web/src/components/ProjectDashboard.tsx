import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, GitBranch, MessageSquare, Plus, Settings, History, Clock, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSessionStore } from '../stores/sessionStore'
import { cn } from '@/lib/utils'

interface GitInfo {
  branch: string
  status: string
  hasChanges: boolean
  commitCount?: number
}

interface ProjectDashboardProps {
  workingDirectory: string
}

export default function ProjectDashboard({ workingDirectory }: ProjectDashboardProps) {
  const navigate = useNavigate()
  const { sessions, createSession } = useSessionStore()
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const [gitLoading, setGitLoading] = useState(true)

  // 项目名称：从路径中提取最后一个文件夹名
  const projectName = workingDirectory.split(/[/\\]/).filter(Boolean).pop() || workingDirectory

  // 该项目下的会话（排除已归档）
  const projectSessions = sessions
    .filter((s) => !s.archived && s.workingDirectory === workingDirectory)
    .sort((a, b) => b.createdAt - a.createdAt)

  const recentSessions = projectSessions.slice(0, 5)

  // 获取 Git 信息
  useEffect(() => {
    setGitLoading(true)
    fetch(`/api/filesystem/git-info?path=${encodeURIComponent(workingDirectory)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.branch) {
          setGitInfo(data)
        } else {
          setGitInfo(null)
        }
      })
      .catch(() => setGitInfo(null))
      .finally(() => setGitLoading(false))
  }, [workingDirectory])

  const handleNewChat = () => {
    const session = createSession()
    useSessionStore.getState().setSessionWorkingDirectory(session.id, workingDirectory)
    navigate(`/chat/${session.id}`)
  }

  const formatTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex-1 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="w-full max-w-[640px] space-y-6 animate-fade-in">
        {/* 项目信息卡片 */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FolderOpen size={24} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate">{projectName}</h2>
              <p className="text-[12px] text-muted-foreground truncate mt-0.5">{workingDirectory}</p>
              <div className="flex items-center gap-4 mt-2">
                {/* Git 分支 */}
                {gitLoading ? (
                  <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" />
                    <span>加载中...</span>
                  </div>
                ) : gitInfo ? (
                  <div className="flex items-center gap-1.5">
                    <GitBranch size={13} className="text-primary" />
                    <span className="text-[12px] font-medium text-foreground">{gitInfo.branch}</span>
                    {gitInfo.hasChanges && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400/80">
                        有更改
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <GitBranch size={12} />
                    <span>非 Git 仓库</span>
                  </div>
                )}
                {/* 会话数 */}
                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <MessageSquare size={12} />
                  <span>{projectSessions.length} 个会话</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 快捷操作 */}
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/30 transition-colors"
            onClick={handleNewChat}
          >
            <Plus size={20} className="text-primary" />
            <span className="text-[12px] font-medium">新对话</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-accent transition-colors"
            onClick={() => navigate('/sessions')}
          >
            <History size={20} className="text-muted-foreground" />
            <span className="text-[12px] font-medium">浏览历史</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-accent transition-colors"
            onClick={() => navigate('/settings')}
          >
            <Settings size={20} className="text-muted-foreground" />
            <span className="text-[12px] font-medium">项目设置</span>
          </Button>
        </div>

        {/* 最近活动 */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-[13px] font-semibold text-foreground">最近活动</h3>
            {projectSessions.length > 5 && (
              <Button
                variant="ghost"
                size="xs"
                className="text-[11px] text-foreground"
                onClick={() => navigate('/sessions')}
              >
                查看全部
                <ChevronRight size={12} />
              </Button>
            )}
          </div>
          {recentSessions.length > 0 ? (
            <div className="divide-y divide-border">
              {recentSessions.map((s) => (
                <button
                  key={s.id}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left",
                    "hover:bg-accent/50 transition-colors group"
                  )}
                  onClick={() => {
                    useSessionStore.getState().setActiveSession(s.id)
                    navigate(`/chat/${s.id}`)
                  }}
                >
                  <MessageSquare size={14} className="flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground truncate">{s.title}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatTime(s.createdAt)}
                      </span>
                      <span>{s.messages.length} 条消息</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <MessageSquare size={32} className="mx-auto text-muted-foreground opacity-30 mb-2" />
              <p className="text-[13px] text-muted-foreground">暂无会话记录</p>
              <p className="text-[11px] text-muted-foreground mt-1">点击上方"新对话"开始使用</p>
            </div>
          )}
        </div>

        {/* Git 状态详情（仅当有 Git 信息时显示） */}
        {gitInfo && gitInfo.status && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-[13px] font-semibold text-foreground mb-2 flex items-center gap-2">
              <GitBranch size={14} className="text-primary" />
              Git 状态
            </h3>
            <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-mono bg-background/50 rounded-lg p-3 max-h-[120px] overflow-y-auto">
              {gitInfo.status}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
