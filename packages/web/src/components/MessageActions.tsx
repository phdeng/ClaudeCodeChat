/**
 * 消息操作相关组件
 * 从 MessageList.tsx 提取，包含：
 * - VersionHistoryPanel: 版本历史面板
 * - MessageActions: 消息悬浮操作栏
 * - TokenUsageBadge: Token 用量显示徽章
 * - FeedbackButtons: 点赞/踩反馈按钮
 * - MessageReactions: Emoji 反应组件
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  Copy, Check, RefreshCw, Pencil, ThumbsUp, ThumbsDown,
  Eye, FileText, GitBranch, Bookmark, BookmarkCheck,
  X, BookOpen, MessageSquareQuote, Type, User,
  Volume2, Square, Languages, Loader2, Link2,
  SmilePlus, Pin, PinOff, History, RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Message } from '../stores/sessionStore'
import { useSessionStore } from '../stores/sessionStore'
import { formatTokenCount } from '@/utils/messageUtils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'

// ===================== 内部工具 =====================

/** 复制到剪贴板的 hook */
function useCopyToClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), timeout)
    })
  }, [timeout])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { copied, copy }
}

// ===================== InlineDiffView (内部组件) =====================

/** 内联 Diff 对比视图 */
function InlineDiffView({ originalCode, modifiedCode }: { originalCode: string; modifiedCode: string }) {
  const diffLines = useMemo(() => {
    const oldLines = originalCode.split('\n')
    const newLines = modifiedCode.split('\n')
    const m = oldLines.length
    const n = newLines.length

    // LCS 动态规划
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
        }
      }
    }

    // 回溯
    const result: Array<{ type: 'unchanged' | 'added' | 'removed'; content: string; oldNo: number | null; newNo: number | null }> = []
    let i = m
    let j = n
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        result.push({ type: 'unchanged', content: oldLines[i - 1], oldNo: i, newNo: j })
        i--; j--
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.push({ type: 'added', content: newLines[j - 1], oldNo: null, newNo: j })
        j--
      } else {
        result.push({ type: 'removed', content: oldLines[i - 1], oldNo: i, newNo: null })
        i--
      }
    }
    result.reverse()
    return result
  }, [originalCode, modifiedCode])

  const stats = useMemo(() => {
    let added = 0, removed = 0
    for (const line of diffLines) {
      if (line.type === 'added') added++
      if (line.type === 'removed') removed++
    }
    return { added, removed }
  }, [diffLines])

  if (stats.added === 0 && stats.removed === 0) {
    return (
      <div className="px-3 py-2 text-[11px] text-muted-foreground/60 border-t border-border/50 bg-card/30">
        内容完全相同，无差异
      </div>
    )
  }

  return (
    <div className="border-t border-border/50">
      {/* Diff 统计摘要 */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-card/30 border-b border-border/30">
        <GitBranch size={11} className="text-muted-foreground/60" />
        <span className="text-[10px] text-muted-foreground/60 font-medium">变更对比</span>
        <span className="flex items-center gap-0.5 text-[10px] text-green-400">
          +{stats.added}
        </span>
        <span className="flex items-center gap-0.5 text-[10px] text-red-400">
          -{stats.removed}
        </span>
      </div>
      {/* Diff 行 */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto font-mono text-[11px] leading-[1.6]">
        {diffLines.map((line, index) => (
          <div
            key={index}
            className={cn(
              "flex",
              line.type === 'removed' && "bg-red-500/10",
              line.type === 'added' && "bg-green-500/10"
            )}
          >
            {/* 旧行号 */}
            <div className="flex-shrink-0 w-[40px] text-right pr-1.5 py-0 select-none text-muted-foreground/40 text-[10px] border-r border-border/30">
              {line.oldNo ?? ''}
            </div>
            {/* 新行号 */}
            <div className="flex-shrink-0 w-[40px] text-right pr-1.5 py-0 select-none text-muted-foreground/40 text-[10px] border-r border-border/30">
              {line.newNo ?? ''}
            </div>
            {/* 差异标记 */}
            <div className="flex-shrink-0 w-[20px] text-center py-0 select-none font-bold text-[10px]">
              {line.type === 'removed' && <span className="text-red-400">-</span>}
              {line.type === 'added' && <span className="text-green-400">+</span>}
            </div>
            {/* 内容 */}
            <div
              className={cn(
                'flex-1 py-0 px-2 whitespace-pre-wrap break-all',
                line.type === 'removed' && 'text-red-400',
                line.type === 'added' && 'text-green-400',
                line.type === 'unchanged' && 'text-foreground/70'
              )}
            >
              {line.content || '\u00A0'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ===================== VersionHistoryPanel =====================

/** 版本历史面板：展示消息的所有历史版本，支持预览、恢复和对比 */
export function VersionHistoryPanel({
  versions,
  currentContent,
  onRestore,
  onClose,
}: {
  versions: { content: string; timestamp: number }[]
  currentContent: string
  onRestore: (versionIndex: number) => void
  onClose: () => void
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [diffIndex, setDiffIndex] = useState<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewIndex !== null) {
          setPreviewIndex(null)
        } else if (diffIndex !== null) {
          setDiffIndex(null)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, previewIndex, diffIndex])

  const formatVersionTime = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    if (isToday) return `今天 ${time}`
    const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString()
    if (isYesterday) return `昨天 ${time}`
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + time
  }

  const truncateContent = (content: string, maxLen = 100) => {
    const cleaned = content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
    if (cleaned.length <= maxLen) return cleaned
    return cleaned.slice(0, maxLen) + '...'
  }

  // 版本列表：最新在上（倒序排列）
  const reversedVersions = useMemo(() => [...versions].reverse(), [versions])

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-1 z-[100] w-[380px] max-h-[500px] rounded-xl border border-border bg-popover shadow-2xl overflow-hidden animate-fade-in"
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <History size={14} className="text-primary" />
          <span className="text-[13px] font-medium text-foreground">版本历史</span>
          <span className="text-[11px] text-muted-foreground">({versions.length} 个版本)</span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          className="h-6 w-6 text-foreground"
        >
          <X size={14} />
        </Button>
      </div>

      {/* 当对比模式激活时，显示 diff 视图 */}
      {diffIndex !== null && (
        <div className="border-b border-border">
          <div className="flex items-center justify-between px-3 py-1.5 bg-card/30">
            <span className="text-[11px] text-muted-foreground">
              版本 {versions.length - diffIndex} 与当前版本的差异
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setDiffIndex(null)}
              className="h-5 w-5 text-foreground"
            >
              <X size={12} />
            </Button>
          </div>
          <InlineDiffView
            originalCode={reversedVersions[diffIndex].content}
            modifiedCode={currentContent}
          />
        </div>
      )}

      {/* 预览模式：显示选中版本的完整内容 */}
      {previewIndex !== null && diffIndex === null && (
        <div className="border-b border-border">
          <div className="flex items-center justify-between px-3 py-1.5 bg-card/30">
            <span className="text-[11px] text-muted-foreground">
              版本 {versions.length - previewIndex} 预览
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setPreviewIndex(null)}
              className="h-5 w-5 text-foreground"
            >
              <X size={12} />
            </Button>
          </div>
          <div className="max-h-[200px] overflow-y-auto px-3 py-2 text-[12px] text-foreground whitespace-pre-wrap break-words leading-[1.6] bg-muted/20">
            {reversedVersions[previewIndex].content}
          </div>
        </div>
      )}

      {/* 版本列表 */}
      <div className="overflow-y-auto max-h-[300px]">
        {/* 当前版本（最上方） */}
        <div className="flex items-start gap-3 px-4 py-2.5 border-b border-border/50 bg-primary/5">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-primary">当前版本</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-[1.5]">
              {truncateContent(currentContent)}
            </p>
          </div>
        </div>

        {/* 历史版本 */}
        {reversedVersions.map((version, revIdx) => {
          // revIdx 是 reversedVersions 中的索引
          // 原始索引 = versions.length - 1 - revIdx
          const originalIndex = versions.length - 1 - revIdx
          return (
            <div
              key={revIdx}
              className={cn(
                "flex items-start gap-3 px-4 py-2.5 border-b border-border/30 hover:bg-accent/50 transition-colors cursor-pointer",
                previewIndex === revIdx && "bg-accent/30"
              )}
              onClick={() => setPreviewIndex(previewIndex === revIdx ? null : revIdx)}
            >
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-foreground">
                    版本 {versions.length - revIdx}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatVersionTime(version.timestamp)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-[1.5]">
                  {truncateContent(version.content)}
                </p>
                {/* 操作按钮 */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-foreground"
                    onClick={(e) => { e.stopPropagation(); setPreviewIndex(previewIndex === revIdx ? null : revIdx) }}
                  >
                    <Eye size={11} className="mr-1" />
                    预览
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-foreground"
                    onClick={(e) => { e.stopPropagation(); setDiffIndex(diffIndex === revIdx ? null : revIdx) }}
                  >
                    <GitBranch size={11} className="mr-1" />
                    对比
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-primary/70 hover:text-primary hover:bg-primary/10"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRestore(originalIndex)
                      onClose()
                      toast.success('已恢复到该版本')
                    }}
                  >
                    <RotateCcw size={11} className="mr-1" />
                    恢复
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ===================== MessageActions =====================

/** 消息悬浮操作栏 */
export function MessageActions({
  message,
  onCopy,
  onEdit,
  onRegenerate,
  onFork,
  onCopyLink,
  onQuote,
  bookmarked,
  onToggleBookmark,
  onSaveToKnowledge,
  onPin,
  isPinned,
  onSpeak,
  isSpeaking,
  onTranslate,
  isTranslating,
  onRestoreVersion,
}: {
  message: Message
  onCopy: () => void
  onEdit?: () => void
  onRegenerate?: () => void
  onFork?: () => void
  onCopyLink?: () => void
  onQuote?: () => void
  bookmarked?: boolean
  onToggleBookmark?: () => void
  onSaveToKnowledge?: () => void
  onPin?: () => void
  isPinned?: boolean
  onSpeak?: () => void
  isSpeaking?: boolean
  onTranslate?: () => void
  isTranslating?: boolean
  onRestoreVersion?: (versionIndex: number) => void
}) {
  const { copied, copy: doCopy } = useCopyToClipboard()
  // 复制格式菜单显示状态
  const [showCopyMenu, setShowCopyMenu] = useState(false)
  const copyMenuRef = useRef<HTMLDivElement>(null)
  // 版本历史面板显示状态
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const hasVersions = message.versions && message.versions.length > 0

  // 点击外部关闭复制格式菜单
  useEffect(() => {
    if (!showCopyMenu) return
    const handler = (e: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) {
        setShowCopyMenu(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showCopyMenu])

  /** 按指定格式复制消息内容 */
  const handleCopyAs = (format: 'markdown' | 'plain' | 'withRole') => {
    const content = message.content
    let text = ''
    switch (format) {
      case 'markdown':
        text = content
        break
      case 'plain':
        // 去除 Markdown 语法，保留纯文本
        text = content
          .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').trim())
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/`(.*?)`/g, '$1')
          .replace(/^#+\s/gm, '')
          .replace(/^[-*]\s/gm, '\u2022 ')
          .replace(/^\d+\.\s/gm, (m) => m)
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        break
      case 'withRole':
        const role = message.role === 'user' ? '用户' : 'Claude'
        text = `${role}:\n${content}`
        break
    }

    doCopy(text)
    toast.success(
      format === 'markdown' ? '已复制 Markdown' :
      format === 'plain' ? '已复制纯文本' :
      '已复制（含角色）'
    )
    setShowCopyMenu(false)
    onCopy()
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "absolute -top-3 flex items-center gap-0.5",
          "px-1 py-0.5 rounded-lg",
          "bg-card/90 border border-border backdrop-blur-sm shadow-sm",
          "opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150",
          "z-20",
          message.role === 'user' ? 'right-0' : 'left-9'
        )}
      >
        {message.role === 'user' && onEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onEdit}
                className="text-foreground h-6 w-6"
              >
                <Pencil size={12} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">编辑</TooltipContent>
          </Tooltip>
        )}

        {/* 版本历史按钮 */}
        {hasVersions && (
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowVersionHistory(!showVersionHistory)}
                  className={cn(
                    "text-foreground h-6 w-6 relative",
                    showVersionHistory && "text-primary"
                  )}
                >
                  <History size={12} />
                  {/* 版本数量徽章 */}
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground font-bold leading-none px-0.5">
                    {message.versions!.length}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">版本历史</TooltipContent>
            </Tooltip>

            {showVersionHistory && (
              <VersionHistoryPanel
                versions={message.versions!}
                currentContent={message.content}
                onRestore={(versionIndex) => {
                  if (onRestoreVersion) onRestoreVersion(versionIndex)
                }}
                onClose={() => setShowVersionHistory(false)}
              />
            )}
          </div>
        )}

        {/* 复制按钮：左键直接复制 Markdown，右键显示格式选择菜单 */}
        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleCopyAs('markdown')}
                onContextMenu={(e) => { e.preventDefault(); setShowCopyMenu(!showCopyMenu) }}
                className="text-foreground h-6 w-6"
              >
                {copied ? (
                  <Check size={12} className="text-[var(--color-success)]" />
                ) : (
                  <Copy size={12} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{copied ? '已复制' : '复制（右键更多格式）'}</TooltipContent>
          </Tooltip>

          {/* 复制格式选择下拉菜单 */}
          {showCopyMenu && (
            <div
              ref={copyMenuRef}
              className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border border-border bg-popover shadow-xl py-1"
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-popover-foreground hover:bg-accent transition-colors cursor-pointer"
                onClick={() => handleCopyAs('markdown')}
              >
                <FileText size={12} /> Markdown
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-popover-foreground hover:bg-accent transition-colors cursor-pointer"
                onClick={() => handleCopyAs('plain')}
              >
                <Type size={12} /> 纯文本
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-popover-foreground hover:bg-accent transition-colors cursor-pointer"
                onClick={() => handleCopyAs('withRole')}
              >
                <User size={12} /> 带角色前缀
              </button>
            </div>
          )}
        </div>

        {/* 引用回复按钮 */}
        {onQuote && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onQuote}
                className="text-foreground h-6 w-6"
              >
                <MessageSquareQuote size={12} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[11px]">引用回复</TooltipContent>
          </Tooltip>
        )}

        {/* 收藏/取消收藏按钮 */}
        {onToggleBookmark && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  onToggleBookmark()
                  toast.success(bookmarked ? '已取消收藏' : '已收藏')
                }}
                className="text-foreground h-6 w-6"
              >
                {bookmarked ? (
                  <BookmarkCheck size={12} className="text-yellow-400/80" />
                ) : (
                  <Bookmark size={12} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{bookmarked ? '取消收藏' : '收藏'}</TooltipContent>
          </Tooltip>
        )}

        {/* 保存到知识库按钮 */}
        {onSaveToKnowledge && message.role === 'assistant' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onSaveToKnowledge}
                className="text-foreground h-6 w-6"
              >
                <BookOpen size={12} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">保存到知识库</TooltipContent>
          </Tooltip>
        )}

        {/* 固定/取消固定按钮 */}
        {onPin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  onPin()
                  toast.success(isPinned ? '已取消固定' : '已固定到顶部')
                }}
                className="text-foreground h-6 w-6"
              >
                {isPinned ? (
                  <PinOff size={12} className="text-blue-400/80" />
                ) : (
                  <Pin size={12} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{isPinned ? '取消固定' : '固定到顶部'}</TooltipContent>
          </Tooltip>
        )}

        {/* 朗读按钮 */}
        {onSpeak && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onSpeak}
                className={cn(
                  "text-foreground h-6 w-6",
                  isSpeaking && "text-primary"
                )}
              >
                {isSpeaking ? (
                  <Square size={12} className="text-primary" />
                ) : (
                  <Volume2 size={12} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{isSpeaking ? '停止朗读' : '朗读'}</TooltipContent>
          </Tooltip>
        )}

        {/* 翻译按钮 */}
        {onTranslate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onTranslate}
                disabled={isTranslating}
                className={cn(
                  "text-foreground h-6 w-6",
                  isTranslating && "opacity-50"
                )}
              >
                {isTranslating ? (
                  <Loader2 size={12} className="animate-spin text-primary" />
                ) : (
                  <Languages size={12} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{isTranslating ? '翻译中...' : '翻译'}</TooltipContent>
          </Tooltip>
        )}

        {message.role === 'assistant' && onRegenerate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onRegenerate}
                className="text-foreground h-6 w-6"
              >
                <RefreshCw size={12} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">重新生成</TooltipContent>
          </Tooltip>
        )}

        {onFork && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onFork}
                className="text-foreground h-6 w-6"
              >
                <GitBranch size={13} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[11px]">
              从此处分叉对话
            </TooltipContent>
          </Tooltip>
        )}

        {onCopyLink && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onCopyLink}
                className="text-foreground h-6 w-6"
              >
                <Link2 size={12} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[11px]">
              复制消息链接
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

