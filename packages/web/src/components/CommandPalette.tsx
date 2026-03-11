import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import {
  File,
  Folder,
  Terminal,
  Trash2,
  Cpu,
  Minimize2,
  HelpCircle,
  Plus,
  Settings,
  Settings2,
  History,
  Coins,
  BookOpen,
  Bookmark,
  Printer,
  Columns3,
  Clock,
  GitBranch,
  FolderTree,
  RotateCcw,
  Code2,
  Image,
  Pin,
  Eye,
  Palette,
  Rocket,
  Layers,
  Shield,
  Wallet,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// ==================== 类型定义 ====================

export interface CommandPaletteItem {
  id: string
  label: string
  description?: string
  icon?: string
  type: 'file' | 'directory' | 'command'
  value: string
}

export interface CommandPaletteHandle {
  /** 向上移动选中项 */
  moveUp: () => void
  /** 向下移动选中项 */
  moveDown: () => void
  /** 确认当前选中项 */
  confirm: () => void
  /** 当前是否有可选项 */
  hasItems: () => boolean
}

interface CommandPaletteProps {
  type: 'file' | 'command'
  query: string
  position: { left: number; bottom: number }
  onSelect: (item: CommandPaletteItem) => void
  onClose: () => void
  workingDirectory?: string
}

// ==================== 斜杠命令定义 ====================

// 按字母排序的斜杠命令列表
export const SLASH_COMMANDS: CommandPaletteItem[] = [
  {
    id: 'cmd-bookmarks',
    label: '/bookmarks',
    description: '查看收藏的消息',
    icon: 'bookmark',
    type: 'command',
    value: '/bookmarks',
  },
  {
    id: 'cmd-clear',
    label: '/clear',
    description: '清空当前对话',
    icon: 'trash',
    type: 'command',
    value: '/clear',
  },
  {
    id: 'cmd-clear-context',
    label: '/clear-context',
    description: '清除所有消息并开始新对话',
    icon: 'rotate',
    type: 'command',
    value: '/clear-context',
  },
  {
    id: 'cmd-compact',
    label: '/compact',
    description: '压缩上下文',
    icon: 'minimize',
    type: 'command',
    value: '/compact',
  },
  {
    id: 'cmd-compare',
    label: '/compare',
    description: '多模型对比',
    icon: 'columns',
    type: 'command',
    value: '/compare',
  },
  {
    id: 'cmd-context',
    label: '/context',
    description: '管理当前对话的上下文（文件/目录/URL）',
    icon: 'layers',
    type: 'command',
    value: '/context',
  },
  {
    id: 'cmd-cost',
    label: '/cost',
    description: 'Token 用量统计',
    icon: 'coins',
    type: 'command',
    value: '/cost',
  },
  {
    id: 'cmd-export',
    label: '/export',
    description: '预览 / 打印导出对话',
    icon: 'printer',
    type: 'command',
    value: '/export',
  },
  {
    id: 'cmd-exportimage',
    label: '/exportimage',
    description: '导出对话为长图',
    icon: 'image',
    type: 'command',
    value: '/exportimage',
  },
  {
    id: 'cmd-files',
    label: '/files',
    description: '列出当前项目的文件结构',
    icon: 'folder-tree',
    type: 'command',
    value: '/files',
  },
  {
    id: 'cmd-git',
    label: '/git',
    description: '显示当前项目的 Git 状态',
    icon: 'git',
    type: 'command',
    value: '/git',
  },
  {
    id: 'cmd-help',
    label: '/help',
    description: '显示帮助信息',
    icon: 'help',
    type: 'command',
    value: '/help',
  },
  {
    id: 'cmd-init',
    label: '/init',
    description: '初始化项目（生成 CLAUDE.md）',
    icon: 'rocket',
    type: 'command',
    value: '/init',
  },
  {
    id: 'cmd-model',
    label: '/model',
    description: '切换模型 (sonnet / opus / haiku)',
    icon: 'cpu',
    type: 'command',
    value: '/model',
  },
  {
    id: 'cmd-new',
    label: '/new',
    description: '新建对话',
    icon: 'plus',
    type: 'command',
    value: '/new',
  },
  {
    id: 'cmd-pin',
    label: '/pin',
    description: '右键消息可置顶到顶部',
    icon: 'pin',
    type: 'command',
    value: '/pin',
  },
  {
    id: 'cmd-prompts',
    label: '/prompts',
    description: 'Prompt 模板库',
    icon: 'book',
    type: 'command',
    value: '/prompts',
  },
  {
    id: 'cmd-sessions',
    label: '/sessions',
    description: '会话历史',
    icon: 'history',
    type: 'command',
    value: '/sessions',
  },
  {
    id: 'cmd-settings',
    label: '/settings',
    description: '打开设置',
    icon: 'settings',
    type: 'command',
    value: '/settings',
  },
  {
    id: 'cmd-snippets',
    label: '/snippets',
    description: '打开代码片段管理器',
    icon: 'code',
    type: 'command',
    value: '/snippets',
  },
  {
    id: 'cmd-system',
    label: '/system',
    description: '设置系统提示词',
    icon: 'system-prompt',
    type: 'command',
    value: '/system',
  },
  {
    id: 'cmd-theme',
    label: '/theme',
    description: '打开主题设置',
    icon: 'palette',
    type: 'command',
    value: '/theme',
  },
  {
    id: 'cmd-timeline',
    label: '/timeline',
    description: '时间线视图查看消息',
    icon: 'clock',
    type: 'command',
    value: '/timeline',
  },
  {
    id: 'cmd-zen',
    label: '/zen',
    description: '切换焦点模式（无干扰）',
    icon: 'zen',
    type: 'command',
    value: '/zen',
  },
  {
    id: 'cmd-workflow',
    label: '/workflow',
    description: '提示词工作流编排器',
    icon: 'rocket',
    type: 'command',
    value: '/workflow',
  },
]

// ==================== 图标映射组件 ====================

function ItemIcon({ icon, type }: { icon?: string; type: CommandPaletteItem['type'] }) {
  const size = 14
  const cls = 'flex-shrink-0 text-muted-foreground'

  if (icon === 'trash') return <Trash2 size={size} className={cn(cls, 'text-destructive/70')} />
  if (icon === 'cpu') return <Cpu size={size} className={cls} />
  if (icon === 'minimize') return <Minimize2 size={size} className={cls} />
  if (icon === 'help') return <HelpCircle size={size} className={cls} />
  if (icon === 'plus') return <Plus size={size} className={cn(cls, 'text-primary')} />
  if (icon === 'settings') return <Settings size={size} className={cls} />
  if (icon === 'history') return <History size={size} className={cls} />
  if (icon === 'coins') return <Coins size={size} className={cls} />
  if (icon === 'system-prompt') return <Settings2 size={size} className={cls} />
  if (icon === 'book') return <BookOpen size={size} className={cls} />
  if (icon === 'bookmark') return <Bookmark size={size} className={cn(cls, 'text-yellow-400/80')} />
  if (icon === 'printer') return <Printer size={size} className={cls} />
  if (icon === 'columns') return <Columns3 size={size} className={cls} />
  if (icon === 'clock') return <Clock size={size} className={cls} />
  if (icon === 'git') return <GitBranch size={size} className={cn(cls, 'text-orange-400/80')} />
  if (icon === 'folder-tree') return <FolderTree size={size} className={cls} />
  if (icon === 'rotate') return <RotateCcw size={size} className={cn(cls, 'text-destructive/70')} />
  if (icon === 'code') return <Code2 size={size} className={cls} />
  if (icon === 'image') return <Image size={size} className={cls} />
  if (icon === 'pin') return <Pin size={size} className={cn(cls, 'text-blue-400/80')} />
  if (icon === 'zen') return <Eye size={size} className={cn(cls, 'text-green-400/80')} />
  if (icon === 'palette') return <Palette size={size} className={cn(cls, 'text-purple-400/80')} />
  if (icon === 'rocket') return <Rocket size={size} className={cn(cls, 'text-orange-300/80')} />
  if (icon === 'layers') return <Layers size={size} className={cls} />
  if (icon === 'shield') return <Shield size={size} className={cls} />
  if (icon === 'wallet') return <Wallet size={size} className={cls} />

  if (type === 'directory') return <Folder size={size} className={cn(cls, 'text-primary/70')} />
  return <File size={size} className={cls} />
}

// ==================== 主组件 ====================

const CommandPalette = forwardRef<CommandPaletteHandle, CommandPaletteProps>(
  function CommandPalette({ type, query, position, onSelect, onClose, workingDirectory }, ref) {
    const [items, setItems] = useState<CommandPaletteItem[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [loading, setLoading] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const selectedItemRef = useRef<HTMLButtonElement>(null)
    const fetchControllerRef = useRef<AbortController | null>(null)
    // 使用 ref 追踪最新的 items 和 selectedIndex，避免闭包陈旧值
    const itemsRef = useRef<CommandPaletteItem[]>([])
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
          onSelect(item)
        }
      },
      hasItems: () => itemsRef.current.length > 0,
    }), [onSelect])

    // 过滤斜杠命令
    const filterCommands = useCallback((q: string): CommandPaletteItem[] => {
      const lower = q.toLowerCase()
      if (!lower) return SLASH_COMMANDS
      return SLASH_COMMANDS.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(lower) ||
          (cmd.description && cmd.description.toLowerCase().includes(lower))
      )
    }, [])

    // 获取文件列表
    const fetchFiles = useCallback(
      async (q: string) => {
        fetchControllerRef.current?.abort()
        const controller = new AbortController()
        fetchControllerRef.current = controller

        setLoading(true)
        try {
          const params = new URLSearchParams()
          if (workingDirectory) params.set('path', workingDirectory)
          if (q) params.set('query', q)

          const res = await fetch(`/api/filesystem/files?${params.toString()}`, {
            signal: controller.signal,
          })
          if (!res.ok) throw new Error('请求失败')
          const data = await res.json()

          const mapped: CommandPaletteItem[] = (data.entries || []).map(
            (entry: { name: string; path: string; type: string }) => ({
              id: entry.path,
              label: entry.name,
              description: entry.path,
              type: entry.type === 'directory' ? 'directory' : 'file',
              value: entry.path,
            })
          )
          setItems(mapped)
          setSelectedIndex(0)
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            setItems([])
          }
        } finally {
          setLoading(false)
        }
      },
      [workingDirectory]
    )

    // query 变化时更新列表
    useEffect(() => {
      if (type === 'command') {
        const filtered = filterCommands(query)
        setItems(filtered)
        setSelectedIndex(0)
      } else {
        // 文件搜索加防抖
        const timer = setTimeout(() => {
          fetchFiles(query)
        }, 200)
        return () => clearTimeout(timer)
      }
    }, [type, query, filterCommands, fetchFiles])

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
      // 延迟绑定，避免触发 @ 或 / 的点击立即关闭
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 10)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [onClose])

    // 无内容且不在加载中则不渲染
    if (!loading && items.length === 0) return null

    return (
      <div
        ref={containerRef}
        className="absolute z-50 animate-fade-in"
        style={{
          left: position.left,
          bottom: position.bottom,
          minWidth: 280,
          maxWidth: 420,
        }}
      >
        <div className="rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Terminal size={12} className="text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium">
              {type === 'command' ? '命令' : '文件引用'}
            </span>
            {query && (
              <span className="text-[11px] text-primary ml-auto font-mono truncate max-w-[140px]">
                {type === 'command' ? '/' : '@'}{query}
              </span>
            )}
          </div>

          {/* 列表 */}
          <ScrollArea className="max-h-[240px]">
            <div className="py-1">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <span className="text-[12px] text-muted-foreground">搜索中...</span>
                </div>
              ) : (
                items.map((item, index) => (
                  <button
                    key={item.id}
                    ref={index === selectedIndex ? selectedItemRef : undefined}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors',
                      index === selectedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/50'
                    )}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => onSelect(item)}
                  >
                    <ItemIcon icon={item.icon} type={item.type} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium truncate">{item.label}</div>
                      {item.description && (
                        <div className="text-[11px] text-muted-foreground truncate">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {/* 底部快捷键提示 */}
          <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border">
            <span className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">↑↓</kbd> 选择
            </span>
            <span className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">Enter</kbd> 确认
            </span>
            <span className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">Esc</kbd> 关闭
            </span>
          </div>
        </div>
      </div>
    )
  }
)

export default CommandPalette
