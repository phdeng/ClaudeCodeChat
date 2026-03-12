/**
 * 消息相关的工具函数
 * 从 MessageList.tsx 提取，供多个模块复用
 */

import {
  Terminal, FileText, FileEdit, FilePlus, Search, FolderSearch,
  FolderOpen, Bot, BookOpen, Pencil, Settings2, Wrench,
} from 'lucide-react'
import type { ToolUseParsed, ToolResultParsed } from '../types/messageTypes'

// ===================== 时间与日期格式化 =====================

/** 格式化时间戳为 HH:mm 格式 */
export function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** 格式化日期分隔线文本：今天/昨天/M月D日/YYYY年M月D日 */
export function formatDateSeparator(ts: number): string {
  const date = new Date(ts)
  const now = new Date()

  // 获取"今天"的 0 点和"昨天"的 0 点
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

  if (dayStart === todayStart) return '今天'
  if (dayStart === yesterdayStart) return '昨天'

  // 不同年份显示完整年份
  if (date.getFullYear() !== now.getFullYear()) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`
}

/** 判断两个时间戳是否属于同一天 */
export function isSameDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1)
  const d2 = new Date(ts2)
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

/** 格式化分组折叠条的时间范围文本 */
export function formatGroupTimeRange(startTs: number, endTs: number): string {
  const startDate = new Date(startTs)
  const endDate = new Date(endTs)
  const now = new Date()

  const formatDatePart = (d: Date): string => {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    if (dayStart === todayStart) return ''
    if (d.getFullYear() !== now.getFullYear()) {
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 `
    }
    return `${d.getMonth() + 1}月${d.getDate()}日 `
  }

  const formatTimePart = (d: Date): string => {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const sameDay = isSameDay(startTs, endTs)
  if (sameDay) {
    const datePart = formatDatePart(startDate)
    return `${datePart}${formatTimePart(startDate)} - ${formatTimePart(endDate)}`
  }
  return `${formatDatePart(startDate)}${formatTimePart(startDate)} - ${formatDatePart(endDate)}${formatTimePart(endDate)}`
}

// ===================== 文本统计与分析 =====================

/**
 * 统计消息字数（中文字符 + 英文单词数）
 * 中文字符按字计数，英文按空格分隔的单词计数
 */
