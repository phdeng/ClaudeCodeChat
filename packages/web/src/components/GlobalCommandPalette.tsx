import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  MessageSquare,
  Plus,
  Settings,
  History,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react'
import { useSessionStore } from '../stores/sessionStore'
import { useThemeStore } from '../stores/themeStore'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

// ==================== 类型定义 ====================

interface GlobalCommandPaletteProps {
  open: boolean
  onClose: () => void
}

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  section: 'action' | 'session'
  action: () => void
}

// ==================== 模糊搜索工具 ====================

/** 简易模糊匹配：检查关键词是否全部存在于目标字符串中 */
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  // 按空格拆分关键词，每个关键词都须命中
  const keywords = q.split(/\s+/).filter(Boolean)
  return keywords.every((kw) => t.includes(kw))
}

// ==================== 主组件 ====================

export default function GlobalCommandPalette({ open, onClose }: GlobalCommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedItemRef = useRef<HTMLDivElement>(null)

  const navigate = useNavigate()
  const { sessions, createSession } = useSessionStore()
  const { mode, toggleTheme } = useThemeStore()

  const iconSize = 16

  // 构建快捷操作列表
  const quickActions: CommandItem[] = useMemo(() => [
    {
      id: 'action-new-chat',
      label: '新建对话',
      description: '创建一个新的聊天会话',
      icon: <Plus size={iconSize} className="text-primary" />,
      section: 'action',
      action: () => {
        const session = createSession()
        navigate(`/chat/${session.id}`)
      },
    },
    {
      id: 'action-settings',
      label: '打开设置',
      description: 'MCP 服务器、Hooks 等配置',
      icon: <Settings size={iconSize} className="text-muted-foreground" />,
      section: 'action',
      action: () => navigate('/settings'),
    },
    {
      id: 'action-sessions',
      label: '会话历史',
      description: '浏览所有历史会话',
      icon: <History size={iconSize} className="text-muted-foreground" />,
      section: 'action',
      action: () => navigate('/sessions'),
    },
    {
      id: 'action-global-search',
      label: '全局搜索',
      description: '搜索所有会话中的消息内容 (Ctrl+Shift+F)',
      icon: <Search size={iconSize} className="text-muted-foreground" />,
      section: 'action',
      action: () => navigate('/search'),
    },
    {
      id: 'action-toggle-theme',
      label: mode === 'dark' ? '切换到亮色模式' : mode === 'light' ? '切换到跟随系统' : '切换到暗色模式',
      description: `当前：${mode === 'dark' ? '暗色' : mode === 'light' ? '亮色' : '跟随系统'}主题`,
      icon: mode === 'dark'
        ? <Moon size={iconSize} className="text-indigo-400" />
        : mode === 'light'
          ? <Sun size={iconSize} className="text-amber-400" />
          : <Monitor size={iconSize} className="text-teal-400" />,
      section: 'action',
      action: () => toggleTheme(),
    },
  ], [createSession, navigate, mode, toggleTheme])

  // 构建最近会话列表
  const sessionItems: CommandItem[] = useMemo(() => {
    // 取最近 20 个会话
    return sessions.slice(0, 20).map((session) => ({
      id: `session-${session.id}`,
      label: session.title,
      description: `${session.messages.length} 条消息`,
      icon: <MessageSquare size={iconSize} className="text-muted-foreground" />,
      section: 'session' as const,
      action: () => {
        navigate(`/chat/${session.id}`)
      },
    }))
  }, [sessions, navigate])

  // 根据搜索词过滤
  const filteredItems = useMemo(() => {
    const q = query.trim()
    if (!q) {
      // 无搜索词时显示所有快捷操作 + 最近会话
      return [...quickActions, ...sessionItems]
    }
    // 模糊搜索所有项
    const allItems = [...quickActions, ...sessionItems]
    return allItems.filter((item) =>
      fuzzyMatch(q, `${item.label} ${item.description || ''}`)
    )
  }, [query, quickActions, sessionItems])

  // 分组后的项目
  const actionItems = filteredItems.filter((item) => item.section === 'action')
  const filteredSessionItems = filteredItems.filter((item) => item.section === 'session')

  // 打开时重置状态并聚焦输入框
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      // 延迟聚焦，确保 DOM 已渲染
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [open])

  // 选中项变化时滚动到可视区域
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // 确保选中索引不超出范围
  useEffect(() => {
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(Math.max(0, filteredItems.length - 1))
    }
  }, [filteredItems.length, selectedIndex])

  // 执行选中项的操作
  const executeItem = useCallback((item: CommandItem) => {
    onClose()
    // 用 requestAnimationFrame 保证关闭动画后再执行导航等操作
    requestAnimationFrame(() => {
      item.action()
    })
  }, [onClose])

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(filteredItems.length - 1, prev + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(0, prev - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          executeItem(filteredItems[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [filteredItems, selectedIndex, executeItem, onClose])

  if (!open) return null

  // 渲染单个列表项
  const renderItem = (item: CommandItem, globalIndex: number) => (
    <div
      key={item.id}
      ref={globalIndex === selectedIndex ? selectedItemRef : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 mx-1.5 rounded-lg cursor-pointer transition-colors',
        globalIndex === selectedIndex
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-accent/50'
      )}
      onMouseEnter={() => setSelectedIndex(globalIndex)}
      onClick={() => executeItem(item)}
    >
      <span className="flex-shrink-0">{item.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate">{item.label}</div>
        {item.description && (
          <div className="text-[11px] text-muted-foreground truncate">{item.description}</div>
        )}
      </div>
    </div>
  )

  // 计算全局索引的偏移量
  let globalIndex = 0

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* 居中偏上的命令面板卡片 */}
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-md animate-fade-in">
        <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* 搜索输入框 */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search size={18} className="text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="搜索会话、命令..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedIndex(0)
              }}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('')
                  setSelectedIndex(0)
                  inputRef.current?.focus()
                }}
                className="text-[11px] text-foreground transition-colors px-1.5 py-0.5 rounded bg-accent/50"
              >
                清除
              </button>
            )}
          </div>

          {/* 搜索结果列表 */}
          <ScrollArea className="max-h-[360px]">
            <div className="py-1.5">
              {filteredItems.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-[13px] text-muted-foreground">没有找到匹配结果</span>
                </div>
              ) : (
                <>
                  {/* 快捷操作区域 */}
                  {actionItems.length > 0 && (
                    <div>
                      <div className="px-4 pt-1.5 pb-1">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          快捷操作
                        </span>
                      </div>
                      {actionItems.map((item) => {
                        const idx = globalIndex++
                        return renderItem(item, idx)
                      })}
                    </div>
                  )}

                  {/* 最近会话区域 */}
                  {filteredSessionItems.length > 0 && (
                    <div>
                      {actionItems.length > 0 && (
                        <div className="mx-3 my-1.5 border-t border-border" />
                      )}
                      <div className="px-4 pt-1.5 pb-1">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          最近会话
                        </span>
                      </div>
                      {filteredSessionItems.map((item) => {
                        const idx = globalIndex++
                        return renderItem(item, idx)
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>

          {/* 底部快捷键提示 */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-border">
            <span className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">↑↓</kbd>{' '}选择
            </span>
            <span className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">Enter</kbd>{' '}确认
            </span>
            <span className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">Esc</kbd>{' '}关闭
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
