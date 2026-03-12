import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import {
  File,
  Folder,
  FileCode,
  FileText,
  FileJson,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '../i18n'

// ==================== 类型定义 ====================

export interface AutoCompleteItem {
  /** 唯一标识（通常是完整路径） */
  id: string
  /** 文件/目录名称 */
  name: string
  /** 完整路径 */
  path: string
  /** 类型 */
  type: 'file' | 'directory'
  /** 文件扩展名（仅文件有） */
  extension?: string
}

export interface AutoCompleteHandle {
  /** 向上移动选中项 */
  moveUp: () => void
  /** 向下移动选中项 */
  moveDown: () => void
  /** 确认当前选中项 */
  confirm: () => void
  /** 当前是否有可选项 */
  hasItems: () => boolean
}

interface AutoCompleteProps {
  /** 补全类型 */
  type: 'file'
  /** 用户当前输入的搜索词（@ 之后的文本） */
  query: string
  /** 工作目录路径（用于文件 API 请求） */
  workingDirectory: string
  /** 选中补全项后的回调 */
  onSelect: (value: string) => void
  /** 关闭补全 */
  onClose: () => void
  /** 定位锚点（相对于输入框的位置） */
  position?: { bottom: number; left: number }
}

// ==================== 文件图标映射 ====================

/** 根据扩展名返回合适的文件图标 */
function FileIcon({ extension, type }: { extension?: string; type: 'file' | 'directory' }) {
  const size = 14
  const cls = 'flex-shrink-0'

  if (type === 'directory') {
    return <Folder size={size} className={cn(cls, 'text-blue-400/80')} />
  }

  const ext = (extension || '').toLowerCase()

  // 代码文件
  const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.scala', '.dart', '.lua', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd', '.vue', '.svelte']
  if (codeExts.includes(ext)) {
    return <FileCode size={size} className={cn(cls, 'text-emerald-400/80')} />
  }

  // 文本/文档文件
  const textExts = ['.md', '.mdx', '.txt', '.log', '.csv', '.rtf', '.tex']
  if (textExts.includes(ext)) {
    return <FileText size={size} className={cn(cls, 'text-gray-400/80')} />
  }

  // JSON/配置文件
  const jsonExts = ['.json', '.jsonc', '.yaml', '.yml', '.toml', '.xml', '.ini', '.cfg', '.conf', '.env']
  if (jsonExts.includes(ext)) {
    return <FileJson size={size} className={cn(cls, 'text-yellow-400/80')} />
  }

  // 图片文件
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp']
  if (imageExts.includes(ext)) {
    return <FileImage size={size} className={cn(cls, 'text-purple-400/80')} />
  }

  // 视频文件
  const videoExts = ['.mp4', '.avi', '.mov', '.mkv', '.webm']
  if (videoExts.includes(ext)) {
    return <FileVideo size={size} className={cn(cls, 'text-red-400/80')} />
  }

  // 音频文件
  const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.aac']
  if (audioExts.includes(ext)) {
    return <FileAudio size={size} className={cn(cls, 'text-pink-400/80')} />
  }

  // 压缩文件
  const archiveExts = ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2']
  if (archiveExts.includes(ext)) {
    return <FileArchive size={size} className={cn(cls, 'text-orange-400/80')} />
  }

  // 表格文件
  const spreadsheetExts = ['.xls', '.xlsx', '.ods']
  if (spreadsheetExts.includes(ext)) {
    return <FileSpreadsheet size={size} className={cn(cls, 'text-green-400/80')} />
  }

  // HTML/CSS/样式
  const webExts = ['.html', '.htm', '.css', '.scss', '.sass', '.less']
  if (webExts.includes(ext)) {
    return <FileCode size={size} className={cn(cls, 'text-sky-400/80')} />
  }

  // 默认文件图标
  return <File size={size} className={cn(cls, 'text-muted-foreground')} />
}

// ==================== 主组件 ====================

