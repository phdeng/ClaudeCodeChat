import { useState, useEffect, useCallback, useMemo } from 'react'
import { Folder, FolderOpen, ChevronRight, ArrowUp, GitBranch, X, Loader2, Monitor, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/sessionStore'
import { useTranslation } from '../i18n'

interface DirectoryEntry {
  name: string
  path: string
  isGitRepo: boolean
}

interface BrowseResult {
  current: string
  parent: string | null
  directories: DirectoryEntry[]
  platform?: string
}

interface FolderPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (path: string) => void
  initialPath?: string
}

export default function FolderPicker({ open, onClose, onSelect, initialPath }: FolderPickerProps) {
  const { t } = useTranslation()
  const [currentPath, setCurrentPath] = useState(initialPath || '')
  const [directories, setDirectories] = useState<DirectoryEntry[]>([])
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputPath, setInputPath] = useState(initialPath || '')
  const [isWindows, setIsWindows] = useState(false)

  // 从历史会话中提取最近使用的项目路径（按最近使用排序，最多显示 5 个）
  const sessions = useSessionStore((s) => s.sessions)
  const recentProjects = useMemo(() => {
    const pathMap = new Map<string, number>() // path → latest createdAt
    for (const s of sessions) {
      if (s.workingDirectory) {
        const existing = pathMap.get(s.workingDirectory)
        if (!existing || s.createdAt > existing) {
          pathMap.set(s.workingDirectory, s.createdAt)
        }
      }
    }
    return Array.from(pathMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path]) => ({
        path,
        name: path.split(/[/\\]/).filter(Boolean).pop() || path,
      }))
  }, [sessions])

  const browse = useCallback(async (path?: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = path
        ? `/api/filesystem/browse?path=${encodeURIComponent(path)}`
        : '/api/filesystem/browse'
      const res = await fetch(url)
      if (!res.ok) throw new Error(t('folderPicker.invalidPath'))
      const data: BrowseResult = await res.json()
      setCurrentPath(data.current)
      setParentPath(data.parent)
      setDirectories(data.directories)
      // 盘符列表模式下不更新输入框
      if (data.current !== '__drives__') {
        setInputPath(data.current)
      } else {
        setInputPath('')
      }
      // 检测平台
      if (data.platform === 'win32') {
        setIsWindows(true)
      }
    } catch (e: any) {
      setError(e.message || t('folderPicker.invalidPath'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      browse(initialPath || undefined)
    }
  }, [open, initialPath, browse])

  const handleNavigate = (path: string) => {
    browse(path)
  }

  const [validating, setValidating] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)

  const handleGoToInput = async () => {
    const trimmed = inputPath.trim()
    if (!trimmed) return

    setValidating(true)
    setInputError(null)
    try {
      const res = await fetch(`/api/filesystem/validate?path=${encodeURIComponent(trimmed)}`)
      if (!res.ok) throw new Error('验证请求失败')
      const data = await res.json()
      if (data.valid) {
        setInputError(null)
        browse(data.path || trimmed)
      } else {
        setInputError(t('folderPicker.invalidPath'))
      }
    } catch (e: any) {
      setInputError(e.message || t('folderPicker.invalidPath'))
    } finally {
      setValidating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGoToInput()
    }
  }

  const handleSelect = () => {
    if (currentPath) {
      onSelect(currentPath)
      onClose()
    }
  }

  // Build breadcrumb segments from current path
  const breadcrumbs = currentPath
    ? currentPath.split(/[/\\]/).filter(Boolean)
    : []

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <Card className={cn(
        'max-h-[70vh] rounded-2xl flex flex-col gap-0 py-0 overflow-hidden shadow-2xl',
        recentProjects.length > 0 ? 'w-full max-w-2xl' : 'w-full max-w-lg'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <FolderOpen size={18} className="text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">{t('folderPicker.title')}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="text-foreground"
          >
            <X size={14} />
          </Button>
        </div>

        {/* Body: left-right layout */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left panel: Recent projects */}
          {recentProjects.length > 0 && (
            <div className="w-[200px] flex-shrink-0 border-r border-border flex flex-col">
              <div className="flex items-center gap-1.5 px-3 py-2.5">
                <History size={12} className="text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground font-medium">{t('folderPicker.recentProjects')}</span>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                {recentProjects.map((proj) => (
                  <button
                    key={proj.path}
                    onClick={() => {
                      onSelect(proj.path)
                      onClose()
                    }}
                    className="w-full flex flex-col gap-0.5 px-2.5 py-2 rounded-lg text-left hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen size={13} className="text-primary flex-shrink-0" />
                      <span className="text-[13px] font-medium text-foreground truncate">{proj.name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate pl-[21px]">{proj.path}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Right panel: Directory browser */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Path input */}
            <div className="px-4 py-3 border-b border-border space-y-1.5">
              <div className="flex items-center gap-2">
                <Input
                  value={inputPath}
                  onChange={(e) => {
                    setInputPath(e.target.value)
                    setInputError(null)
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={t('folderPicker.pathInput')}
                  className="text-[13px] h-8 bg-accent border-transparent focus-visible:border-ring font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGoToInput}
                  disabled={validating || !inputPath.trim()}
                  className="flex-shrink-0 text-[12px]"
                >
                  {validating ? <Loader2 size={12} className="animate-spin" /> : 'Go'}
                </Button>
              </div>
              {inputError && (
                <p className="text-[11px] text-destructive px-1">{inputError}</p>
              )}
            </div>

            {/* Breadcrumb */}
            {currentPath && currentPath !== '__drives__' && (
              <div className="flex items-center gap-1 px-4 py-2 text-[11px] text-muted-foreground overflow-x-auto flex-shrink-0">
                {isWindows && (
                  <span className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleNavigate('__drives__')}
                      className="hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <Monitor size={10} />
                      {t('folderPicker.driveSelect')}
                    </button>
                    <ChevronRight size={10} className="opacity-40" />
                  </span>
                )}
                {breadcrumbs.map((segment, i) => {
                  const isWinDrive = /^[a-zA-Z]:$/.test(breadcrumbs[0])
                  let resolvedPath: string
                  if (isWinDrive) {
                    resolvedPath = breadcrumbs.slice(0, i + 1).join('\\')
                    if (i === 0) {
                      resolvedPath += '\\'
                    }
                  } else {
                    resolvedPath = '/' + breadcrumbs.slice(0, i + 1).join('/')
                  }
                  return (
                    <span key={i} className="flex items-center gap-1 flex-shrink-0">
                      {i > 0 && <ChevronRight size={10} className="opacity-40" />}
                      <button
                        onClick={() => handleNavigate(resolvedPath)}
                        className="hover:text-primary transition-colors"
                      >
                        {segment}
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
            {currentPath === '__drives__' && (
              <div className="flex items-center gap-1.5 px-4 py-2 text-[11px] text-muted-foreground flex-shrink-0">
                <Monitor size={10} />
                <span>{t('folderPicker.driveSelect')}</span>
              </div>
            )}

            {/* Directory list */}
            <div className="flex-1 min-h-0 max-h-[300px] overflow-y-auto px-3 py-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="text-primary animate-spin" />
                  <span className="ml-2 text-[13px] text-muted-foreground">{t('common.loading')}</span>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-12">
                  <span className="text-[13px] text-destructive">{error}</span>
                </div>
              ) : (
                <>
                  {parentPath && (
                    <button
                      onClick={() => handleNavigate(parentPath)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-foreground hover:bg-accent transition-colors"
                    >
                      <ArrowUp size={14} className="opacity-60" />
                      <span>{t('folderPicker.parentDir')}</span>
                    </button>
                  )}

                  {directories.length === 0 && !parentPath && (
                    <p className="text-[12px] text-muted-foreground text-center py-8">
                      {t('folderPicker.emptyDir')}
                    </p>
                  )}

                  {directories.map((dir) => (
                    <button
                      key={dir.path}
                      onClick={() => handleNavigate(dir.path)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] hover:bg-accent transition-colors group',
                        dir.isGitRepo ? 'text-foreground' : 'text-foreground'
                      )}
                    >
                      <Folder size={14} className={cn(
                        'flex-shrink-0',
                        dir.isGitRepo ? 'text-primary' : 'text-muted-foreground opacity-60'
                      )} />
                      <span className="truncate flex-1 text-left">{dir.name}</span>
                      {dir.isGitRepo && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-auto rounded-sm gap-1 flex-shrink-0">
                          <GitBranch size={10} />
                          Git
                        </Badge>
                      )}
                      <ChevronRight size={14} className="flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <span className="text-[11px] text-muted-foreground truncate max-w-[60%]">
            {currentPath === '__drives__' ? t('folderPicker.driveSelect') : currentPath || '...'}
          </span>
          <Button
            size="sm"
            onClick={handleSelect}
            disabled={!currentPath || currentPath === '__drives__' || loading}
            className="text-[12px]"
          >
            {t('folderPicker.selectThis')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
