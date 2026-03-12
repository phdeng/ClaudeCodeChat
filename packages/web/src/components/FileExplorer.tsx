import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Folder, FolderOpen, File, FileText, FileCode, Image as ImageIcon,
  ChevronRight, ChevronDown, Search, RefreshCw,
} from 'lucide-react'
import { useFileExplorerStore, type OpenFileTab } from '@/stores/fileExplorerStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

/** 文件条目类型 */
interface FileEntry {
  name: string
  path: string
  type: 'directory' | 'file'
  size?: number
  extension?: string
}

/** 语言映射 */
const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', go: 'go', rs: 'rust', md: 'markdown', mdx: 'markdown',
  json: 'json', css: 'css', scss: 'scss', html: 'html', xml: 'xml',
  yaml: 'yaml', yml: 'yaml', toml: 'toml', sql: 'sql',
  java: 'java', kt: 'kotlin', swift: 'swift', c: 'c', cpp: 'cpp',
  h: 'c', hpp: 'cpp', cs: 'csharp', rb: 'ruby', php: 'php',
  sh: 'shell', bash: 'shell', ps1: 'powershell', bat: 'batch',
}

/** 根据扩展名获取语言 */
function getLang(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return LANG_MAP[ext] || 'plaintext'
}

/** 根据文件类型选择图标 */
function getFileIcon(entry: FileEntry, isExpanded?: boolean) {
  if (entry.type === 'directory') return isExpanded ? FolderOpen : Folder
  const ext = entry.extension?.toLowerCase() || ''
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.cpp', '.c', '.h', '.cs', '.rb', '.php'].includes(ext)) return FileCode
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'].includes(ext)) return ImageIcon
  if (['.md', '.mdx', '.txt', '.log', '.csv'].includes(ext)) return FileText
  return File
}

/** 格式化文件大小 */
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** 递归树节点组件 */
function TreeNode({ entry, depth }: { entry: FileEntry; depth: number }) {
  const { toggleDir, isDirExpanded, openFile, activeTabPath } = useFileExplorerStore()
  const [children, setChildren] = useState<FileEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const isExpanded = isDirExpanded(entry.path)
  const isActive = activeTabPath === entry.path

  // 展开目录时获取子条目
  useEffect(() => {
    if (entry.type === 'directory' && isExpanded && !loaded) {
      fetch(`/api/filesystem/files?path=${encodeURIComponent(entry.path)}`)
        .then(res => res.json())
        .then(data => {
          setChildren(data.entries || [])
          setLoaded(true)
        })
        .catch(() => setChildren([]))
    }
  }, [isExpanded, entry.path, entry.type, loaded])

  // 路径变化时重置加载状态
  useEffect(() => {
    setLoaded(false)
    setChildren([])
  }, [entry.path])

  const handleClick = () => {
    if (entry.type === 'directory') {
      toggleDir(entry.path)
    } else {
      // 打开文件 Tab
      openFile({
        path: entry.path,
        name: entry.name,
        language: getLang(entry.name),
      })
    }
  }

  const Icon = getFileIcon(entry, isExpanded)

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1 py-[3px] pr-2 cursor-pointer hover:bg-accent/60 transition-colors text-[13px]",
          isActive && "bg-accent text-accent-foreground"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {entry.type === 'directory' ? (
          isExpanded ? <ChevronDown size={14} className="flex-shrink-0 text-muted-foreground" /> : <ChevronRight size={14} className="flex-shrink-0 text-muted-foreground" />
        ) : (
          <span style={{ width: 14 }} className="flex-shrink-0" />
        )}
        <Icon size={15} className={cn("flex-shrink-0", entry.type === 'directory' ? 'text-primary/80' : 'text-muted-foreground')} />
        <span className="truncate flex-1">{entry.name}</span>
        {entry.type === 'file' && entry.size !== undefined && (
          <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatSize(entry.size)}</span>
        )}
      </div>
      {entry.type === 'directory' && isExpanded && children.length > 0 && (
        <div>
          {children.map(child => (
            <TreeNode key={child.path} entry={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  )
}

/** 文件树面板 — 左侧 */
export default function FileExplorer() {
  const { currentPath, setCurrentPath } = useFileExplorerStore()
  const activeSession = useSessionStore((s) => s.sessions.find(s2 => s2.id === s.activeSessionId))
  const { t } = useTranslation()

  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredEntries, setFilteredEntries] = useState<FileEntry[]>([])

  // 始终同步会话的工作目录作为文件树根路径
  const workingDir = activeSession?.workingDirectory
  useEffect(() => {
    if (workingDir) {
      setCurrentPath(workingDir)
    }
  }, [workingDir, setCurrentPath])

  // 获取根目录文件列表
  const fetchRootEntries = useCallback(async () => {
    if (!currentPath) return
    setLoading(true)
    try {
      const res = await fetch(`/api/filesystem/files?path=${encodeURIComponent(currentPath)}`)
      const data = await res.json()
      setEntries(data.entries || [])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [currentPath])

  useEffect(() => {
    fetchRootEntries()
  }, [fetchRootEntries])

  // 搜索过滤（本地过滤已加载的条目）
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEntries(entries)
      return
    }
    const q = searchQuery.toLowerCase()
    setFilteredEntries(entries.filter(e => e.name.toLowerCase().includes(q)))
  }, [searchQuery, entries])

  // 项目名称
  const projectName = useMemo(() => {
    if (!currentPath) return ''
    const normalized = currentPath.replace(/\\/g, '/')
    const parts = normalized.split('/').filter(Boolean)
    return parts[parts.length - 1] || currentPath
  }, [currentPath])

  return (
    <div className="file-explorer-panel">
      {/* 项目标题 + 刷新 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wider truncate">
          {projectName}
        </span>
        <button
          onClick={fetchRootEntries}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="刷新"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* 搜索框 */}
      <div className="file-explorer-search">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('layout.searchFiles')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '28px' }}
          />
        </div>
      </div>

      {/* 文件树 */}
      <div className="file-explorer-list">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            加载中...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            {t('layout.noFiles')}
          </div>
        ) : (
          filteredEntries.map(entry => (
            <TreeNode key={entry.path} entry={entry} depth={0} />
          ))
        )}
      </div>
    </div>
  )
}