export function countWords(text: string): { total: number; chinese: number; english: number } {
  // 去除 Markdown 语法标记以获得更准确的计数
  const cleaned = text
    .replace(/```[\s\S]*?```/g, '') // 去掉代码块
    .replace(/`[^`]*`/g, '')        // 去掉行内代码
    .replace(/[#*_~>\-|[\]()!]/g, '') // 去掉 Markdown 符号
    .trim()

  // 统计中文字符数（CJK 统一表意文字）
  const chineseChars = cleaned.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []
  const chinese = chineseChars.length

  // 去除中文字符后统计英文单词数
  const withoutChinese = cleaned.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ')
  const englishWords = withoutChinese.split(/\s+/).filter(w => w.length > 0)
  const english = englishWords.length

  return { total: chinese + english, chinese, english }
}

/**
 * 估算阅读时间
 * 中文按 300 字/分钟，英文按 200 词/分钟
 */
export function estimateReadingTime(text: string): string {
  const { chinese, english } = countWords(text)
  const minutes = chinese / 300 + english / 200
  if (minutes < 1) return '不到 1 分钟'
  if (minutes < 2) return '约 1 分钟'
  return `约 ${Math.round(minutes)} 分钟`
}

/** 格式化 token 数量，超过 1000 显示为 x.xk */
export function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k'
  }
  return String(count)
}

/**
 * 检测文本的主要语言：中文还是英文
 * 返回 'zh-CN' 或 'en-US'
 */
export function detectLanguage(text: string): string {
  // 计算中文字符数量
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  // 计算英文单词数量（粗略估计）
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  // 如果中文字符占比较高，返回中文
  // 每个中文字大致等于一个英文单词
  return chineseChars >= englishWords ? 'zh-CN' : 'en-US'
}

// ===================== 文本清理与解析 =====================

/**
 * 清理 CLI 工具调用的自闭合标签（如 <Read file_path="..." />）
 * 这些标签是 Claude CLI 的内部工具调用，不应展示给用户
 */
export function stripCliToolTags(content: string): string {
  return content
    // 自闭合标签: <Read file_path="..." />, <Write ... />, <Bash ... /> 等
    .replace(/<(?:Read|Write|Edit|Bash|Glob|Grep|LS|LSP|Agent|MultiEdit)\s+[^>]*\/>/g, '')
    // 清理多余空行
    .replace(/\n{3,}/g, '\n\n')
}

/** 去除 Markdown 语法，返回纯文本 */
export function stripMarkdown(md: string): string {
  return md
    // 去除 <thinking>...</thinking> 块
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
    // 去除围栏代码块（```...```），仅保留代码内容
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '$1')
    // 去除行内代码
    .replace(/`([^`]+)`/g, '$1')
    // 去除图片 ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // 去除链接 [text](url)，保留文本
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 去除粗体 **text** 或 __text__
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    // 去除斜体 *text* 或 _text_
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // 去除删除线 ~~text~~
    .replace(/~~(.*?)~~/g, '$1')
    // 去除标题标记 # ## ### 等
    .replace(/^#{1,6}\s+/gm, '')
    // 去除无序列表符号 - * +
    .replace(/^[\s]*[-*+]\s+/gm, '')
    // 去除有序列表数字前缀
    .replace(/^[\s]*\d+[.)]\s+/gm, '')
    // 去除水平线 --- *** ___
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // 去除引用标记 >
    .replace(/^>\s?/gm, '')
    // 去除 HTML 标签
    .replace(/<[^>]+>/g, '')
    // 合并多个连续空行为单个换行
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ===================== 结构化内容解析 =====================

/** 解析消息内容中的 <thinking> 块，将内容拆分为普通文本和思考过程两种类型
 *  支持流式过程中未闭合的 <thinking> 标签（尚未收到 </thinking>） */
export function parseThinking(content: string): { parts: Array<{ type: 'text' | 'thinking'; content: string; isOpen?: boolean }> } {
  const parts: Array<{ type: 'text' | 'thinking'; content: string; isOpen?: boolean }> = []
  // 使用正则匹配所有已闭合的 <thinking>...</thinking> 块（支持跨行）
  const regex = /<thinking>([\s\S]*?)<\/thinking>/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    // 添加 thinking 标签之前的普通文本
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim()
      if (textBefore) {
        parts.push({ type: 'text', content: textBefore })
      }
    }
    // 添加 thinking 块内容（已闭合）
    const thinkingContent = match[1].trim()
    if (thinkingContent) {
      parts.push({ type: 'thinking', content: thinkingContent })
    }
    lastIndex = match.index + match[0].length
  }

  // 处理最后一段内容：检查是否有未闭合的 <thinking> 标签（流式过程中）
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex)
    const openTagIndex = remaining.indexOf('<thinking>')
    if (openTagIndex !== -1) {
      // 未闭合 <thinking> 标签之前的普通文本
      const textBefore = remaining.slice(0, openTagIndex).trim()
      if (textBefore) {
        parts.push({ type: 'text', content: textBefore })
      }
      // 未闭合的 thinking 内容（流式中）
      const thinkingContent = remaining.slice(openTagIndex + '<thinking>'.length).trim()
      if (thinkingContent) {
        parts.push({ type: 'thinking', content: thinkingContent, isOpen: true })
      }
    } else {
      const trimmed = remaining.trim()
      if (trimmed) {
        parts.push({ type: 'text', content: trimmed })
      }
    }
  }

  // 如果没有匹配到任何 thinking 块，返回原始内容
  if (parts.length === 0) {
    parts.push({ type: 'text', content })
  }

  return { parts }
}

/** 解析文本中的 <tool-use> 和 <tool-result> 标签
 *  返回分段：普通文本、工具调用、工具结果 */
export function parseToolBlocks(content: string): Array<
  | { type: 'text'; content: string }
  | { type: 'tool-use'; data: ToolUseParsed }
  | { type: 'tool-result'; data: ToolResultParsed }
> {
  const parts: Array<
    | { type: 'text'; content: string }
    | { type: 'tool-use'; data: ToolUseParsed }
    | { type: 'tool-result'; data: ToolResultParsed }
  > = []

  // 匹配 <tool-use id="..." name="...">...</tool-use> 和 <tool-result id="...">...</tool-result>
  const regex = /<tool-use\s+id="([^"]*)"\s+name="([^"]*)">([\s\S]*?)<\/tool-use>|<tool-result\s+id="([^"]*)">([\s\S]*?)<\/tool-result>/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    // 添加匹配之前的普通文本
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim()
      if (textBefore) {
        parts.push({ type: 'text', content: textBefore })
      }
    }

    if (match[2] !== undefined) {
      // tool-use 匹配: match[1]=id, match[2]=name, match[3]=input
      parts.push({
        type: 'tool-use',
        data: { id: match[1], name: match[2], input: match[3] || '' },
      })
    } else {
      // tool-result 匹配: match[4]=id, match[5]=content
      parts.push({
        type: 'tool-result',
        data: { id: match[4], content: match[5] || '' },
      })
    }

    lastIndex = match.index + match[0].length
  }

  // 处理剩余的文本（可能包含未闭合的 tool-use 标签 — 流式中）
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex)
    // 检查是否有未闭合的 <tool-use> 标签
    const openToolUseMatch = remaining.match(/<tool-use\s+id="([^"]*)"\s+name="([^"]*)">([\s\S]*)$/)
    if (openToolUseMatch) {
      const textBefore = remaining.slice(0, remaining.indexOf('<tool-use')).trim()
      if (textBefore) {
        parts.push({ type: 'text', content: textBefore })
      }
      // 未闭合的工具调用（正在流式输入参数）
      parts.push({
        type: 'tool-use',
        data: { id: openToolUseMatch[1], name: openToolUseMatch[2], input: openToolUseMatch[3] || '' },
      })
    } else {
      const trimmed = remaining.trim()
      if (trimmed) {
        parts.push({ type: 'text', content: trimmed })
      }
    }
  }

  if (parts.length === 0) {
    parts.push({ type: 'text', content })
  }

  return parts
}

