/**
 * 消息相关的类型定义
 * 从 MessageList.tsx 提取，供多个模块复用
 */

import type { Message } from '../stores/sessionStore'

/** 进度事件项 */
export interface ProgressItem {
  type: string
  name: string
}

/** 工具调用的解析结果 */
export interface ToolUseParsed {
  id: string
  name: string
  input: string
}

/** 工具结果的解析结果 */
export interface ToolResultParsed {
  id: string
  content: string
}

/** 消息分组信息：用于折叠较早的消息 */
export interface MessageGroup {
  /** 组在 groups 数组中的索引 */
  groupIndex: number
  /** 组内消息在 messages 数组中的起始索引 */
  startIdx: number
  /** 组内消息在 messages 数组中的结束索引（不含） */
  endIdx: number
  /** 组内消息数量 */
  count: number
  /** 组内最早消息的时间戳 */
  startTime: number
  /** 组内最晚消息的时间戳 */
  endTime: number
}

/** 右键上下文菜单属性 */
export interface ContextMenuProps {
  x: number
  y: number
  message: Message
  onClose: () => void
  onCopy: () => void
  onEdit?: () => void
  onRegenerate?: () => void
  onFork?: () => void
  onCopyLink?: () => void
  onQuote?: () => void
  onBookmark?: () => void
  isBookmarked?: boolean
  onSaveToKnowledge?: () => void
  onPin?: () => void
  isPinned?: boolean
  onSelectMode?: () => void
  onSpeak?: () => void
  isSpeaking?: boolean
  onTranslate?: () => void
  isTranslating?: boolean
}

/** MessageList 组件的 Props */
export interface MessageListProps {
  messages: Message[]
  highlightedMessageId?: string | null
  activeProgress?: ProgressItem[]
  selectMode?: boolean
  onSelectModeChange?: (mode: boolean) => void
  onSuggestionClick?: (text: string) => void
  onEditMessage?: (id: string, content: string) => void
  onRegenerateMessage?: (id: string) => void
  onForkFromMessage?: (messageId: string) => void
  onQuoteMessage?: (message: Message) => void
}