// ===================== TokenUsageBadge =====================

/** Token 用量显示徽章 */
export function TokenUsageBadge({ inputTokens, outputTokens }: { inputTokens: number; outputTokens: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 mt-1.5",
        "text-[10px] text-muted-foreground",
        "select-none"
      )}
    >
      <span>↑ {formatTokenCount(inputTokens)}</span>
      <span>↓ {formatTokenCount(outputTokens)}</span>
      <span>tokens</span>
    </span>
  )
}

// ===================== FeedbackButtons =====================

/** 消息反馈按钮（点赞/踩） */
export function FeedbackButtons({ sessionId, message }: { sessionId: string; message: Message }) {
  const setMessageFeedback = useSessionStore((s) => s.setMessageFeedback)
  const currentFeedback = message.feedback ?? null

  /** 点击反馈按钮：已选中则取消，否则设置 */
  const handleFeedback = (type: 'up' | 'down') => {
    const newFeedback = currentFeedback === type ? null : type
    setMessageFeedback(sessionId, message.id, newFeedback)
  }

  return (
    <span className="inline-flex items-center gap-0.5 mt-1.5 ml-1">
      <button
        type="button"
        onClick={() => handleFeedback('up')}
        className={cn(
          "inline-flex items-center justify-center w-5 h-5 rounded transition-all duration-150",
          "hover:bg-accent active:scale-90",
          currentFeedback === 'up'
            ? "opacity-100 text-green-400/80"
            : "opacity-30 text-muted-foreground hover:opacity-70"
        )}
        title="点赞"
      >
        <ThumbsUp size={12} />
      </button>
      <button
        type="button"
        onClick={() => handleFeedback('down')}
        className={cn(
          "inline-flex items-center justify-center w-5 h-5 rounded transition-all duration-150",
          "hover:bg-accent active:scale-90",
          currentFeedback === 'down'
            ? "opacity-100 text-red-400/80"
            : "opacity-30 text-muted-foreground hover:opacity-70"
        )}
        title="踩"
      >
        <ThumbsDown size={12} />
      </button>
    </span>
  )
}

