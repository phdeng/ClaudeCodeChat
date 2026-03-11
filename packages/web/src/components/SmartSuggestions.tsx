import { useMemo } from 'react'
import { Lightbulb, Code, BookOpen, AlertTriangle, Sparkles, HelpCircle, Wrench } from 'lucide-react'
import type { Message } from '../stores/sessionStore'

// ==================== 建议类型定义 ====================

/** 单条智能建议 */
interface Suggestion {
  /** 建议文本（点击后直接发送） */
  text: string
  /** 图标类型 */
  icon: 'code' | 'explain' | 'improve' | 'warning' | 'example' | 'question' | 'tool'
}

/** 组件 Props */
interface SmartSuggestionsProps {
  /** 当前会话的消息列表 */
  messages: Message[]
  /** 是否正在流式输出（流式中不显示建议） */
  isStreaming: boolean
  /** 点击建议后的回调（直接发送消息） */
  onSuggestionClick: (text: string) => void
}

// ==================== 图标映射 ====================

/** 根据图标类型返回对应的 Lucide 图标组件 */
const iconMap = {
  code: Code,
  explain: BookOpen,
  improve: Sparkles,
  warning: AlertTriangle,
  example: Lightbulb,
  question: HelpCircle,
  tool: Wrench,
}

// ==================== 内容分析工具函数 ====================

/**
 * 检测内容是否包含代码块
 * 匹配 Markdown 围栏代码块（```）
 */
function hasCodeBlock(content: string): boolean {
  return /```[\s\S]*?```/.test(content)
}

/**
 * 检测内容是否主要是解释性/说明性文本
 * 判断标准：没有代码块，且包含常见解释性关键词
 */
function isExplanation(content: string): boolean {
  if (hasCodeBlock(content)) return false
  const explanationKeywords = [
    '是指', '意思是', '简单来说', '换句话说', '也就是说',
    '概念', '原理', '定义', '本质上', '通常',
    '用于', '可以理解为', '例如', '比如', '作用是',
    'means', 'refers to', 'is a', 'basically', 'essentially',
    'in other words', 'concept', 'principle', 'definition',
  ]
  return explanationKeywords.some(kw => content.toLowerCase().includes(kw.toLowerCase()))
}

/**
 * 检测内容是否包含错误/问题排查
 * 匹配常见错误关键词
 */
function hasErrorContent(content: string): boolean {
  const errorKeywords = [
    'error', 'Error', '错误', '报错', '异常', '失败',
    'bug', 'Bug', 'BUG', 'exception', 'Exception',
    'TypeError', 'SyntaxError', 'ReferenceError',
    'undefined', 'null', 'NaN', 'stack trace',
    '解决方案', '修复', 'fix', 'Fix', 'debug', 'Debug',
  ]
  return errorKeywords.some(kw => content.includes(kw))
}

/**
 * 检测内容是否包含列表/步骤说明
 */
function hasSteps(content: string): boolean {
  // 匹配有序列表（1. 2. 3.）或标题式步骤
  const stepPatterns = [
    /^\d+\.\s/m,           // 有序列表
    /^[-*]\s/m,            // 无序列表
    /^#+\s.*步骤/m,        // 标题含「步骤」
    /^step\s*\d/im,        // Step N
    /首先|其次|然后|最后/,   // 中文步骤词
  ]
  return stepPatterns.some(p => p.test(content))
}

/**
 * 检测内容是否涉及性能优化话题
 */
function isPerformanceTopic(content: string): boolean {
  const perfKeywords = [
    '性能', '优化', '缓存', '并发', '异步',
    'performance', 'optimize', 'cache', 'concurrent', 'async',
    '内存', 'memory', 'latency', '延迟', '吞吐',
  ]
  return perfKeywords.some(kw => content.toLowerCase().includes(kw.toLowerCase()))
}

// ==================== 建议生成逻辑 ====================

/**
 * 根据对话上下文生成智能建议列表
 * 规则匹配优先级：代码 > 错误 > 性能 > 步骤 > 解释 > 通用
 */
