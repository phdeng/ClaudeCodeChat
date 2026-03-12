import { useState, useEffect, useCallback } from 'react'
import {
  GitBranch,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileEdit,
  FileX,
  FileQuestion,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  GitCommitHorizontal,
  Search,
  Upload,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/i18n'

// ===== 类型定义 =====

interface GitPanelProps {
  workingDirectory?: string
  open: boolean
  onClose: () => void
  onSendMessage?: (message: string) => void
}

/** 单个文件变更信息 */
interface GitFileChange {
  path: string
  status: 'M' | 'A' | 'D' | '?' | 'R' | 'C' | 'U'
}

/** Git 状态数据 */
interface GitStatusData {
  branch: string
  ahead: number
  behind: number
  staged: GitFileChange[]
  modified: GitFileChange[]
  untracked: GitFileChange[]
}

// ===== 辅助函数 =====

/** 根据文件状态返回图标和颜色 */
function getStatusIcon(status: string) {
  switch (status) {
    case 'A':
      return { icon: FilePlus, color: 'text-green-500' }
    case 'M':
      return { icon: FileEdit, color: 'text-orange-500' }
    case 'D':
      return { icon: FileX, color: 'text-red-500' }
    case '?':
      return { icon: FileQuestion, color: 'text-muted-foreground' }
    default:
      return { icon: FileEdit, color: 'text-muted-foreground' }
  }
}

/** 截断文件路径用于显示 */
function truncatePath(path: string, maxLen = 40): string {
  if (path.length <= maxLen) return path
  const parts = path.split('/')
  if (parts.length <= 2) return '...' + path.slice(-maxLen + 3)
  const filename = parts[parts.length - 1]
  const firstDir = parts[0]
  return `${firstDir}/.../${filename}`
}

// ===== Diff 渲染组件 =====

function DiffView({ diff, loading }: { diff: string | null; loading: boolean }) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        {t('git.diffLoading')}
      </div>
    )
  }

  if (!diff) return null

  const lines = diff.split('\n')
  return (
    <div className="border-t border-border bg-muted/30 p-2 overflow-x-auto">
      <pre className="font-mono text-[12px] leading-5">
        {lines.map((line, i) => {
          let lineClass = 'text-foreground'
          if (line.startsWith('@@')) {
            lineClass = 'text-blue-400 font-semibold'
          } else if (line.startsWith('+') && !line.startsWith('+++')) {
            lineClass = 'text-green-400 bg-green-500/10'
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            lineClass = 'text-red-400 bg-red-500/10'
          }
          return (
            <div key={i} className={cn('px-2 whitespace-pre', lineClass)}>
              {line || ' '}
            </div>
          )
        })}
      </pre>
    </div>
  )
}

// ===== 文件分组组件 =====

interface FileGroupProps {
  title: string
  files: GitFileChange[]
  color: string
  badgeColor: string
  expandedFile: string | null
  diffMap: Record<string, string>
  diffLoading: string | null
  onToggleFile: (path: string) => void
}