// ===================== 工具信息映射 =====================

/** 工具名称到中文名称和图标的映射 */
export const TOOL_INFO: Record<string, { label: string; icon: typeof Terminal }> = {
  Bash: { label: '终端', icon: Terminal },
  Read: { label: '读取文件', icon: FileText },
  Edit: { label: '编辑文件', icon: FileEdit },
  Write: { label: '写入文件', icon: FilePlus },
  MultiEdit: { label: '批量编辑', icon: FileEdit },
  Grep: { label: '搜索内容', icon: Search },
  Glob: { label: '查找文件', icon: FolderSearch },
  LS: { label: '列出目录', icon: FolderOpen },
  Agent: { label: '子代理', icon: Bot },
  TodoRead: { label: '读取待办', icon: BookOpen },
  TodoWrite: { label: '写入待办', icon: Pencil },
  WebSearch: { label: '网页搜索', icon: Search },
  WebFetch: { label: '获取网页', icon: FolderOpen },
}

/** 获取工具的显示信息 */
export function getToolInfo(name: string): { label: string; Icon: typeof Terminal } {
  const info = TOOL_INFO[name]
  if (info) return { label: info.label, Icon: info.icon }
  // 以 mcp__ 开头的 MCP 工具
  if (name.startsWith('mcp__')) {
    const parts = name.split('__')
    return { label: `MCP: ${parts.slice(1).join('/')}`, Icon: Settings2 }
  }
  return { label: name, Icon: Wrench }
}

// ===================== 智能建议生成 =====================

/**
 * 根据助手消息内容生成上下文相关的快捷回复
 * 分析内容特征（代码块、错误信息、列表、长度等），返回 2-3 个智能建议
 */
export function generateQuickReplies(content: string): string[] {
  // 检查是否包含代码块
  if (/```[\s\S]*?```/.test(content)) {
    return ['解释这段代码', '优化这段代码', '添加注释']
  }

  // 检查是否包含错误/bug 相关词
  if (/错误|error|bug|异常|exception|失败|failed|问题|issue|crash/i.test(content)) {
    return ['如何修复?', '详细解释原因', '有其他方案吗?']
  }

  // 检查内容是否包含问题/疑问
  if (/[？?]\s*$/.test(content.trim()) || /你(想|需要|希望|觉得|认为)/.test(content)) {
    return ['是的', '不是', '详细说说']
  }

  // 检查内容是否很长（>500字符）
  if (content.length > 500) {
    return ['总结要点', '继续', '给个例子']
  }

  // 检查是否包含列表（有序或无序）
  if (/^[\s]*[-*•]\s|^\d+[.)]\s/m.test(content)) {
    return ['详细展开', '哪个更推荐?', '继续']
  }

  // 默认快捷回复
  return ['继续', '详细解释', '给个例子']
}

/**
 * 根据助手消息内容生成后续建议列表
 * 通过关键词匹配判断内容类型，返回 2-3 个相关的后续操作建议
 */
export function generateSuggestions(content: string): string[] {
  // 检查是否包含代码块（```...```）
  const hasCodeBlock = /```[\s\S]*?```/.test(content)
  if (hasCodeBlock) {
    return ['解释这段代码', '优化这段代码', '写测试用例']
  }

  // 检查是否包含错误/bug 相关内容
  const hasError = /错误|error|bug|异常|exception|失败|failed/i.test(content)
  if (hasError) {
    return ['如何修复？', '还有其他原因吗？', '给出完整代码']
  }

  // 检查内容是否较长（超过 500 字符）
  if (content.length > 500) {
    return ['总结一下', '列出要点', '继续']
  }

  // 默认建议
  return ['继续', '展开说说', '给个例子']
}