function generateSuggestions(messages: Message[]): Suggestion[] {
  // 无消息 → 新会话通用建议
  if (!messages || messages.length === 0) {
    return [
      { text: '帮我写一段代码', icon: 'code' },
      { text: '解释一个编程概念', icon: 'explain' },
      { text: '帮我做代码 Review', icon: 'improve' },
    ]
  }

  // 找到最后一条 assistant 消息
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant' && !m.isStreaming)
  if (!lastAssistantMsg) {
    // 只有用户消息，还没有回复
    return []
  }

  const content = lastAssistantMsg.content

  // 如果回复为空或很短（如错误提示），不显示建议
  if (!content || content.trim().length < 20) {
    return []
  }

  const suggestions: Suggestion[] = []

  // 1. 代码类回复
  if (hasCodeBlock(content)) {
    suggestions.push({ text: '解释这段代码的工作原理', icon: 'explain' })

    if (hasErrorContent(content)) {
      suggestions.push({ text: '这个错误还有其他可能的原因吗？', icon: 'warning' })
      suggestions.push({ text: '如何避免将来出现这类错误？', icon: 'improve' })
    } else {
      suggestions.push({ text: '有没有更好的写法？', icon: 'improve' })
      suggestions.push({ text: '帮我添加错误处理和边界检查', icon: 'warning' })
    }

    return suggestions.slice(0, 3)
  }

  // 2. 错误排查类回复
  if (hasErrorContent(content)) {
    suggestions.push({ text: '能给一个完整的修复示例吗？', icon: 'code' })
    suggestions.push({ text: '这个问题的根本原因是什么？', icon: 'question' })
    suggestions.push({ text: '有没有相关的最佳实践？', icon: 'improve' })
    return suggestions.slice(0, 3)
  }

  // 3. 性能优化类
  if (isPerformanceTopic(content)) {
    suggestions.push({ text: '能给出具体的优化代码示例吗？', icon: 'code' })
    suggestions.push({ text: '如何量化优化效果？', icon: 'tool' })
    suggestions.push({ text: '有什么需要注意的权衡取舍？', icon: 'warning' })
    return suggestions.slice(0, 3)
  }

  // 4. 步骤/教程类回复
  if (hasSteps(content)) {
    suggestions.push({ text: '能给每个步骤一个代码示例吗？', icon: 'code' })
    suggestions.push({ text: '有什么常见的坑需要注意？', icon: 'warning' })
    suggestions.push({ text: '有没有更简单的替代方案？', icon: 'improve' })
    return suggestions.slice(0, 3)
  }

  // 5. 解释类回复
  if (isExplanation(content)) {
    suggestions.push({ text: '能给一个具体的例子吗？', icon: 'example' })
    suggestions.push({ text: '使用时有什么注意事项？', icon: 'warning' })
    suggestions.push({ text: '有哪些相关的概念需要了解？', icon: 'question' })
    return suggestions.slice(0, 3)
  }

  // 6. 通用后续建议（兜底）
  suggestions.push({ text: '能展开说说吗？', icon: 'question' })
  suggestions.push({ text: '能给一个代码示例吗？', icon: 'code' })
  suggestions.push({ text: '还有其他需要注意的吗？', icon: 'warning' })

  return suggestions.slice(0, 3)
}

// ==================== 组件 ====================

/**
 * 智能输入建议组件
 * 根据对话上下文自动生成 2-3 个后续提问建议，以紧凑卡片形式水平排列显示
 * - 流式输出期间隐藏
 * - 点击建议直接发送消息
 */
export default function SmartSuggestions({ messages, isStreaming, onSuggestionClick }: SmartSuggestionsProps) {
  // 根据消息列表计算建议，消息变化时重新生成
  const suggestions = useMemo(() => generateSuggestions(messages), [messages])

  // 流式输出中 或 无建议时不渲染
  if (isStreaming || suggestions.length === 0) {
    return null
  }

  return (
    <div className="flex-shrink-0 w-full max-w-[960px] mx-auto px-3 sm:px-5 pb-1">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        {/* 提示图标 */}
        <Lightbulb
          size={13}
          className="flex-shrink-0 text-primary/60"
        />
        {/* 建议卡片列表 */}
        {suggestions.map((suggestion, index) => {
          const IconComponent = iconMap[suggestion.icon]
          return (
            <button
              key={index}
              onClick={() => onSuggestionClick(suggestion.text)}
              className="
                flex-shrink-0 flex items-center gap-1.5
                px-2.5 py-1.5 rounded-lg
                text-[12px] leading-tight
                bg-secondary/50 hover:bg-secondary
                text-foreground
                border border-border/50 hover:border-border
                transition-all duration-150 ease-out
                cursor-pointer select-none
                whitespace-nowrap
                hover:shadow-sm
                active:scale-[0.97]
              "
            >
              <IconComponent size={12} className="flex-shrink-0 text-primary/70" />
              <span>{suggestion.text}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