function FileGroup({
  title,
  files,
  color,
  badgeColor,
  expandedFile,
  diffMap,
  diffLoading,
  onToggleFile,
}: FileGroupProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)

  if (files.length === 0) return null

  return (
    <div className="mb-3">
      {/* 分组标题 */}
      <button
        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm font-medium hover:bg-muted/50 rounded transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        <span className={cn('size-2 rounded-full', badgeColor)} />
        <span className={color}>{title}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {t('git.files', { count: String(files.length) })}
        </span>
      </button>

      {/* 文件列表 */}
      {!collapsed && (
        <div className="ml-2 mt-1 space-y-px">
          {files.map((file) => {
            const { icon: StatusIcon, color: iconColor } = getStatusIcon(file.status)
            const isExpanded = expandedFile === file.path
            return (
              <div key={file.path}>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded hover:bg-muted/50 transition-colors group"
                  onClick={() => onToggleFile(file.path)}
                >
                  <StatusIcon className={cn('size-3.5 shrink-0', iconColor)} />
                  <span className="truncate text-left flex-1" title={file.path}>
                    {truncatePath(file.path)}
                  </span>
                  <span className={cn('text-xs font-mono shrink-0', iconColor)}>
                    {file.status === '?' ? '?' : file.status}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <DiffView
                    diff={diffMap[file.path] ?? null}
                    loading={diffLoading === file.path}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ===== 主面板组件 =====

/**
 * Git 操作集成面板
 * 展示工作目录的 Git 状态并提供快捷操作
 */
export default function GitPanel({ workingDirectory, open, onClose, onSendMessage }: GitPanelProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<GitStatusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [diffMap, setDiffMap] = useState<Record<string, string>>({})
  const [diffLoading, setDiffLoading] = useState<string | null>(null)

  // 获取 Git 状态
  const fetchStatus = useCallback(async () => {
    if (!workingDirectory) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/filesystem/git-status?path=${encodeURIComponent(workingDirectory)}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data: GitStatusData = await res.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('git.notGitRepo'))
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [workingDirectory, t])

  // 面板打开时自动获取状态
  useEffect(() => {
    if (open && workingDirectory) {
      fetchStatus()
    }
    // 面板关闭时重置展开状态
    if (!open) {
      setExpandedFile(null)
      setDiffMap({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchStatus 包含 t()，每次渲染都会变化，只需在 open/workingDirectory 变化时触发
  }, [open, workingDirectory])

  // 获取文件 diff
  const fetchDiff = useCallback(
    async (filePath: string) => {
      if (!workingDirectory) return
      setDiffLoading(filePath)
      try {
        const res = await fetch(
          `/api/filesystem/git-diff?path=${encodeURIComponent(workingDirectory)}&file=${encodeURIComponent(filePath)}`
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setDiffMap((prev) => ({ ...prev, [filePath]: data.diff || '' }))
      } catch {
        setDiffMap((prev) => ({ ...prev, [filePath]: '// 无法加载 diff' }))
      } finally {
        setDiffLoading(null)
      }
    },
    [workingDirectory]
  )

  // 切换文件展开/收起
  const handleToggleFile = useCallback(
    (filePath: string) => {
      if (expandedFile === filePath) {
        setExpandedFile(null)
      } else {
        setExpandedFile(filePath)
        // 如果还没有加载过 diff，则加载
        if (!diffMap[filePath]) {
          fetchDiff(filePath)
        }
      }
    },
    [expandedFile, diffMap, fetchDiff]
  )

  // 快捷操作：发送消息到对话
  const handleAction = useCallback(
    (prompt: string) => {
      if (onSendMessage) {
        onSendMessage(prompt)
      }
      onClose()
    },
    [onSendMessage, onClose]
  )

  // 判断是否有变更
  const hasChanges = status && (status.staged.length > 0 || status.modified.length > 0 || status.untracked.length > 0)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[420px] p-0 flex flex-col"
      >
        {/* 标题栏 */}
        <SheetHeader className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-3 pr-6">
            <SheetTitle className="flex items-center gap-2 text-base">
              <GitBranch className="size-4" />
              {t('git.title')}
            </SheetTitle>
            {status?.branch && (
              <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                {status.branch}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 ml-auto"
              onClick={fetchStatus}
              disabled={loading}
              title={t('git.refresh')}
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </Button>
          </div>
        </SheetHeader>

        <Separator />

        {/* 内容区域 */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* 加载状态 */}
            {loading && !status && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="size-6 animate-spin mb-3" />
                <span className="text-sm">{t('git.loading')}</span>
              </div>
            )}

            {/* 错误状态 */}
            {error && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="size-6 mb-3 text-destructive" />
                <span className="text-sm text-center">{error}</span>
              </div>
            )}

            {/* Git 状态内容 */}
            {status && !loading && (
              <>
                {/* 分支信息 */}
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50">
                  <GitBranch className="size-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-bold">{status.branch}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {status.ahead > 0 && (
                      <span className="flex items-center gap-0.5 text-green-500">
                        <ArrowUp className="size-3" />
                        {status.ahead}
                      </span>
                    )}
                    {status.behind > 0 && (
                      <span className="flex items-center gap-0.5 text-orange-500">
                        <ArrowDown className="size-3" />
                        {status.behind}
                      </span>
                    )}
                    {status.ahead === 0 && status.behind === 0 && (
                      <span className="text-muted-foreground">
                        <ArrowUp className="size-3 inline" />0{' '}
                        <ArrowDown className="size-3 inline" />0
                      </span>
                    )}
                  </div>
                </div>

                <Separator />

                {/* 文件变更列表 */}
                {hasChanges ? (
                  <div>
                    <FileGroup
                      title={t('git.staged')}
                      files={status.staged}
                      color="text-green-500"
                      badgeColor="bg-green-500"
                      expandedFile={expandedFile}
                      diffMap={diffMap}
                      diffLoading={diffLoading}
                      onToggleFile={handleToggleFile}
                    />
                    <FileGroup
                      title={t('git.modified')}
                      files={status.modified}
                      color="text-orange-500"
                      badgeColor="bg-orange-500"
                      expandedFile={expandedFile}
                      diffMap={diffMap}
                      diffLoading={diffLoading}
                      onToggleFile={handleToggleFile}
                    />
                    <FileGroup
                      title={t('git.untracked')}
                      files={status.untracked}
                      color="text-muted-foreground"
                      badgeColor="bg-gray-500"
                      expandedFile={expandedFile}
                      diffMap={diffMap}
                      diffLoading={diffLoading}
                      onToggleFile={handleToggleFile}
                    />
                  </div>
                ) : (
                  /* 空状态 */
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckCircle2 className="size-8 mb-3 text-green-500" />
                    <span className="text-sm">{t('git.clean')}</span>
                  </div>
                )}
              </>
            )}

            {/* 未选择工作目录 */}
            {!workingDirectory && !loading && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="size-6 mb-3" />
                <span className="text-sm">{t('git.notGitRepo')}</span>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 底部操作栏 */}
        {status && hasChanges && (
          <>
            <Separator />
            <div className="p-3 space-y-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => handleAction(t('git.commitPrompt'))}
              >
                <GitCommitHorizontal className="size-3.5" />
                {t('git.askCommit')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => handleAction(t('git.reviewPrompt'))}
              >
                <Search className="size-3.5" />
                {t('git.askReview')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => handleAction(t('git.pushPrompt'))}
              >
                <Upload className="size-3.5" />
                {t('git.askPush')}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