// ===================== MessageReactions =====================

/** Emoji 反应组件：显示已有反应 + 悬浮快捷 emoji + 更多 emoji 面板 */
const QUICK_EMOJIS = ['👍', '👎', '❤️', '🎉', '🤔', '👀']
/** 更多 emoji 面板：12 个常用 emoji（含快捷列表中未出现的） */
const MORE_EMOJIS = ['👍', '👎', '❤️', '🎉', '🤔', '👀', '😂', '🔥', '💯', '👏', '😍', '🙏']

export function MessageReactions({ sessionId, message }: { sessionId: string; message: Message }) {
  const [showPicker, setShowPicker] = useState(false)
  const toggleReaction = useSessionStore(s => s.toggleReaction)
  const reactions = message.reactions || {}
  const hasReactions = Object.keys(reactions).length > 0
  const pickerRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭更多 emoji 面板
  useEffect(() => {
    if (!showPicker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showPicker])

  return (
    <div className="flex flex-col gap-1 mt-1">
      {/* 已有的 emoji 反应气泡（始终显示） */}
      {hasReactions && (
        <div className="flex items-center gap-1 flex-wrap">
          {Object.entries(reactions).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => toggleReaction(sessionId, message.id, emoji)}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px]
                border border-border hover:border-primary/30 hover:bg-accent
                transition-all duration-150 cursor-pointer active:scale-95"
            >
              <span>{emoji}</span>
              <span className="text-muted-foreground">{count}</span>
            </button>
          ))}
        </div>
      )}
      {/* 悬浮快捷反应栏：桌面端 hover 出现，移动端始终显示 */}
      <div className={cn(
        "flex items-center gap-0.5 transition-opacity duration-200",
        /* 移动端始终可见；桌面端默认隐藏，父 group/msg hover 时显示 */
        "opacity-100 md:opacity-0 md:group-hover/msg:opacity-100",
        /* 当 picker 打开或已有反应时也保持可见 */
        (showPicker || hasReactions) && "md:opacity-100"
      )}>
        {QUICK_EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => toggleReaction(sessionId, message.id, emoji)}
            className={cn(
              "text-[15px] p-0.5 rounded hover:bg-accent cursor-pointer transition-all duration-150",
              "hover:scale-110 active:scale-95",
              /* 如果该 emoji 已被选中，增加视觉提示 */
              reactions[emoji] ? "opacity-100 bg-accent/50" : "opacity-50 hover:opacity-100"
            )}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
        {/* "+" 更多 emoji 按钮 */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker(!showPicker)}
            className={cn(
              "inline-flex items-center justify-center w-6 h-6 rounded-full",
              "text-foreground/40 hover:bg-accent",
              "transition-all duration-150 cursor-pointer",
              showPicker && "text-foreground/60 bg-accent"
            )}
            title="更多表情"
          >
            <SmilePlus size={13} />
          </button>
          {/* 更多 emoji 选择面板（12 个常用） */}
          {showPicker && (
            <div className="absolute bottom-full left-0 mb-1 grid grid-cols-6 gap-0.5
              px-2 py-1.5 rounded-lg bg-popover border border-border shadow-lg z-30 min-w-[180px]">
              {MORE_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { toggleReaction(sessionId, message.id, emoji); setShowPicker(false) }}
                  className={cn(
                    "text-[18px] p-1 rounded hover:bg-accent cursor-pointer transition-colors",
                    "hover:scale-110 active:scale-95",
                    reactions[emoji] ? "bg-accent/50" : ""
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