const AutoComplete = forwardRef<AutoCompleteHandle, AutoCompleteProps>(
  function AutoComplete({ query, workingDirectory, onSelect, onClose, position }, ref) {
    const { t } = useTranslation()
    const [items, setItems] = useState<AutoCompleteItem[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [loading, setLoading] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const selectedItemRef = useRef<HTMLButtonElement>(null)
    const fetchControllerRef = useRef<AbortController | null>(null)

    // 使用 ref 追踪最新的 items 和 selectedIndex，避免闭包陈旧值
    const itemsRef = useRef<AutoCompleteItem[]>([])
    const selectedIndexRef = useRef(0)

    itemsRef.current = items
    selectedIndexRef.current = selectedIndex

    // 暴露给父组件的命令式 API
    useImperativeHandle(ref, () => ({
      moveUp: () => {
        setSelectedIndex((prev) => Math.max(0, prev - 1))
      },
      moveDown: () => {
        setSelectedIndex((prev) => Math.min(itemsRef.current.length - 1, prev + 1))
      },
      confirm: () => {
        const item = itemsRef.current[selectedIndexRef.current]
        if (item) {
          onSelect(item.path)
        }
      },
      hasItems: () => itemsRef.current.length > 0,
    }), [onSelect])

    // 获取文件列表（带防抖）
    const fetchFiles = useCallback(
      async (q: string) => {
        fetchControllerRef.current?.abort()
        const controller = new AbortController()
        fetchControllerRef.current = controller

        setLoading(true)
        try {
          // 解析查询路径：如果包含 /，分离目录和文件名部分
          let searchPath = workingDirectory
          let searchQuery = q

          if (q.includes('/') || q.includes('\\')) {
            const separator = q.includes('/') ? '/' : '\\'
            const lastSepIndex = Math.max(q.lastIndexOf('/'), q.lastIndexOf('\\'))
            const dirPart = q.slice(0, lastSepIndex)
            searchQuery = q.slice(lastSepIndex + 1)

            // 将目录部分附加到工作目录
            if (dirPart) {
              searchPath = workingDirectory + separator + dirPart
            }
          }

          const params = new URLSearchParams()
          if (searchPath) params.set('path', searchPath)
          if (searchQuery) params.set('query', searchQuery)

          const res = await fetch(`/api/filesystem/files?${params.toString()}`, {
            signal: controller.signal,
          })
          if (!res.ok) throw new Error('请求失败')
          const data = await res.json()

          const mapped: AutoCompleteItem[] = (data.entries || [])
            .slice(0, 10) // 最多显示 10 项
            .map(
              (entry: { name: string; path: string; type: string; extension?: string }) => ({
                id: entry.path,
                name: entry.name,
                path: entry.path,
                type: entry.type === 'directory' ? 'directory' : 'file',
                extension: entry.extension || '',
              })
            )
          setItems(mapped)
          setSelectedIndex(0)
        } catch (err: unknown) {
          if (err instanceof Error && err.name !== 'AbortError') {
            setItems([])
          }
        } finally {
          setLoading(false)
        }
      },
      [workingDirectory]
    )

    // query 变化时防抖获取文件列表
    useEffect(() => {
      const timer = setTimeout(() => {
        fetchFiles(query)
      }, 200)
      return () => clearTimeout(timer)
    }, [query, fetchFiles])

    // 选中项滚动到可视区域
    useEffect(() => {
      selectedItemRef.current?.scrollIntoView({ block: 'nearest' })
    }, [selectedIndex])

    // 点击外部关闭
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          onClose()
        }
      }
      // 延迟绑定，避免触发 @ 的点击立即关闭
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 10)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [onClose])

    // 组件卸载时取消请求
    useEffect(() => {
      return () => {
        fetchControllerRef.current?.abort()
      }
    }, [])

    /** 从完整路径中提取相对于工作目录的显示路径 */
    const getRelativePath = (fullPath: string) => {
      if (!workingDirectory) return fullPath
      // 标准化路径分隔符进行比较
      const normalizedFull = fullPath.replace(/\\/g, '/')
      const normalizedWd = workingDirectory.replace(/\\/g, '/')
      if (normalizedFull.startsWith(normalizedWd)) {
        const relative = normalizedFull.slice(normalizedWd.length)
        // 去掉开头的分隔符
        return relative.replace(/^[/\\]/, '') || fullPath
      }
      return fullPath
    }

    return (
      <div
        ref={containerRef}
        className="absolute z-50 animate-fade-in"
        style={{
          left: position?.left ?? 8,
          bottom: position?.bottom ?? 48,
          minWidth: 300,
          maxWidth: 460,
        }}
      >
        <div className="rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <File size={12} className="text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium">
              {t('autoComplete.title')}
            </span>
            {query && (
              <span className="text-[11px] text-primary ml-auto font-mono truncate max-w-[180px]">
                @{query}
              </span>
            )}
          </div>

          {/* 列表 */}
          <div className="max-h-[280px] overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
                <span className="text-[12px] text-muted-foreground">
                  {t('autoComplete.loading')}
                </span>
              </div>
            ) : items.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <span className="text-[12px] text-muted-foreground">
                  {t('autoComplete.noMatch')}
                </span>
              </div>
            ) : (
              items.map((item, index) => (
                <button
                  key={item.id}
                  ref={index === selectedIndex ? selectedItemRef : undefined}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors cursor-pointer',
                    index === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/50'
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => onSelect(item.path)}
                >
                  {/* 文件图标 */}
                  <FileIcon extension={item.extension} type={item.type} />

                  {/* 文件名 + 路径 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium truncate">
                      {item.name}
                      {item.type === 'directory' && '/'}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground truncate">
                      {getRelativePath(item.path)}
                    </div>
                  </div>

                  {/* 类型标签 */}
                  <span className={cn(
                    'flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full',
                    item.type === 'directory'
                      ? 'bg-blue-500/10 text-blue-400/80'
                      : 'bg-gray-500/10 text-gray-400/80'
                  )}>
                    {item.type === 'directory'
                      ? (t('autoComplete.directory'))
                      : (item.extension?.replace('.', '').toUpperCase() || 'FILE')
                    }
                  </span>
                </button>
              ))
            )}
          </div>

          {/* 底部快捷键提示 */}
          <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border">
            <span className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">&#8593;&#8595;</kbd> {t('autoComplete.navigate')}
            </span>
            <span className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">Enter</kbd> {t('autoComplete.confirm')}
            </span>
            <span className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">Esc</kbd> {t('autoComplete.dismiss')}
            </span>
          </div>
        </div>
      </div>
    )
  }
)

export default AutoComplete
