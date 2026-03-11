import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, ChevronUp, ChevronDown, X, Replace, ReplaceAll } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { Message } from '../stores/sessionStore'
import { useSessionStore } from '../stores/sessionStore'

interface MessageSearchBarProps {
  messages: Message[]
  open: boolean
  onClose: () => void
  onHighlight: (messageId: string | null) => void
}

export default function MessageSearchBar({ messages, open, onClose, onHighlight }: MessageSearchBarProps) {
  const [query, setQuery] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  /** 是否处于"搜索+替换"模式 */
  const [replaceMode, setReplaceMode] = useState(false)
  /** 替换输入框内容 */
  const [replaceText, setReplaceText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const { activeSessionId, updateMessage } = useSessionStore()

  // 搜索匹配的消息 ID 列表（大小写不敏感）
  const matchedIds = useMemo(() => {
    if (!query.trim()) return []
    const lower = query.toLowerCase()
    return messages
      .filter((msg) => msg.content.toLowerCase().includes(lower))
      .map((msg) => msg.id)
  }, [query, messages])

  /** 仅筛选用户消息的匹配项（替换操作只对用户消息有效） */
  const userMatchedIds = useMemo(() => {
    if (!query.trim()) return []
    const lower = query.toLowerCase()
    return messages
      .filter((msg) => msg.role === 'user' && msg.content.toLowerCase().includes(lower))
      .map((msg) => msg.id)
  }, [query, messages])

  const totalMatches = matchedIds.length

  // 搜索词或匹配结果变化时，重置索引并通知高亮
  useEffect(() => {
    if (totalMatches > 0) {
      setCurrentIndex(0)
      onHighlight(matchedIds[0])
    } else {
      setCurrentIndex(0)
      onHighlight(null)
    }
  }, [matchedIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // 打开时自动聚焦输入框
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [open])

  // 切换到替换模式时聚焦替换输入框
  useEffect(() => {
    if (replaceMode && replaceInputRef.current) {
      replaceInputRef.current.focus()
    }
  }, [replaceMode])

  // 跳转到下一个匹配
  const goToNext = useCallback(() => {
    if (totalMatches === 0) return
    const next = (currentIndex + 1) % totalMatches
    setCurrentIndex(next)
    onHighlight(matchedIds[next])
  }, [currentIndex, totalMatches, matchedIds, onHighlight])

  // 跳转到上一个匹配
  const goToPrev = useCallback(() => {
    if (totalMatches === 0) return
    const prev = (currentIndex - 1 + totalMatches) % totalMatches
    setCurrentIndex(prev)
    onHighlight(matchedIds[prev])
  }, [currentIndex, totalMatches, matchedIds, onHighlight])

  /** 替换当前高亮的匹配项（仅限用户消息） */
  const handleReplace = useCallback(() => {
    if (!activeSessionId || totalMatches === 0 || !query.trim()) return

    const currentMatchId = matchedIds[currentIndex]
    const msg = messages.find((m) => m.id === currentMatchId)
    if (!msg) return

    // 只允许替换用户消息
    if (msg.role !== 'user') {
      toast.error('只能替换用户消息')
      return
    }

    // 执行大小写不敏感的替换（只替换第一个匹配）
    const regex = new RegExp(escapeRegExp(query), 'i')
    const newContent = msg.content.replace(regex, replaceText)

    updateMessage(activeSessionId, msg.id, newContent)
    toast.success('已替换')
  }, [activeSessionId, totalMatches, query, matchedIds, currentIndex, messages, replaceText, updateMessage])

  /** 替换所有匹配项（仅限用户消息） */
  const handleReplaceAll = useCallback(() => {
    if (!activeSessionId || userMatchedIds.length === 0 || !query.trim()) return

    let count = 0
    const regex = new RegExp(escapeRegExp(query), 'gi')

    for (const msgId of userMatchedIds) {
      const msg = messages.find((m) => m.id === msgId)
      if (!msg) continue

      const newContent = msg.content.replace(regex, replaceText)
      if (newContent !== msg.content) {
        updateMessage(activeSessionId, msgId, newContent)
        count++
      }
    }

    if (count > 0) {
      toast.success(`已替换 ${count} 条消息中的匹配项`)
    }
  }, [activeSessionId, userMatchedIds, query, messages, replaceText, updateMessage])

  // 键盘事件处理：Esc 关闭，Enter 下一个，Shift+Enter 上一个
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault()
        goToPrev()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        goToNext()
      }
    },
    [onClose, goToNext, goToPrev]
  )

  /** 替换输入框键盘事件 */
  const handleReplaceKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleReplace()
      }
    },
    [onClose, handleReplace]
  )

  // 构建计数标签文本
  const countLabel = useMemo(() => {
    if (!query.trim()) return null
    if (totalMatches === 0) return '无结果'
    return `第 ${currentIndex + 1}/${totalMatches} 个`
  }, [query, totalMatches, currentIndex])

  /** 当前高亮项是否为用户消息（决定替换按钮是否可用） */
  const currentIsUserMsg = useMemo(() => {
    if (totalMatches === 0) return false
    const currentMatchId = matchedIds[currentIndex]
    const msg = messages.find((m) => m.id === currentMatchId)
    return msg?.role === 'user'
  }, [totalMatches, matchedIds, currentIndex, messages])

  return (
    <div className="absolute top-0 left-0 right-0 z-30 flex flex-col bg-card/95 border-b border-border backdrop-blur-sm shadow-lg animate-fade-in">
      {/* 搜索行 */}
      <div className="flex items-center gap-1.5 px-4 py-2">
        {/* 搜索图标 */}
        <Search size={14} className="text-muted-foreground flex-shrink-0" />

        {/* 搜索输入框 */}
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索消息..."
          className="h-7 text-[13px] flex-1 min-w-0"
        />

        {/* 搜索计数 badge */}
        {countLabel && (
          <span
            className={`
              inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap tabular-nums flex-shrink-0
              ${totalMatches > 0
                ? 'bg-primary/15 text-primary border border-primary/25'
                : 'bg-destructive/15 text-destructive border border-destructive/25'
              }
            `}
          >
            {countLabel}
          </span>
        )}

        {/* 替换模式切换按钮 */}
        <Button
          variant={replaceMode ? 'default' : 'ghost'}
          size="icon-xs"
          onClick={() => setReplaceMode(!replaceMode)}
          title={replaceMode ? '关闭替换' : '搜索并替换'}
          className="flex-shrink-0"
        >
          <Replace size={14} />
        </Button>

        {/* 上一个按钮 */}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={goToPrev}
          disabled={totalMatches === 0}
          title="上一个 (Shift+Enter)"
          className="flex-shrink-0"
        >
          <ChevronUp size={14} />
        </Button>

        {/* 下一个按钮 */}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={goToNext}
          disabled={totalMatches === 0}
          title="下一个 (Enter)"
          className="flex-shrink-0"
        >
          <ChevronDown size={14} />
        </Button>

        {/* 关闭按钮 */}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          title="关闭 (Esc)"
          className="flex-shrink-0"
        >
          <X size={14} />
        </Button>
      </div>

      {/* 替换行（仅在替换模式时显示） */}
      {replaceMode && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-border/50">
          {/* 替换图标占位，与搜索行对齐 */}
          <ReplaceAll size={14} className="text-muted-foreground flex-shrink-0" />

          {/* 替换输入框 */}
          <Input
            ref={replaceInputRef}
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            placeholder="替换为..."
            className="h-7 text-[13px] flex-1 min-w-0"
          />

          {/* 替换当前按钮 */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleReplace}
            disabled={totalMatches === 0 || !currentIsUserMsg}
            title={!currentIsUserMsg ? '当前匹配项不是用户消息，无法替换' : '替换当前匹配 (Enter)'}
            className="flex-shrink-0 text-[11px] h-7 px-2 gap-1"
          >
            <Replace size={12} />
            <span>替换</span>
          </Button>

          {/* 全部替换按钮 */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleReplaceAll}
            disabled={userMatchedIds.length === 0}
            title={`替换所有用户消息中的匹配项 (${userMatchedIds.length} 条消息)`}
            className="flex-shrink-0 text-[11px] h-7 px-2 gap-1"
          >
            <ReplaceAll size={12} />
            <span>全部替换</span>
          </Button>

          {/* 用户消息匹配数提示 */}
          {query.trim() && userMatchedIds.length !== totalMatches && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
              {userMatchedIds.length} 条可替换
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** 转义正则特殊字符 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
