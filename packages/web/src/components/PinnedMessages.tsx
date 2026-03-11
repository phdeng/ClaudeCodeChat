import { useState, useCallback } from 'react'
import { Pin, ChevronDown, ChevronRight, X, ArrowRight } from 'lucide-react'
import type { Message } from '../stores/sessionStore'

interface PinnedMessagesProps {
  /** 当前会话的所有消息 */
  messages: Message[]
  /** 取消置顶的回调 */
  onUnpin: (messageId: string) => void
  /** 跳转到消息的回调 */
  onJumpToMessage: (messageId: string) => void
}

/** 截取消息摘要（前100字） */
function getMessageSummary(content: string, maxLen = 100): string {
  // 去除 Markdown 标记
  const plain = content
    .replace(/```[\s\S]*?```/g, '[代码块]')
    .replace(/`[^`]+`/g, '[代码]')
    .replace(/!\[.*?\]\(.*?\)/g, '[图片]')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/[#*_~>-]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
  if (plain.length <= maxLen) return plain
  return plain.slice(0, maxLen) + '...'
}

/**
 * 置顶消息区域
 * 在消息列表上方显示，可折叠
 * 显示置顶消息的摘要，点击跳转到原消息
 */
export default function PinnedMessages({ messages, onUnpin, onJumpToMessage }: PinnedMessagesProps) {
  const [expanded, setExpanded] = useState(false)

  // 筛选已置顶的消息
  const pinnedMessages = messages.filter(m => m.pinned)

  if (pinnedMessages.length === 0) return null

  return (
    <div className="flex-shrink-0 w-full max-w-[960px] mx-auto px-3 sm:px-5">
      <div className="border border-primary/20 rounded-lg bg-primary/5 overflow-hidden">
        {/* 标题栏 */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-primary/80 hover:bg-primary/10 transition-colors cursor-pointer"
        >
          <Pin size={12} className="flex-shrink-0" />
          <span className="font-medium">置顶消息</span>
          <span className="text-primary/50">({pinnedMessages.length})</span>
          <div className="flex-1" />
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* 展开后显示置顶消息列表 */}
        {expanded && (
          <div className="border-t border-primary/10 divide-y divide-primary/10">
            {pinnedMessages.map(msg => (
              <div
                key={msg.id}
                className="flex items-start gap-2 px-3 py-2 group hover:bg-primary/5 transition-colors"
              >
                <span className="flex-shrink-0 mt-0.5 text-[10px] text-primary/50 uppercase font-medium w-8">
                  {msg.role === 'user' ? '你' : 'AI'}
                </span>
                <p className="flex-1 text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
                  {getMessageSummary(msg.content)}
                </p>
                <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* 跳转按钮 */}
                  <button
                    onClick={() => onJumpToMessage(msg.id)}
                    className="p-1 rounded hover:bg-accent text-foreground transition-colors cursor-pointer"
                    title="跳转到消息"
                  >
                    <ArrowRight size={12} />
                  </button>
                  {/* 取消置顶按钮 */}
                  <button
                    onClick={() => onUnpin(msg.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                    title="取消置顶"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 折叠时显示第一条置顶消息摘要 */}
        {!expanded && pinnedMessages.length > 0 && (
          <button
            onClick={() => onJumpToMessage(pinnedMessages[0].id)}
            className="w-full text-left px-3 py-1 border-t border-primary/10 text-[11px] text-foreground/70 truncate transition-colors cursor-pointer"
          >
            {getMessageSummary(pinnedMessages[0].content, 60)}
          </button>
        )}
      </div>
    </div>
  )
}
