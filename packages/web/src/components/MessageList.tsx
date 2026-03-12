import { Fragment, useEffect, useRef, useState, useCallback, useMemo, useId } from 'react'
import { Bot, Code, Zap, Lightbulb, FileCode, Copy, Check, RefreshCw, Pencil, ArrowDown, ThumbsUp, ThumbsDown, ChevronRight, ChevronDown, ChevronUp, Sparkles, Eye, FileText, GitBranch, Bookmark, BookmarkCheck, Maximize2, X, ClipboardPaste, BookOpen, Columns3, Search, Settings2, FolderOpen, MessageSquareQuote, Type, User, CheckSquare, Volume2, Square, Languages, Loader2, Link2, GripVertical, SmilePlus, Pin, PinOff, ChevronsUpDown, Terminal, FileEdit, FilePlus, FolderSearch, Wrench, MessageCirclePlus, StickyNote, Share2, Download, History, RotateCcw, Info, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
// 导入 KaTeX 样式，支持数学公式渲染
import 'katex/dist/katex.min.css'
import { codeToHtml } from 'shiki'
import mermaid from 'mermaid'
import { toast } from 'sonner'
import type { Components } from 'react-markdown'
import type { Message } from '../stores/sessionStore'
import { useSnippetStore } from '../stores/snippetStore'
import { useSessionStore } from '../stores/sessionStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useThemeStore } from '../stores/themeStore'
import { copyShareLink } from '../utils/shareLink'
import { cn } from '@/lib/utils'
import { ToolContentRenderer } from '@/components/ToolRenderers'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import SaveToKnowledgeDialog from '@/components/SaveToKnowledgeDialog'

/**
 * 图片灯箱预览组件
 */
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
      >
        <X size={18} />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

/**
 * 用户消息中的图片缩略图组件
 */
function MessageImages({ images, onPreview }: {
  images: Array<{ base64: string; name: string }>
  onPreview: (src: string, alt: string) => void
}) {
  return (
    <div className={cn('flex gap-2 flex-wrap', images.length > 0 && 'mb-2')}>
      {images.map((img, i) => (
        <button
          key={i}
          onClick={() => onPreview(img.base64, img.name)}
          className="relative group rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-colors cursor-zoom-in"
        >
          <img
            src={img.base64}
            alt={img.name}
            className="max-w-[200px] max-h-[150px] object-cover rounded-lg"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <Maximize2 size={16} className="text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-lg" />
          </div>
        </button>
      ))}
    </div>
  )
}

/**
 * 打字机效果 hook：逐字显现文本
 * @param text 要显示的完整文本
 * @param speed 每个字符的显示间隔（毫秒）
 * @param enabled 是否启用动画（false 则直接显示完整文本）
 * @returns displayedText 当前显示的文本, isComplete 是否已完成
 */
function useTypewriter(text: string, speed: number, enabled: boolean = true) {
  const [displayedText, setDisplayedText] = useState(enabled ? '' : text)
  const [isComplete, setIsComplete] = useState(!enabled)

  useEffect(() => {
    // 未启用时直接显示完整文本
    if (!enabled) {
      setDisplayedText(text)
      setIsComplete(true)
      return
    }

    setDisplayedText('')
    setIsComplete(false)
    let index = 0

    const timer = setInterval(() => {
      index++
      if (index >= text.length) {
        setDisplayedText(text)
        setIsComplete(true)
        clearInterval(timer)
      } else {
        setDisplayedText(text.slice(0, index))
      }
    }, speed)

    return () => clearInterval(timer)
  }, [text, speed, enabled])

  return { displayedText, isComplete }
}

/** 模块级标记：mermaid 是否已初始化 */
let mermaidInitialized = false

/** 全局计数器，用于生成唯一的 mermaid 渲染 ID */
let mermaidCounter = 0

/** Mermaid 图表渲染组件：支持暗色/亮色主题、图表/源码切换、错误回退 */
function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showSource, setShowSource] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [svgHtml, setSvgHtml] = useState<string | null>(null)
  const currentTheme = useThemeStore((s) => s.theme)
  const uniqueId = useId()

  // 初始化 mermaid 并渲染图表
  useEffect(() => {
    if (showSource) return

    const mermaidTheme = currentTheme === 'light' ? 'default' : 'dark'

    // 每次主题变化都重新初始化 mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme,
      securityLevel: 'strict',
    })
    mermaidInitialized = true

    // 生成唯一 ID（mermaid.render 要求）
    const renderId = `mermaid-${uniqueId.replace(/:/g, '')}-${mermaidCounter++}`

    let cancelled = false

    mermaid.render(renderId, code).then(({ svg }) => {
      if (!cancelled) {
        setSvgHtml(svg)
        setError(null)
      }
    }).catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : '图表渲染失败')
        setSvgHtml(null)
      }
    })

    return () => { cancelled = true }
  }, [code, currentTheme, showSource, uniqueId])

  // 切换按钮
  const toggleButton = (
    <div className="flex justify-end mb-2">
      <Button
        variant="ghost"
        size="xs"
        onClick={() => setShowSource(!showSource)}
        className={cn(
          "text-[11px] gap-1",
          "text-foreground",
          "border border-border"
        )}
      >
        {showSource ? (
          <>
            <Eye size={11} />
            <span>图表视图</span>
          </>
        ) : (
          <>
            <FileText size={11} />
            <span>源码视图</span>
          </>
        )}
      </Button>
    </div>
  )

  // 源码视图：复用 CodeBlock 显示原始 mermaid 代码
  if (showSource) {
    return (
      <div>
        {toggleButton}
        <CodeBlock className="language-mermaid">{code}</CodeBlock>
      </div>
    )
  }

  // 错误状态：显示错误信息并回退到源码
  if (error) {
    return (
      <div>
        {toggleButton}
        <div className={cn(
          "rounded-lg border border-red-500/30 bg-red-500/10 p-3 mb-2",
          "text-[12px] text-red-400"
        )}>
          ⚠ Mermaid 图表渲染失败：{error}
        </div>
        <CodeBlock className="language-mermaid">{code}</CodeBlock>
      </div>
    )
  }

  // 图表视图
  return (
    <div>
      {toggleButton}
      {svgHtml ? (
        <div
          ref={containerRef}
          className={cn(
            "flex justify-center p-4 rounded-lg",
            "bg-[var(--color-code-bg,rgba(0,0,0,0.15))]",
            "border border-border",
            "overflow-x-auto"
          )}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      ) : (
        <div className={cn(
          "flex items-center justify-center p-8 rounded-lg",
          "bg-[var(--color-code-bg,rgba(0,0,0,0.15))]",
          "border border-border",
          "text-[12px] text-muted-foreground"
        )}>
          正在渲染图表...
        </div>
      )}
    </div>
  )
}

/**
 * 模块级标记：欢迎页动画是否已经播放过
 * 使用模块级变量确保整个应用生命周期内只播放一次
 */
let welcomeAnimationPlayed = false

/** 进度事件项 */
interface ProgressItem {
  type: string
  name: string
}

interface MessageListProps {
  messages: Message[]
  highlightedMessageId?: string | null
  /** 搜索关键词，用于消息内文本高亮 */
  searchQuery?: string
  activeProgress?: ProgressItem[]
  selectMode?: boolean
  onSelectModeChange?: (mode: boolean) => void
  onSuggestionClick?: (text: string) => void
  onEditMessage?: (id: string, content: string) => void
  onRegenerateMessage?: (id: string) => void
  onForkFromMessage?: (messageId: string) => void
  onQuoteMessage?: (message: Message) => void
}

const SUGGESTIONS = [
  { icon: Code, text: '写一个 React 组件', desc: '快速生成组件代码' },
  { icon: Zap, text: '优化代码性能', desc: '分析并提升性能' },
  { icon: Lightbulb, text: '解释一段代码', desc: '理解代码逻辑' },
  { icon: FileCode, text: '重构项目结构', desc: '改善代码组织' },
]

/** 功能发现卡片：帮助新用户快速上手核心功能 */
const FEATURE_CARDS: Array<{ icon: typeof Search; label: string; description: string; hint: string; action: string }> = [
  { icon: Search, label: '消息搜索', description: '在对话中快速查找关键内容', hint: 'Ctrl+F', action: 'search' },
  { icon: Pin, label: '消息置顶', description: '置顶重要消息方便随时查看', hint: '右键菜单', action: 'pin-hint' },
  { icon: Code, label: '代码片段', description: '保存和管理常用代码片段', hint: 'Ctrl+Shift+S', action: 'snippets' },
  { icon: Eye, label: '主题定制', description: '切换深色/浅色/跟随系统主题', hint: '设置面板', action: 'theme' },
  { icon: Terminal, label: '会话统计', description: '查看消息数量、字数等统计', hint: '/stats', action: 'stats' },
  { icon: Download, label: '导出长图', description: '将对话导出为精美长图分享', hint: '/exportimage', action: 'exportimage' },
]

/** 快速操作按钮组件：pill 形状的小按钮 */
function QuickActionButton({ icon: Icon, label, onClick }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-card/50
        text-[12px] text-foreground hover:border-primary/30
        hover:bg-accent/50 transition-all duration-200"
    >
      <Icon size={13} className="opacity-60" />
      {label}
    </button>
  )
}

/**
 * 将文本中匹配搜索关键词的部分用 <mark> 标签包裹高亮显示
 * 大小写不敏感匹配
 */
function highlightSearchText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  if (parts.length <= 1) return text
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-yellow-300/80 dark:bg-yellow-500/40 text-inherit rounded-sm px-[1px]">{part}</mark>
      : part
  )
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/**
 * 统计消息字数（中文字符 + 英文单词数）
 * 中文字符按字计数，英文按空格分隔的单词计数
 */
function countWords(text: string): { total: number; chinese: number; english: number } {
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
function estimateReadingTime(text: string): string {
  const { chinese, english } = countWords(text)
  const minutes = chinese / 300 + english / 200
  if (minutes < 1) return '不到 1 分钟'
  if (minutes < 2) return '约 1 分钟'
  return `约 ${Math.round(minutes)} 分钟`
}

/** 格式化日期分隔线文本：今天/昨天/M月D日/YYYY年M月D日 */
function formatDateSeparator(ts: number): string {
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
function isSameDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1)
  const d2 = new Date(ts2)
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

/** 格式化 token 数量，超过 1000 显示为 x.xk */
function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k'
  }
  return String(count)
}

/**
 * 清理 CLI 工具调用的自闭合标签（如 <Read file_path="..." />）
 * 这些标签是 Claude CLI 的内部工具调用，不应展示给用户
 */
function stripCliToolTags(content: string): string {
  return content
    // 自闭合标签: <Read file_path="..." />, <Write ... />, <Bash ... /> 等
    .replace(/<(?:Read|Write|Edit|Bash|Glob|Grep|LS|LSP|Agent|MultiEdit)\s+[^>]*\/>/g, '')
    // 清理多余空行
    .replace(/\n{3,}/g, '\n\n')
}

/** 解析消息内容中的 <thinking> 块，将内容拆分为普通文本和思考过程两种类型
 *  支持流式过程中未闭合的 <thinking> 标签（尚未收到 </thinking>） */
function parseThinking(content: string): { parts: Array<{ type: 'text' | 'thinking'; content: string; isOpen?: boolean }> } {
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

/** 思考过程折叠面板组件
 *  isOpen: 标签是否未闭合（流式中正在思考）
 *  isStreaming: 当前消息是否正在流式输出 */
function ThinkingBlock({ content, markdownComponents, isOpen, isStreaming }: {
  content: string
  markdownComponents: Components
  isOpen?: boolean
  isStreaming?: boolean
}) {
  const [manualToggle, setManualToggle] = useState<boolean | null>(null)

  // 流式 thinking（未闭合）默认展开；已完成的 thinking 默认折叠
  // 用户手动切换后以手动状态为准
  const isActivelyThinking = isOpen && isStreaming
  const expanded = manualToggle !== null ? manualToggle : !!isActivelyThinking

  return (
    <div
      className={cn(
        "my-3 rounded-lg overflow-hidden",
        "border-l-2",
        isActivelyThinking ? "border-muted-foreground/40" : "border-muted-foreground/20",
        isActivelyThinking ? "bg-muted/60" : "bg-muted/30"
      )}
    >
      {/* 折叠/展开按钮 */}
      <button
        onClick={() => setManualToggle(manualToggle !== null ? !manualToggle : !expanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2",
          "text-[12px] text-muted-foreground hover:text-foreground",
          "transition-colors duration-150 cursor-pointer",
          "select-none"
        )}
      >
        {expanded ? (
          <ChevronDown size={14} className="flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="flex-shrink-0" />
        )}
        <span className="font-medium">
          {isActivelyThinking ? '正在思考...' : '思考过程'}
        </span>
        {isActivelyThinking && (
          <span className="ml-1 flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
            <span className="w-1 h-1 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
            <span className="w-1 h-1 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
          </span>
        )}
      </button>

      {/* 展开后的思考内容 */}
      {expanded && (
        <div
          className={cn(
            "px-4 pb-3 pt-0",
            "text-[12px] text-muted-foreground/70 leading-[1.7]",
            "markdown-body"
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
          {isActivelyThinking && (
            <span className="inline-block w-[2px] h-[1em] bg-muted-foreground/50 ml-0.5 align-middle animate-typing-cursor" />
          )}
        </div>
      )}
    </div>
  )
}

/** 工具名称到中文名称和图标的映射 */
const TOOL_INFO: Record<string, { label: string; icon: typeof Terminal }> = {
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
function getToolInfo(name: string): { label: string; Icon: typeof Terminal } {
  const info = TOOL_INFO[name]
  if (info) return { label: info.label, Icon: info.icon }
  // 以 mcp__ 开头的 MCP 工具
  if (name.startsWith('mcp__')) {
    const parts = name.split('__')
    return { label: `MCP: ${parts.slice(1).join('/')}`, Icon: Settings2 }
  }
  return { label: name, Icon: Wrench }
}

/** 工具调用和结果的解析结果类型 */
interface ToolUseParsed {
  id: string
  name: string
  input: string
}

interface ToolResultParsed {
  id: string
  content: string
}

/** 解析文本中的 <tool-use> 和 <tool-result> 标签
 *  返回分段：普通文本、工具调用、工具结果 */
function parseToolBlocks(content: string): Array<
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

/** 工具调用展示组件：显示工具名称、输入参数、执行结果 */
function ToolUseBlock({ toolUse, toolResult, isStreaming }: {
  toolUse: ToolUseParsed
  toolResult?: ToolResultParsed
  isStreaming?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const { label, Icon } = getToolInfo(toolUse.name)

  // 解析工具输入参数，提取关键信息作为摘要
  const inputSummary = useMemo(() => {
    try {
      const input = JSON.parse(toolUse.input)
      if (toolUse.name === 'Bash' && input.command) {
        return input.command.length > 80 ? input.command.substring(0, 80) + '...' : input.command
      }
      if ((toolUse.name === 'Read' || toolUse.name === 'Write' || toolUse.name === 'Edit' || toolUse.name === 'MultiEdit') && input.file_path) {
        return input.file_path
      }
      if (toolUse.name === 'LS' && input.path) {
        return input.path
      }
      if (toolUse.name === 'Grep' && input.pattern) {
        return `/${input.pattern}/` + (input.path ? ` in ${input.path}` : '')
      }
      if (toolUse.name === 'Glob' && input.pattern) {
        return input.pattern + (input.path ? ` in ${input.path}` : '')
      }
      // 默认：显示简短的 JSON
      const str = toolUse.input
      return str.length > 60 ? str.substring(0, 60) + '...' : str
    } catch {
      return toolUse.input.length > 60 ? toolUse.input.substring(0, 60) + '...' : toolUse.input
    }
  }, [toolUse.name, toolUse.input])

  // 判断工具是否还在执行中（有 tool-use 但还没有对应的 tool-result 且流式中）
  const isExecuting = !toolResult && isStreaming

  return (
    <div
      className={cn(
        "my-2 rounded-lg overflow-hidden border",
        "border-border bg-muted/30"
      )}
      role="region"
      aria-label={`工具调用: ${label}`}
    >
      {/* 头部：工具名称 + 摘要 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5",
          "text-[12px] transition-colors duration-150 cursor-pointer select-none",
          "text-muted-foreground hover:text-foreground"
        )}
      >
        {expanded ? (
          <ChevronDown size={13} className="flex-shrink-0" />
        ) : (
          <ChevronRight size={13} className="flex-shrink-0" />
        )}
        <Icon size={13} className="flex-shrink-0" />
        <span className="font-medium">{label}</span>
        {inputSummary && (
          <span className="text-muted-foreground/60 truncate text-[11px] font-mono ml-1">
            {inputSummary}
          </span>
        )}
        {isExecuting && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground/70">
            <Loader2 size={11} className="animate-spin" />
            <span>执行中</span>
          </span>
        )}
        {toolResult && (
          <span className="ml-auto flex items-center gap-1 text-muted-foreground/60 text-[11px]">
            <Check size={11} />
            <span>完成</span>
          </span>
        )}
      </button>

      {/* 展开后的详细内容 — 使用 ToolContentRenderer 富渲染 */}
      {expanded && (
        <div className="px-3 pb-2">
          <ToolContentRenderer
            toolName={toolUse.name}
            input={toolUse.input}
            result={toolResult?.content}
          />
        </div>
      )}
    </div>
  )
}

/** 获取进度类型的显示标签 */
function getProgressLabel(type: string, name: string): string {
  switch (type) {
    case 'mcp':
    case 'mcp_server':
      return `MCP: ${name || '连接中'}`
    case 'hook':
    case 'PostToolUse':
    case 'PreToolUse':
      return `Hook: ${name || type}`
    case 'agent':
    case 'subagent':
      return `Agent: ${name || '执行中'}`
    case 'tool':
      return `工具: ${name || '执行中'}`
    default:
      return name || type || '处理中'
  }
}

/** 任务进度指示条组件：显示当前正在执行的操作列表 */
function ProgressIndicator({ items }: { items: ProgressItem[] }) {
  if (items.length === 0) return null

  return (
    <div className={cn(
      "my-3 mx-0 rounded-lg overflow-hidden",
      "border border-border bg-muted/30",
      "animate-fade-in"
    )}>
      <div className="px-3 py-2 space-y-1">
        {items.map((item, i) => {
          const label = getProgressLabel(item.type, item.name)
          return (
            <div
              key={`${item.type}-${item.name}-${i}`}
              className="flex items-center gap-2 text-[12px] text-muted-foreground"
            >
              <Loader2 size={11} className="flex-shrink-0 animate-spin text-muted-foreground/60" />
              <span className="truncate">{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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

/** 代码块组件：带语言标签、复制按钮、折叠、全屏查看和 Shiki 语法高亮 */
function CodeBlock({ children, className, filePath, previousCode }: { children?: React.ReactNode; className?: string; filePath?: string; previousCode?: string }) {
  const { copied, copy } = useCopyToClipboard()
  // 用于"复制为引用"的独立状态
  const { copied: quoteCopied, copy: quoteCopy } = useCopyToClipboard()

  const codeString = String(children ?? '').replace(/\n$/, '')

  // 从 className 提取语言名称（格式为 language-xxx）
  const langMatch = className?.match(/language-(\w+)/)
  const language = langMatch ? langMatch[1] : null

  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)
  // 长代码折叠状态（每个实例独立）
  const [collapsed, setCollapsed] = useState(true)
  // 全屏查看状态
  const [fullscreen, setFullscreen] = useState(false)
  // Diff 视图状态（当有 previousCode 时可切换）
  const [showDiff, setShowDiff] = useState(false)
  const hasDiff = typeof previousCode === 'string'

  // 计算代码行数，判断是否需要折叠
  const lines = codeString.split('\n')
  const isLong = lines.length > 20
  const shouldCollapse = isLong && collapsed

  // Shiki 主题：使用 themeStore 中用户选择的代码高亮主题
  const shikiTheme = useThemeStore((s) => s.resolvedCodeTheme())

  useEffect(() => {
    if (!codeString || !language) return
    let cancelled = false
    codeToHtml(codeString, {
      lang: language,
      theme: shikiTheme,
    }).then((html) => {
      if (!cancelled) setHighlightedHtml(html)
    }).catch(() => {
      // 高亮失败时保持原始显示
    })
    return () => { cancelled = true }
  }, [codeString, language, shikiTheme])

  // 全屏时按 Escape 关闭
  useEffect(() => {
    if (!fullscreen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    // 全屏时禁止背景滚动
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [fullscreen])

  /** 复制代码 */
  const handleCopy = () => {
    copy(codeString)
    toast.success('已复制到剪贴板')
  }

  /** 复制为引用（带 ``` 围栏格式） */
  const handleCopyAsQuote = () => {
    const fenced = '```' + (language || '') + '\n' + codeString + '\n```'
    quoteCopy(fenced)
    toast.success('已复制为代码引用，可粘贴到输入框')
  }

  // 代码内容渲染（shiki 高亮或原始代码）
  const codeContent = highlightedHtml ? (
    <div
      className="shiki-wrapper"
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
    />
  ) : (
    <pre className={className}>
      <code className={className}>{children}</code>
    </pre>
  )

  return (
    <div className="relative group/code rounded-lg overflow-hidden border border-border" role="region" aria-label={`代码块${language ? ` (${language})` : ''}`}>
      {/* 顶部工具栏：语言标签 + 文件路径 + 操作按钮 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-card/50">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[11px] text-muted-foreground font-mono uppercase select-none flex-shrink-0">
            {language || 'text'}
          </span>
          {filePath && (
            <span className="text-[10px] text-muted-foreground/60 font-mono truncate" title={filePath}>
              {filePath}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* 查看 Diff 按钮（仅当有前一版本代码时显示） */}
          {hasDiff && (
            <Button
              variant={showDiff ? 'default' : 'ghost'}
              size="xs"
              onClick={() => setShowDiff(!showDiff)}
              className={cn(
                "text-[11px] h-5 px-1.5 gap-1",
                showDiff
                  ? ""
                  : "text-foreground opacity-0 group-hover/code:opacity-100 transition-all duration-150"
              )}
              title="查看文件变更对比"
            >
              <GitBranch size={11} />
              <span>{showDiff ? '隐藏 diff' : '查看 diff'}</span>
            </Button>
          )}
          {/* 复制为引用按钮 */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleCopyAsQuote}
            className={cn(
              "text-[11px] h-5 px-1.5",
              "text-foreground",
              "opacity-0 group-hover/code:opacity-100 transition-all duration-150"
            )}
            title="复制为代码引用（带 ``` 围栏）"
          >
            {quoteCopied ? (
              <Check size={11} className="text-[var(--color-success)]" />
            ) : (
              <ClipboardPaste size={11} />
            )}
          </Button>
          {/* 全屏查看按钮 */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setFullscreen(true)}
            className={cn(
              "text-[11px] h-5 px-1.5",
              "text-foreground",
              "opacity-0 group-hover/code:opacity-100 transition-all duration-150"
            )}
            title="全屏查看"
          >
            <Maximize2 size={11} />
          </Button>
          {/* 复制代码按钮 */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleCopy}
            className={cn(
              "text-[11px] h-5 px-1.5",
              "text-foreground",
              "opacity-0 group-hover/code:opacity-100 transition-all duration-150"
            )}
            title="复制代码"
          >
            {copied ? (
              <>
                <Check size={11} className="text-[var(--color-success)]" />
                <span className="text-[var(--color-success)]">已复制</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span>复制</span>
              </>
            )}
          </Button>
          {/* 保存代码片段按钮 */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              useSnippetStore.getState().addSnippet(codeString, language || 'text')
              toast.success('代码片段已保存')
            }}
            className={cn(
              "text-[11px] h-5 px-1.5",
              "text-foreground",
              "opacity-0 group-hover/code:opacity-100 transition-all duration-150"
            )}
            title="保存代码片段 (Ctrl+Shift+S 管理)"
          >
            <Download size={11} />
            <span>保存</span>
          </Button>
        </div>
      </div>

      {/* 代码内容区域（可折叠） */}
      <div
        className="relative"
        style={{
          maxHeight: shouldCollapse ? '320px' : 'none',
          overflow: 'hidden',
        }}
      >
        {codeContent}
        {/* 折叠时底部渐变遮罩 + 展开按钮 */}
        {shouldCollapse && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--color-code-bg,hsl(var(--card)))] to-transparent flex items-end justify-center pb-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setCollapsed(false)}
              className={cn(
                "text-[11px] gap-1",
                "text-foreground",
                "border border-border bg-card/80 backdrop-blur-sm"
              )}
            >
              <ChevronDown size={11} />
              <span>展开全部 ({lines.length} 行)</span>
            </Button>
          </div>
        )}
      </div>

      {/* 展开后的折叠按钮 */}
      {!collapsed && isLong && (
        <div className="flex justify-center border-t border-border/50 bg-card/30">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setCollapsed(true)}
            className={cn(
              "w-full text-[11px] gap-1 rounded-none",
              "text-foreground"
            )}
          >
            <ChevronUp size={11} />
            <span>折叠代码</span>
          </Button>
        </div>
      )}

      {/* 内联 Diff 视图（当有 previousCode 且用户点击"查看 diff"时显示） */}
      {showDiff && hasDiff && (
        <InlineDiffView originalCode={previousCode!} modifiedCode={codeString} />
      )}

      {/* 全屏查看 overlay */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col"
          onClick={() => setFullscreen(false)}
        >
          {/* 全屏顶部工具栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
            <span className="text-sm font-mono text-muted-foreground uppercase">
              {language || 'text'}
              {filePath && (
                <span className="ml-2 text-[11px] text-muted-foreground normal-case font-mono">{filePath}</span>
              )}
              <span className="ml-3 text-[11px] text-muted-foreground normal-case">
                {lines.length} 行
              </span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleCopy() }}
                className="text-[12px] text-foreground"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-[var(--color-success)]" />
                    <span className="text-[var(--color-success)]">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>复制代码</span>
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleCopyAsQuote() }}
                className="text-[12px] text-foreground"
              >
                {quoteCopied ? (
                  <>
                    <Check size={13} className="text-[var(--color-success)]" />
                    <span className="text-[var(--color-success)]">已复制</span>
                  </>
                ) : (
                  <>
                    <ClipboardPaste size={13} />
                    <span>复制引用</span>
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setFullscreen(false) }}
                className="text-[12px] text-foreground"
              >
                <X size={13} />
                <span>关闭</span>
              </Button>
            </div>
          </div>
          {/* 全屏代码内容 */}
          <div
            className="flex-1 overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {highlightedHtml ? (
              <div
                className="shiki-wrapper"
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            ) : (
              <pre className={cn(className, "text-[13px]")}>
                <code className={className}>{children}</code>
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** 内联 Diff 视图组件：紧凑地显示在代码块下方，绿色=新增，红色=删除 */
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

/** 版本历史面板：展示消息的所有历史版本，支持预览、恢复和对比 */
function VersionHistoryPanel({
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

/** 消息悬浮操作栏 */
function MessageActions({
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
  onToggleFavorite,
  isFavorited,
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
  onToggleFavorite?: () => void
  isFavorited?: boolean
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
          .replace(/^[-*]\s/gm, '• ')
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

        {/* 跨会话收藏按钮（星标） */}
        {onToggleFavorite && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  onToggleFavorite()
                  toast.success(isFavorited ? '已取消星标收藏' : '已添加到收藏夹')
                }}
                className="text-foreground h-6 w-6"
              >
                <Star size={12} className={isFavorited ? 'fill-yellow-400 text-yellow-400' : ''} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{isFavorited ? '取消星标收藏' : '添加到收藏夹'}</TooltipContent>
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

/** Token 用量显示徽章 */
function TokenUsageBadge({ inputTokens, outputTokens }: { inputTokens: number; outputTokens: number }) {
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

/** 消息反馈按钮（点赞/踩） */
function FeedbackButtons({ sessionId, message }: { sessionId: string; message: Message }) {
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

/** Emoji 反应组件：显示已有反应 + 悬浮快捷 emoji + 更多 emoji 面板 */
const QUICK_EMOJIS = ['👍', '👎', '❤️', '🎉', '🤔', '👀']
/** 更多 emoji 面板：12 个常用 emoji（含快捷列表中未出现的） */
const MORE_EMOJIS = ['👍', '👎', '❤️', '🎉', '🤔', '👀', '😂', '🔥', '💯', '👏', '😍', '🙏']

function MessageReactions({ sessionId, message }: { sessionId: string; message: Message }) {
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

/**
 * 助手消息底部快捷操作栏
 * 仅在 hover 或消息完成后显示，不在流式时显示
 */
function AssistantQuickActions({
  message,
  onContinueInNewChat,
}: {
  message: Message
  onContinueInNewChat: (message: Message) => void
}) {
  const [copiedNote, setCopiedNote] = useState(false)
  const [copiedShareLink, setCopiedShareLink] = useState(false)

  /** "生成分享链接" — 生成 data URL 并复制到剪贴板 */
  const handleCopyShareLink = useCallback(async () => {
    const success = await copyShareLink({
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
    })
    if (success) {
      setCopiedShareLink(true)
      toast.success('分享链接已复制到剪贴板')
      setTimeout(() => setCopiedShareLink(false), 2000)
    } else {
      toast.error('复制分享链接失败')
    }
  }, [message])

  /** "保存为笔记" — 复制到剪贴板 + toast */
  const handleSaveAsNote = useCallback(() => {
    const noteText = `# 笔记\n\n> 来自 Claude 的回复\n> ${new Date(message.timestamp).toLocaleString('zh-CN')}\n\n${message.content}`
    navigator.clipboard.writeText(noteText).then(() => {
      setCopiedNote(true)
      toast.success('已复制为笔记到剪贴板')
      setTimeout(() => setCopiedNote(false), 2000)
    }).catch(() => {
      toast.error('复制失败')
    })
  }, [message])

  /** "分享" — 生成自包含 HTML 并下载 */
  const handleShare = useCallback(() => {
    const escapedContent = message.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude 回复分享</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0a0a0a; color: #e5e5e5;
    display: flex; justify-content: center; padding: 40px 20px;
    min-height: 100vh;
  }
  .container { max-width: 720px; width: 100%; }
  .header {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 24px; padding-bottom: 16px;
    border-bottom: 1px solid #333;
  }
  .avatar {
    width: 32px; height: 32px; border-radius: 10px;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    display: flex; align-items: center; justify-content: center;
    color: white; font-weight: bold; font-size: 14px;
  }
  .meta { font-size: 12px; color: #888; }
  .content {
    font-size: 14px; line-height: 1.75;
    white-space: pre-wrap; word-break: break-word;
  }
  .content code {
    background: #1a1a2e; padding: 2px 6px; border-radius: 4px;
    font-family: 'Fira Code', monospace; font-size: 13px;
  }
  .content pre {
    background: #1a1a2e; padding: 16px; border-radius: 8px;
    overflow-x: auto; margin: 12px 0;
  }
  .content pre code { background: none; padding: 0; }
  .footer {
    margin-top: 32px; padding-top: 16px;
    border-top: 1px solid #333;
    font-size: 11px; color: #666; text-align: center;
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="avatar">C</div>
    <div>
      <div style="font-weight:600;font-size:14px">Claude</div>
      <div class="meta">${new Date(message.timestamp).toLocaleString('zh-CN')}</div>
    </div>
  </div>
  <div class="content">${escapedContent}</div>
  <div class="footer">
    通过 Claude Code Chat 分享
  </div>
</div>
</body>
</html>`

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `claude-reply-${new Date(message.timestamp).toISOString().slice(0, 10)}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('已下载分享 HTML')
  }, [message])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150">
        {/* 在新对话中继续 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onContinueInNewChat(message)}
              className="text-[11px] gap-1 text-foreground h-6 px-2"
            >
              <MessageCirclePlus size={12} />
              <span>在新对话中继续</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[11px]">
            创建新会话并引用此消息
          </TooltipContent>
        </Tooltip>

        {/* 保存为笔记 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleSaveAsNote}
              className="text-[11px] gap-1 text-foreground h-6 px-2"
            >
              {copiedNote ? (
                <Check size={12} className="text-[var(--color-success)]" />
              ) : (
                <StickyNote size={12} />
              )}
              <span>{copiedNote ? '已复制' : '保存为笔记'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[11px]">
            复制为笔记格式到剪贴板
          </TooltipContent>
        </Tooltip>

        {/* 生成分享链接 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleCopyShareLink}
              className="text-[11px] gap-1 text-foreground h-6 px-2"
            >
              {copiedShareLink ? (
                <Check size={12} className="text-[var(--color-success)]" />
              ) : (
                <Link2 size={12} />
              )}
              <span>{copiedShareLink ? '已复制' : '分享链接'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[11px]">
            生成分享链接并复制到剪贴板
          </TooltipContent>
        </Tooltip>

        {/* 分享 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleShare}
              className="text-[11px] gap-1 text-foreground h-6 px-2"
            >
              <Share2 size={12} />
              <span>分享</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[11px]">
            下载为自包含 HTML 页面
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

/**
 * 流式输出速度指示器：实时显示 AI 回复的字符增长速率
 * 仅在 msg.isStreaming 时渲染，每 500ms 采样一次计算速率
 */
function StreamingSpeedIndicator({ content }: { content: string }) {
  const [speed, setSpeed] = useState(0)
  const prevRef = useRef({ length: 0, time: Date.now() })

  useEffect(() => {
    // 重置采样基线
    prevRef.current = { length: content.length, time: Date.now() }
  }, []) // 仅初始化一次

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = (now - prevRef.current.time) / 1000
      if (elapsed > 0) {
        const chars = content.length - prevRef.current.length
        const rate = Math.round(chars / elapsed)
        setSpeed(rate > 0 ? rate : 0)
        prevRef.current = { length: content.length, time: now }
      }
    }, 500)
    return () => clearInterval(interval)
  }, [content])

  if (speed <= 0) return null

  return (
    <span className="inline-flex items-center gap-1 ml-2 text-[10px] text-primary/50 select-none animate-fade-in">
      <Zap size={9} />
      <span>{speed} 字/秒</span>
    </span>
  )
}

/**
 * 去除 Markdown 语法，返回纯文本（用于 TTS 朗读）
 * 依次去除：代码块、行内代码、粗体、斜体、链接、图片、标题标记、列表符号、水平线、HTML标签、thinking标签
 */
function stripMarkdown(md: string): string {
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

/**
 * 检测文本的主要语言：中文还是英文
 * 返回 'zh-CN' 或 'en-US'
 */
function detectLanguage(text: string): string {
  // 计算中文字符数量
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  // 计算英文单词数量（粗略估计）
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  // 如果中文字符占比较高，返回中文
  // 每个中文字大致等于一个英文单词
  return chineseChars >= englishWords ? 'zh-CN' : 'en-US'
}

/**
 * 根据助手消息内容生成上下文相关的快捷回复
 * 分析内容特征（代码块、错误信息、列表、长度等），返回 2-3 个智能建议
 */
function generateQuickReplies(content: string): string[] {
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
function generateSuggestions(content: string): string[] {
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

/** 建议操作芯片组件：在助手回复完成后显示后续操作按钮 */
function SuggestionChips({
  suggestions,
  onSelect,
}: {
  suggestions: string[]
  onSelect: (text: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-3 ml-10 animate-fade-in">
      {suggestions.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onSelect(text)}
          className={cn(
            "inline-flex items-center gap-1.5",
            "text-[12px] rounded-full px-3 py-1",
            "border border-border",
            "text-muted-foreground",
            "hover:border-primary/50 hover:bg-primary/5",
            "transition-all duration-150 cursor-pointer",
            "active:scale-95"
          )}
        >
          <Sparkles size={12} className="opacity-50" />
          <span>{text}</span>
        </button>
      ))}
    </div>
  )
}

/** 固定消息横条组件：在消息列表顶部显示所有已固定的消息摘要 */
function PinnedMessages({
  messages,
  onScrollToMessage,
  onUnpin,
}: {
  messages: Message[]
  onScrollToMessage: (msgId: string) => void
  onUnpin: (msgId: string) => void
}) {
  const pinnedMessages = messages.filter((m) => m.pinned)
  const [expanded, setExpanded] = useState(() => pinnedMessages.length <= 2)

  if (pinnedMessages.length === 0) return null

  /** 截断消息内容到指定字符数 */
  const truncate = (text: string, maxLen: number = 50) => {
    // 去除 Markdown 语法和换行，提取纯文本摘要
    const plain = text
      .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
      .replace(/```[\s\S]*?```/g, '[代码]')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^#+\s/gm, '')
      .replace(/\n+/g, ' ')
      .trim()
    return plain.length > maxLen ? plain.slice(0, maxLen) + '...' : plain
  }

  return (
    <div className="border-b border-border bg-card/50 backdrop-blur-sm">
      {/* 标题栏：固定消息数 + 折叠/展开按钮 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-1.5 text-[11px] text-foreground transition-colors cursor-pointer select-none"
      >
        <Pin size={11} className="text-blue-400/80 flex-shrink-0" />
        <span className="font-medium">固定消息</span>
        <span className="text-[10px] text-muted-foreground">({pinnedMessages.length})</span>
        <div className="flex-1" />
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {/* 展开后的固定消息列表 */}
      {expanded && (
        <div className="px-2 pb-1.5 space-y-0.5 animate-fade-in">
          {pinnedMessages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent/50 transition-colors group/pin"
            >
              {/* 角色标识 */}
              <span className={cn(
                "flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded",
                msg.role === 'user'
                  ? "bg-primary/10 text-primary"
                  : "bg-gradient-to-r from-[var(--color-gradient-start)]/10 to-[var(--color-gradient-end)]/10 text-[var(--color-gradient-end)]"
              )}>
                {msg.role === 'user' ? '用户' : 'AI'}
              </span>

              {/* 消息摘要（可点击跳转） */}
              <button
                onClick={() => onScrollToMessage(msg.id)}
                className="flex-1 text-left text-[12px] text-foreground truncate cursor-pointer transition-colors"
                title="点击跳转到原始消息"
              >
                {truncate(msg.content)}
              </button>

              {/* 取消固定按钮 */}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  onUnpin(msg.id)
                  toast.success('已取消固定')
                }}
                className="flex-shrink-0 h-5 w-5 text-foreground/50 opacity-0 group-hover/pin:opacity-100 transition-opacity"
                title="取消固定"
              >
                <PinOff size={10} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 右键上下文菜单属性 */
interface ContextMenuProps {
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
  onToggleFavorite?: () => void
  isFavorited?: boolean
}

/** 右键上下文菜单组件 */
function ContextMenu({ x, y, message, onClose, onCopy, onEdit, onRegenerate, onFork, onCopyLink, onQuote, onBookmark, isBookmarked, onSaveToKnowledge, onPin, isPinned, onSelectMode, onSpeak, isSpeaking, onTranslate, isTranslating, onToggleFavorite, isFavorited }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // 调整位置避免超出视口
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${window.innerWidth - rect.width - 8}px`
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${window.innerHeight - rect.height - 8}px`
    }
  }, [])

  // 点击外部关闭
  useEffect(() => {
    const handler = () => onClose()
    document.addEventListener('click', handler)
    document.addEventListener('contextmenu', handler)
    return () => {
      document.removeEventListener('click', handler)
      document.removeEventListener('contextmenu', handler)
    }
  }, [onClose])

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const items = [
    { label: '复制文本', icon: Copy, onClick: onCopy },
    onQuote ? { label: '引用回复', icon: MessageSquareQuote, onClick: onQuote } : null,
    message.role === 'user' && onEdit ? { label: '编辑消息', icon: Pencil, onClick: onEdit } : null,
    message.role === 'assistant' && onRegenerate ? { label: '重新生成', icon: RefreshCw, onClick: onRegenerate } : null,
    onFork ? { label: '从此处分叉', icon: GitBranch, onClick: onFork } : null,
    onCopyLink ? { label: '复制消息链接', icon: Link2, onClick: onCopyLink } : null,
    onBookmark ? { label: isBookmarked ? '取消收藏' : '收藏消息', icon: Bookmark, onClick: onBookmark } : null,
    onToggleFavorite ? { label: isFavorited ? '取消星标收藏' : '添加到收藏夹', icon: Star, onClick: onToggleFavorite } : null,
    message.role === 'assistant' && onSaveToKnowledge ? { label: '保存到知识库', icon: BookOpen, onClick: onSaveToKnowledge } : null,
    onPin ? { label: isPinned ? '取消固定' : '固定消息', icon: isPinned ? PinOff : Pin, onClick: onPin } : null,
    onSpeak ? { label: isSpeaking ? '停止朗读' : '朗读消息', icon: isSpeaking ? Square : Volume2, onClick: onSpeak } : null,
    onTranslate ? { label: isTranslating ? '翻译中...' : '翻译消息', icon: Languages, onClick: onTranslate } : null,
    onSelectMode ? { label: '选择消息', icon: CheckSquare, onClick: onSelectMode } : null,
  ].filter(Boolean) as Array<{ label: string; icon: typeof Copy; onClick: () => void }>

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] min-w-[160px] rounded-lg border border-border bg-popover shadow-xl py-1 animate-fade-in"
      style={{ left: x, top: y }}
      onClick={e => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-accent transition-colors"
          onClick={() => { item.onClick(); onClose() }}
        >
          <item.icon size={14} className="text-muted-foreground" />
          {item.label}
        </button>
      ))}
    </div>
  )
}

/** 消息分组信息：用于折叠较早的消息 */
interface MessageGroup {
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

/** 格式化分组折叠条的时间范围文本 */
function formatGroupTimeRange(startTs: number, endTs: number): string {
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

/** 消息分组折叠条组件 */
function MessageGroupCollapse({
  group,
  collapsed,
  onToggle,
}: {
  group: MessageGroup
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <div className="my-3 select-none">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-center gap-2 px-4 py-2",
          "rounded-lg",
          "bg-muted/50 hover:bg-muted/80",
          "border border-border/50 hover:border-border",
          "text-[12px] text-foreground",
          "transition-all duration-200 cursor-pointer",
          "group/collapse"
        )}
      >
        {collapsed ? (
          <ChevronRight size={14} className="flex-shrink-0 transition-transform duration-200" />
        ) : (
          <ChevronDown size={14} className="flex-shrink-0 transition-transform duration-200" />
        )}
        <span>
          {collapsed ? '显示' : '隐藏'} {group.count} 条消息
        </span>
        <span className="text-[11px] text-muted-foreground">
          ({formatGroupTimeRange(group.startTime, group.endTime)})
        </span>
        <ChevronsUpDown size={12} className="opacity-0 group-hover/collapse:opacity-40 transition-opacity ml-1" />
      </button>
    </div>
  )
}

export default function MessageList({ messages, highlightedMessageId, searchQuery, activeProgress, selectMode: selectModeProp, onSelectModeChange, onSuggestionClick, onEditMessage, onRegenerateMessage, onForkFromMessage, onQuoteMessage }: MessageListProps) {
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const allSessions = useSessionStore((s) => s.sessions)
  const createSession = useSessionStore((s) => s.createSession)
  const addMessage = useSessionStore((s) => s.addMessage)

  // 当前会话的工作目录
  const currentWorkingDir = useMemo(() => {
    if (!activeSessionId) return undefined
    return allSessions.find(s => s.id === activeSessionId)?.workingDirectory
  }, [activeSessionId, allSessions])

  // 最近使用过的项目目录（按最新使用时间排序，最多 6 个）
  const recentProjects = useMemo(() => {
    const projectMap = new Map<string, number>()
    for (const s of allSessions) {
      if (s.workingDirectory) {
        const existing = projectMap.get(s.workingDirectory)
        if (!existing || s.createdAt > existing) {
          projectMap.set(s.workingDirectory, s.createdAt)
        }
      }
    }
    return Array.from(projectMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([path]) => path)
  }, [allSessions])
  const navigate = useNavigate()
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  // 右键上下文菜单状态
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: Message } | null>(null)

  // 翻译状态管理
  const [translatedMessages, setTranslatedMessages] = useState<Map<string, { text: string; lang: string }>>(new Map())
  const [translatingMsgId, setTranslatingMsgId] = useState<string | null>(null)

  // 保存到知识库对话框状态
  const [knowledgeDialogMsg, setKnowledgeDialogMsg] = useState<Message | null>(null)

  /** "在新对话中继续" — 创建新会话并引入消息作为上下文 */
  const handleContinueInNewChat = useCallback((message: Message) => {
    const newSession = createSession()
    // Add the assistant message as context
    addMessage(newSession.id, {
      role: 'assistant',
      content: message.content,
      isStreaming: false,
    })
    toast.success('已创建新对话')
    navigate(`/chat/${newSession.id}`)
  }, [createSession, addMessage, navigate])

  /** 复制消息锚点链接到剪贴板并更新 URL hash */
  const handleCopyLink = useCallback((msgId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#msg-${msgId}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('已复制消息链接')
    }).catch(() => {
      toast.error('复制失败')
    })
    window.location.hash = '#msg-' + msgId
  }, [])

  /** 滚动到指定消息并高亮 — 基础版本（不处理分组折叠，后面会增强） */
  const scrollToMessageElement = useCallback((msgId: string) => {
    const el = document.querySelector(`[data-message-id="${msgId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 添加短暂高亮效果
      el.classList.add('ring-2', 'ring-primary/50')
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-primary/50')
      }, 2000)
    }
  }, [])

  /** 切换消息固定状态 */
  const handleTogglePinMessage = useCallback((msgId: string) => {
    const sid = useSessionStore.getState().activeSessionId
    if (sid) {
      useSessionStore.getState().togglePinMessage(sid, msgId)
    }
  }, [])

  /** 切换消息星标收藏（跨会话收藏夹） */
  const handleToggleFavorite = useCallback((msg: Message) => {
    const store = useFavoritesStore.getState()
    if (store.isFavorited(msg.id)) {
      store.removeFavoriteByMessageId(msg.id)
    } else {
      const sid = useSessionStore.getState().activeSessionId
      const session = useSessionStore.getState().sessions.find(s => s.id === sid)
      store.addFavorite({
        messageId: msg.id,
        sessionId: sid || '',
        sessionName: session?.title || '未知会话',
        role: msg.role,
        content: msg.content,
        category: 'uncategorized',
      })
    }
  }, [])

  /** 翻译消息内容 */
  const handleTranslate = useCallback(async (msgId: string, content: string) => {
    // 如果已经翻译过，切换显示/隐藏
    if (translatedMessages.has(msgId)) {
      setTranslatedMessages(prev => {
        const next = new Map(prev)
        next.delete(msgId)
        return next
      })
      return
    }

    // 检测语言并确定目标语言
    const lang = detectLanguage(content)
    const targetLang = lang === 'zh-CN' ? 'English' : '中文'

    setTranslatingMsgId(msgId)

    try {
      const response = await fetch('/api/translate/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, targetLang }),
      })

      if (!response.ok) {
        throw new Error('Translation failed')
      }

      const data = await response.json()
      setTranslatedMessages(prev => {
        const next = new Map(prev)
        next.set(msgId, { text: data.translation, lang: targetLang })
        return next
      })
      toast.success('翻译完成')
    } catch {
      toast.error('翻译失败，请稍后重试')
    } finally {
      setTranslatingMsgId(null)
    }
  }, [translatedMessages])

  // TTS 朗读状态：当前正在朗读的消息 ID
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null)
  // 图片预览灯箱状态
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  // 用 ref 持有当前 utterance 实例，便于在回调中取消
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  /** 朗读/停止朗读消息 */
  const handleSpeak = useCallback((msgId: string, content: string) => {
    // 如果正在朗读同一条消息，停止朗读
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel()
      utteranceRef.current = null
      setSpeakingMsgId(null)
      return
    }

    // 停止之前的朗读（如果有）
    window.speechSynthesis.cancel()
    utteranceRef.current = null

    // 去除 Markdown 语法，获取纯文本
    const plainText = stripMarkdown(content)
    if (!plainText) {
      toast.error('没有可朗读的内容')
      return
    }

    // 创建朗读实例
    const utterance = new SpeechSynthesisUtterance(plainText)
    utterance.lang = detectLanguage(plainText)
    utterance.rate = 1
    utterance.pitch = 1

    // 朗读完成时重置状态
    utterance.onend = () => {
      utteranceRef.current = null
      setSpeakingMsgId(null)
    }

    // 朗读出错时重置状态
    utterance.onerror = (e) => {
      // 用户手动取消时不显示错误
      if (e.error !== 'canceled') {
        toast.error('朗读失败: ' + e.error)
      }
      utteranceRef.current = null
      setSpeakingMsgId(null)
    }

    utteranceRef.current = utterance
    setSpeakingMsgId(msgId)
    window.speechSynthesis.speak(utterance)
  }, [speakingMsgId])

  // 组件卸载时停止朗读
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  // 多选模式状态（支持外部受控）
  const [selectModeInternal, setSelectModeInternal] = useState(false)
  const selectMode = selectModeProp !== undefined ? selectModeProp : selectModeInternal
  const setSelectMode = useCallback((v: boolean) => {
    setSelectModeInternal(v)
    onSelectModeChange?.(v)
  }, [onSelectModeChange])
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set())

  // 拖拽重排状态（仅在多选模式下启用）
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  /** 切换单条消息的选中状态 */
  const toggleMsgSelect = useCallback((msgId: string) => {
    setSelectedMsgIds(prev => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }, [])

  /** 退出选择模式并清空选中 */
  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedMsgIds(new Set())
  }, [])

  /** 进入选择模式（可选预选一条消息） */
  const enterSelectMode = useCallback((preSelectId?: string) => {
    setSelectMode(true)
    if (preSelectId) {
      setSelectedMsgIds(new Set([preSelectId]))
    }
  }, [])

  /** 批量复制选中消息 */
  const handleBatchCopy = useCallback(() => {
    const selectedMessages = messages.filter(m => selectedMsgIds.has(m.id))
    const text = selectedMessages.map(m => {
      const role = m.role === 'user' ? '用户' : 'Claude'
      return `${role}:\n${m.content}`
    }).join('\n\n---\n\n')
    navigator.clipboard.writeText(text)
    toast.success(`已复制 ${selectedMessages.length} 条消息`)
    exitSelectMode()
  }, [messages, selectedMsgIds, exitSelectMode])

  /** 批量收藏选中消息 */
  const handleBatchBookmark = useCallback(() => {
    const sid = useSessionStore.getState().activeSessionId
    if (!sid) return
    selectedMsgIds.forEach(msgId => {
      useSessionStore.getState().toggleMessageBookmark(sid, msgId)
    })
    toast.success(`已切换 ${selectedMsgIds.size} 条消息的收藏状态`)
    exitSelectMode()
  }, [selectedMsgIds, exitSelectMode])

  /** 拖拽开始：记录被拖拽的消息索引 */
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }, [])

  /** 拖拽经过：更新放置指示线位置 */
  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(idx)
  }, [])

  /** 拖拽结束：清除拖拽状态 */
  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  /** 放置：调用 reorderMessages 更新消息顺序 */
  const handleDrop = useCallback((e: React.DragEvent, toIdx: number) => {
    e.preventDefault()
    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (!isNaN(fromIdx) && fromIdx !== toIdx) {
      const sid = useSessionStore.getState().activeSessionId
      if (sid) {
        useSessionStore.getState().reorderMessages(sid, fromIdx, toIdx)
        toast.success('消息顺序已更新')
      }
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  // ====== 消息分组折叠逻辑 ======
  // 折叠的分组索引集合（默认所有分组都折叠）
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())

  // 消息分组计算：当消息数 > 20 时，将较早的消息按每 10 条分为一组
  const messageGroups = useMemo<MessageGroup[]>(() => {
    const GROUP_SIZE = 10
    const MIN_TOTAL = 20
    const KEEP_RECENT = 10

    if (messages.length <= MIN_TOTAL) return []

    const groupableCount = messages.length - KEEP_RECENT
    if (groupableCount <= 0) return []

    const groups: MessageGroup[] = []
    let startIdx = 0

    while (startIdx < groupableCount) {
      const endIdx = Math.min(startIdx + GROUP_SIZE, groupableCount)
      const groupMsgs = messages.slice(startIdx, endIdx)
      groups.push({
        groupIndex: groups.length,
        startIdx,
        endIdx,
        count: endIdx - startIdx,
        startTime: groupMsgs[0].timestamp,
        endTime: groupMsgs[groupMsgs.length - 1].timestamp,
      })
      startIdx = endIdx
    }

    return groups
  }, [messages])

  // 当分组变化时（消息增长导致新分组出现），新分组默认折叠
  const prevGroupCountRef = useRef(0)
  useEffect(() => {
    if (messageGroups.length > prevGroupCountRef.current) {
      // 有新分组产生，将新分组设为折叠
      setCollapsedGroups(prev => {
        const next = new Set(prev)
        for (let i = prevGroupCountRef.current; i < messageGroups.length; i++) {
          next.add(i)
        }
        return next
      })
    }
    prevGroupCountRef.current = messageGroups.length
  }, [messageGroups.length])

  // 构建消息索引到分组的映射（用于快速查找）
  const msgIdxToGroup = useMemo(() => {
    const map = new Map<number, MessageGroup>()
    for (const group of messageGroups) {
      for (let i = group.startIdx; i < group.endIdx; i++) {
        map.set(i, group)
      }
    }
    return map
  }, [messageGroups])

  /** 切换分组的折叠/展开状态 */
  const toggleGroupCollapse = useCallback((groupIndex: number) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupIndex)) {
        next.delete(groupIndex)
      } else {
        next.add(groupIndex)
      }
      return next
    })
  }, [])

  // 当搜索高亮消息属于某个折叠组时，自动展开该组
  useEffect(() => {
    if (!highlightedMessageId) return
    const highlightIdx = messages.findIndex(m => m.id === highlightedMessageId)
    if (highlightIdx === -1) return
    const group = msgIdxToGroup.get(highlightIdx)
    if (group && collapsedGroups.has(group.groupIndex)) {
      setCollapsedGroups(prev => {
        const next = new Set(prev)
        next.delete(group.groupIndex)
        return next
      })
    }
  }, [highlightedMessageId, messages, msgIdxToGroup, collapsedGroups])

  /** 滚动到指定消息并高亮（增强版：如果消息在折叠组内，先展开该组） */
  const handleScrollToMessage = useCallback((msgId: string) => {
    const msgIdx = messages.findIndex(m => m.id === msgId)
    if (msgIdx !== -1) {
      const group = msgIdxToGroup.get(msgIdx)
      if (group && collapsedGroups.has(group.groupIndex)) {
        setCollapsedGroups(prev => {
          const next = new Set(prev)
          next.delete(group.groupIndex)
          return next
        })
        // 展开后等待一帧让 DOM 更新再滚动
        requestAnimationFrame(() => {
          scrollToMessageElement(msgId)
        })
        return
      }
    }
    scrollToMessageElement(msgId)
  }, [messages, msgIdxToGroup, collapsedGroups, scrollToMessageElement])

  // 滚动状态：是否在底部、是否显示滚动按钮
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  // 滚动进度（0-100），用于顶部进度条显示
  const [scrollProgress, setScrollProgress] = useState(0)
  // 未读消息计数：用户不在底部时累计新消息数
  const [unreadCount, setUnreadCount] = useState(0)
  // 用 ref 追踪"用户是否在底部"，避免闭包陈旧值问题
  const isAtBottomRef = useRef(true)
  // 记录上一次消息数量，用于计算新增消息
  const prevMsgCountRef = useRef(messages.length)

  /** 判断滚动容器是否在底部（允许 150px 误差） */
  const checkIsAtBottom = useCallback((el: HTMLElement) => {
    const threshold = 150
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
  }, [])

  /** 获取 ScrollArea 内部真正的滚动视口元素 */
  const getViewport = useCallback(() => {
    return scrollAreaRef.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]'
    )
  }, [])

  /** 平滑滚动到底部，同时清除未读计数 */
  const scrollToBottom = useCallback(() => {
    const viewport = getViewport()
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
    }
    setUnreadCount(0)
  }, [getViewport])

  // 监听滚动事件，更新"是否在底部"状态
  useEffect(() => {
    const viewport = getViewport()
    if (!viewport) return

    const handleScroll = () => {
      const atBottom = checkIsAtBottom(viewport)
      isAtBottomRef.current = atBottom
      setShowScrollBtn(!atBottom)
      // 计算滚动进度（0-100）
      const maxScroll = viewport.scrollHeight - viewport.clientHeight
      if (maxScroll > 0) {
        const progress = (viewport.scrollTop / maxScroll) * 100
        setScrollProgress(Math.min(100, Math.max(0, progress)))
      } else {
        setScrollProgress(0)
      }
      // 滚动回底部时清除未读计数
      if (atBottom) {
        setUnreadCount(0)
      }
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    // 初始检查一次
    handleScroll()

    return () => {
      viewport.removeEventListener('scroll', handleScroll)
    }
  }, [getViewport, checkIsAtBottom, messages.length === 0])

  // 消息数量变化时：累计未读计数（仅当用户不在底部时）
  useEffect(() => {
    const currentCount = messages.length
    const prevCount = prevMsgCountRef.current
    if (currentCount > prevCount && !isAtBottomRef.current) {
      // 只统计新增的 assistant 消息（过滤掉用户自己发的）
      const newMessages = messages.slice(prevCount)
      const newAssistantCount = newMessages.filter(m => m.role === 'assistant').length
      if (newAssistantCount > 0) {
        setUnreadCount(prev => prev + newAssistantCount)
      }
    }
    prevMsgCountRef.current = currentCount
  }, [messages])

  // 消息更新时：如果用户在底部，自动滚动到底部
  useEffect(() => {
    if (isAtBottomRef.current) {
      // 用 requestAnimationFrame 等待 DOM 更新后再滚动
      requestAnimationFrame(() => {
        const viewport = getViewport()
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight
        }
      })
    }
  }, [messages, getViewport])

  // 高亮消息滚动到视图
  useEffect(() => {
    if (!highlightedMessageId) return
    const el = document.querySelector(`[data-message-id="${highlightedMessageId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedMessageId])

  // 进入编辑模式时自动聚焦并调整高度
  useEffect(() => {
    if (editingId && editTextareaRef.current) {
      const ta = editTextareaRef.current
      ta.focus()
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
      // 光标移到末尾
      ta.setSelectionRange(ta.value.length, ta.value.length)
    }
  }, [editingId])

  const handleStartEdit = (msgId: string, content: string) => {
    setEditingId(msgId)
    setEditContent(content)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  const handleSaveEdit = () => {
    if (editingId && editContent.trim() && onEditMessage) {
      onEditMessage(editingId, editContent.trim())
    }
    setEditingId(null)
    setEditContent('')
  }

  /** 基础 markdownComponents（不含文件路径 diff 跟踪，用于 thinking 块等） */
  const markdownComponents: Components = {
    pre({ children }) {
      const codeChild = Array.isArray(children) ? children[0] : children
      if (
        codeChild &&
        typeof codeChild === 'object' &&
        'props' in codeChild
      ) {
        const { children: codeChildren, className } = (codeChild as React.ReactElement<{ children?: React.ReactNode; className?: string }>).props
        // 检测 mermaid 代码块，使用 MermaidBlock 渲染图表
        const langMatch = className?.match(/language-(\w+)/)
        if (langMatch && langMatch[1] === 'mermaid') {
          const code = String(codeChildren ?? '').replace(/\n$/, '')
          return <MermaidBlock code={code} />
        }
        return <CodeBlock className={className}>{codeChildren}</CodeBlock>
      }
      return <pre>{children}</pre>
    },
  }

  /**
   * 从消息内容中预扫描带文件路径的代码块，构建 diff 映射。
   * 当同一文件路径出现多个代码块时，第 2 个及之后的代码块可以与前一个做 diff 对比。
   * 返回 Map<key, previousCode>，其中 key = "filePath::blockIndex"（block 在该文件中的序号）
   */
  const buildCodeBlockDiffMap = useCallback((content: string): Map<string, string> => {
    const diffMap = new Map<string, string>()
    // 匹配所有围栏代码块：```lang:filepath\n...code...\n```
    const codeBlockRegex = /```(\w+):([^\n]+)\n([\s\S]*?)```/g
    // 按文件路径分组：记录每个文件的所有代码块内容
    const fileBlocks = new Map<string, string[]>()
    let match: RegExpExecArray | null

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const filePath = match[2].trim()
      const code = match[3].replace(/\n$/, '')
      if (!fileBlocks.has(filePath)) {
        fileBlocks.set(filePath, [])
      }
      fileBlocks.get(filePath)!.push(code)
    }

    // 构建 diff 映射：第 2 个及之后的代码块指向前一个代码块
    for (const [filePath, blocks] of fileBlocks) {
      for (let i = 1; i < blocks.length; i++) {
        // key 格式: "filePath::blockIndex"（全局代码块序号需要另计算，这里用文件内序号）
        diffMap.set(`${filePath}::${i}`, blocks[i - 1])
      }
    }

    return diffMap
  }, [])

  /**
   * 创建支持文件路径 diff 追踪的 markdownComponents（用于 assistant 消息）
   * @param diffMap 预扫描构建的 diff 映射
   */
  const createDiffAwareComponents = useCallback((diffMap: Map<string, string>): Components => {
    // 运行时计数器：跟踪每个文件路径出现的代码块序号
    const fileCounter = new Map<string, number>()

    return {
      pre({ children }) {
        const codeChild = Array.isArray(children) ? children[0] : children
        if (
          codeChild &&
          typeof codeChild === 'object' &&
          'props' in codeChild
        ) {
          const { children: codeChildren, className } = (codeChild as React.ReactElement<{ children?: React.ReactNode; className?: string }>).props

          // 检测 mermaid 代码块
          const langMatch = className?.match(/language-(\w+)/)
          if (langMatch && langMatch[1] === 'mermaid') {
            const code = String(codeChildren ?? '').replace(/\n$/, '')
            return <MermaidBlock code={code} />
          }

          // 从 className 提取文件路径（格式：language-typescript:path/to/file.ts）
          const filePathMatch = className?.match(/language-\w+:(.+)/)
          const filePath = filePathMatch ? filePathMatch[1] : undefined

          let previousCode: string | undefined
          if (filePath) {
            const idx = fileCounter.get(filePath) ?? 0
            fileCounter.set(filePath, idx + 1)
            // 查找 diff 映射
            previousCode = diffMap.get(`${filePath}::${idx}`)
          }

          return (
            <CodeBlock
              className={className}
              filePath={filePath}
              previousCode={previousCode}
            >
              {codeChildren}
            </CodeBlock>
          )
        }
        return <pre>{children}</pre>
      },
    }
  }, [])

  // 判断是否应该播放欢迎动画（仅首次渲染时播放）
  const shouldAnimate = useMemo(() => {
    if (welcomeAnimationPlayed) return false
    return true
  }, [])

  // 打字机效果：标题逐字显现
  const { displayedText: titleText, isComplete: titleComplete } = useTypewriter(
    'Claude Code Chat',
    80,
    messages.length === 0 && shouldAnimate
  )

  // 标题完成时标记动画已播放
  useEffect(() => {
    if (titleComplete && shouldAnimate && messages.length === 0) {
      welcomeAnimationPlayed = true
    }
  }, [titleComplete, shouldAnimate, messages.length])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        {/* 注入欢迎页动画所需的 CSS keyframes */}
        {shouldAnimate && (
          <style>{`
            @keyframes welcome-fade-in-up {
              from {
                opacity: 0;
                transform: translateY(12px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            @keyframes welcome-cursor-blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
          `}</style>
        )}
        <div className="text-center max-w-lg animate-fade-in">
          {/* Bot 图标 */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] flex items-center justify-center mx-auto mb-5 shadow-md shadow-[var(--color-gold-glow)]">
            <Bot size={24} className="text-white" />
          </div>

          {/* 标题：打字机效果逐字显现 */}
          <h1 className="text-2xl font-semibold gradient-text mb-1.5 tracking-tight">
            {shouldAnimate ? (
              <>
                {titleText}
                {/* 闪烁光标：打字进行中显示，完成后消失 */}
                {!titleComplete && (
                  <span
                    className="inline-block w-[2px] h-[1.1em] bg-current ml-0.5 align-middle"
                    style={{ animation: 'welcome-cursor-blink 0.6s step-end infinite' }}
                  />
                )}
              </>
            ) : (
              'Claude Code Chat'
            )}
          </h1>

          {/* 副标题：标题打字完成后淡入上移 */}
          <p
            className="text-muted-foreground text-[13px] mb-6"
            style={shouldAnimate ? {
              opacity: 0,
              animation: titleComplete
                ? 'welcome-fade-in-up 0.5s ease-out forwards'
                : 'none',
            } : undefined}
          >
            你的 AI 编程助手，随时为你服务
          </p>

          {/* 项目快速设置区：最醒目的引导 */}
          <div
            className="mb-6 w-full max-w-lg mx-auto"
            style={shouldAnimate ? {
              opacity: 0,
              animation: titleComplete
                ? 'welcome-fade-in-up 0.5s ease-out 100ms forwards'
                : 'none',
            } : undefined}
          >
            {currentWorkingDir ? (
              /* 已选择项目：绿色成功状态 */
              <div className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                  <Check size={14} className="text-emerald-400/80" />
                </div>
                <span className="text-[13px] text-emerald-600 dark:text-emerald-400 truncate" title={currentWorkingDir}>
                  项目：{currentWorkingDir.replace(/\\/g, '/').split('/').filter(Boolean).pop() || currentWorkingDir}
                </span>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('shortcut:folder'))}
                  className="text-[12px] text-foreground ml-auto underline underline-offset-2 flex-shrink-0"
                >
                  切换
                </button>
              </div>
            ) : (
              /* 未选择项目：醒目引导 */
              <div className="rounded-xl border-2 border-dashed border-amber-400/40 bg-amber-500/5 px-5 py-4 space-y-3">
                <div className="flex items-center justify-center gap-2 text-[13.5px] font-medium text-amber-600 dark:text-amber-400">
                  <FolderOpen size={16} />
                  <span>开始之前，请选择项目目录</span>
                </div>
                {recentProjects.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] text-muted-foreground block">最近项目</span>
                    <div className="flex flex-wrap justify-center gap-2">
                      {recentProjects.map((path) => (
                        <button
                          key={path}
                          onClick={() => window.dispatchEvent(new CustomEvent('shortcut:set-project', { detail: { path } }))}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card/80
                            hover:border-primary/40 hover:bg-primary/5 transition-all text-[12px] text-foreground
                            active:scale-[0.97]"
                          title={path}
                        >
                          <FolderOpen size={12} className="opacity-40 flex-shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || path}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-center pt-1">
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('shortcut:folder'))}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary/30 bg-primary/5
                      hover:bg-primary/10 hover:border-primary/50 transition-all text-[13px] text-primary font-medium
                      active:scale-[0.97]"
                  >
                    <FolderOpen size={14} />
                    浏览文件夹...
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 建议卡片：依次错位动画出现，每张延迟递增 100ms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-lg mx-auto">
            {SUGGESTIONS.map((s, i) => (
              <Card
                key={i}
                onClick={() => onSuggestionClick?.(s.text)}
                className={cn(
                  "cursor-pointer transition-all duration-150 group active:scale-[0.98]",
                  "border-ring hover:border-primary hover:bg-accent",
                  "px-4 py-3.5 gap-0"
                )}
                style={shouldAnimate ? {
                  opacity: 0,
                  animation: titleComplete
                    ? `welcome-fade-in-up 0.4s ease-out ${300 + i * 100}ms forwards`
                    : 'none',
                } : undefined}
              >
                <CardContent className="p-0 text-left">
                  <s.icon size={15} className="text-primary mb-2 opacity-60 group-hover:opacity-100 transition-opacity" />
                  <div className="text-[13px] text-foreground mb-0.5">{s.text}</div>
                  <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 快速操作 */}
          <div className="mt-8 flex flex-col items-center gap-3" style={{
            opacity: shouldAnimate ? 0 : 1,
            animation: shouldAnimate && titleComplete ? 'welcome-fade-in-up 0.5s ease-out forwards' : 'none',
            animationDelay: shouldAnimate ? '0.8s' : '0s',
          }}>
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">快速操作</span>
            <div className="flex flex-wrap justify-center gap-2">
              <QuickActionButton icon={BookOpen} label="Prompt 模板" onClick={() => {
                window.dispatchEvent(new CustomEvent('shortcut:prompts'))
              }} />
              <QuickActionButton icon={Columns3} label="模型对比" onClick={() => {
                window.dispatchEvent(new CustomEvent('shortcut:compare'))
              }} />
              <QuickActionButton icon={Search} label="全局搜索" onClick={() => {
                window.dispatchEvent(new CustomEvent('shortcut:search'))
              }} />
              <QuickActionButton icon={Settings2} label="系统提示词" onClick={() => {
                window.dispatchEvent(new CustomEvent('shortcut:system-prompt'))
              }} />
            </div>
          </div>

          {/* 功能发现卡片：帮助新用户了解核心功能（在滚动区域内） */}
          <div className="mt-6 w-full max-w-lg mx-auto" style={{
            opacity: shouldAnimate ? 0 : 1,
            animation: shouldAnimate && titleComplete ? 'welcome-fade-in-up 0.5s ease-out forwards' : 'none',
            animationDelay: shouldAnimate ? '0.9s' : '0s',
          }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FEATURE_CARDS.map((card) => (
                <button
                  key={card.action}
                  className="group flex flex-col items-start gap-1.5 p-3 rounded-lg border border-border bg-card/50 hover:bg-accent hover:border-primary/40 transition-all duration-150 text-left cursor-pointer active:scale-[0.97]"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('feature-card:action', { detail: { action: card.action } }))
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <card.icon size={15} className="text-primary opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    <span className="text-[13px] font-medium text-foreground truncate">{card.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{card.description}</p>
                  <span className="text-[10px] text-muted-foreground/60 font-mono bg-muted/50 px-1.5 py-0.5 rounded">{card.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* 滚动进度条：始终存在，通过 opacity 控制显隐避免布局抖动 */}
      <div
        className="h-[2px] w-full absolute top-0 left-0 z-10 pointer-events-none transition-opacity duration-200"
        style={{ opacity: scrollProgress > 0 && scrollProgress < 100 ? 1 : 0 }}
      >
        <div
          className="bg-primary/60 h-full transition-[width] duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* 多选按钮已移至 FloatingToolbar */}

      {/* 固定消息横条 */}
      <PinnedMessages
        messages={messages}
        onScrollToMessage={handleScrollToMessage}
        onUnpin={handleTogglePinMessage}
      />

      <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
        <div className="max-w-[960px] mx-auto px-5 pt-5 pb-6">
          {messages.map((msg, idx) => {
            // ====== 分组折叠逻辑 ======
            const group = msgIdxToGroup.get(idx)
            const isGroupStart = group && idx === group.startIdx
            const isInCollapsedGroup = group && collapsedGroups.has(group.groupIndex)

            // 如果消息在折叠组内且不是组的第一条，跳过渲染
            if (isInCollapsedGroup && !isGroupStart) {
              return null
            }

            // 判断是否需要在此消息前插入日期分隔线
            const showDateSeparator =
              idx === 0 || !isSameDay(msg.timestamp, messages[idx - 1].timestamp)

            // 判断是否为最后一条已完成的 assistant 消息（用于显示快捷回复）
            const isLastAssistantMessage = msg.role === 'assistant' && !msg.isStreaming && msg.content &&
              !messages.slice(idx + 1).some(m => m.role === 'assistant' && !m.isStreaming && m.content)

            return (
            <Fragment key={msg.id}>
              {/* 分组折叠条：在折叠组的第一条消息位置渲染 */}
              {isGroupStart && group && (
                <MessageGroupCollapse
                  group={group}
                  collapsed={collapsedGroups.has(group.groupIndex)}
                  onToggle={() => toggleGroupCollapse(group.groupIndex)}
                />
              )}

              {/* 如果组被折叠，不渲染组内消息 */}
              {isInCollapsedGroup ? null : (
              <>
              {/* 日期分隔线 */}
              {showDateSeparator && (
                <div className="flex items-center gap-3 my-4 select-none">
                  <div className="flex-1 border-t border-border opacity-30" />
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDateSeparator(msg.timestamp)}
                  </span>
                  <div className="flex-1 border-t border-border opacity-30" />
                </div>
              )}
              <div
                id={`msg-${msg.id}`}
                data-message-id={msg.id}
                draggable={selectMode}
                onDragStart={selectMode ? (e) => handleDragStart(e, idx) : undefined}
                onDragOver={selectMode ? (e) => handleDragOver(e, idx) : undefined}
                onDragEnd={selectMode ? handleDragEnd : undefined}
                onDrop={selectMode ? (e) => handleDrop(e, idx) : undefined}
                className={cn(
                  "rounded-xl transition-all duration-200 relative",
                  highlightedMessageId === msg.id && 'ring-2 ring-primary/50 animate-[search-flash_1s_ease-out]',
                  selectMode && selectedMsgIds.has(msg.id) && 'bg-primary/10 ring-1 ring-primary/30',
                  selectMode && dragIndex === idx && 'opacity-50',
                  selectMode && dragOverIndex === idx && dragIndex !== idx && 'border-t-2 border-t-primary',
                  selectMode && 'cursor-grab active:cursor-grabbing'
                )}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (!selectMode) {
                    setContextMenu({ x: e.clientX, y: e.clientY, message: msg })
                  }
                }}
                onClick={() => {
                  // 选择模式下点击消息切换选中状态
                  if (selectMode) {
                    toggleMsgSelect(msg.id)
                  }
                }}
              >
              {msg.role === 'user' ? (
                /* ====== 用户消息 ====== */
                <div className="flex justify-end mb-5 items-start" role="article" aria-label="用户消息">
                  {/* 多选模式 checkbox + 拖拽手柄 */}
                  {selectMode && (
                    <div className="flex-shrink-0 flex items-center gap-1 mr-2 mt-2">
                      <GripVertical size={14} className="text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
                      <input
                        type="checkbox"
                        checked={selectedMsgIds.has(msg.id)}
                        onChange={() => toggleMsgSelect(msg.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                      />
                    </div>
                  )}
                  <div className="max-w-[90%] sm:max-w-[80%] relative group/msg">
                    {editingId === msg.id ? (
                      /* 编辑模式 */
                      <div className="w-full min-w-[320px]">
                        <textarea
                          ref={editTextareaRef}
                          value={editContent}
                          onChange={(e) => {
                            setEditContent(e.target.value)
                            // 自动调整高度
                            e.target.style.height = 'auto'
                            e.target.style.height = e.target.scrollHeight + 'px'
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleSaveEdit()
                            }
                            if (e.key === 'Escape') {
                              handleCancelEdit()
                            }
                          }}
                          className={cn(
                            "w-full resize-none rounded-2xl rounded-br-md px-4 py-3",
                            "bg-primary/15 border border-primary/40",
                            "text-[13.5px] text-foreground leading-[1.65]",
                            "focus:outline-none focus:ring-1 focus:ring-primary/50",
                            "placeholder:text-muted-foreground"
                          )}
                          rows={1}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEdit}
                            className="text-xs text-foreground"
                          >
                            取消
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={!editContent.trim()}
                            className="text-xs"
                          >
                            保存并发送
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* 正常显示模式 */
                      <>
                        <MessageActions
                          message={msg}
                          onCopy={() => {}}
                          onEdit={onEditMessage ? () => handleStartEdit(msg.id, msg.content) : undefined}
                          onFork={onForkFromMessage ? () => onForkFromMessage(msg.id) : undefined}
                          onCopyLink={() => handleCopyLink(msg.id)}
                          onQuote={onQuoteMessage ? () => onQuoteMessage(msg) : undefined}
                          bookmarked={msg.bookmarked}
                          onToggleBookmark={() => {
                            const sid = useSessionStore.getState().activeSessionId
                            if (sid) {
                              useSessionStore.getState().toggleMessageBookmark(sid, msg.id)
                            }
                          }}
                          onToggleFavorite={() => handleToggleFavorite(msg)}
                          isFavorited={useFavoritesStore.getState().isFavorited(msg.id)}
                          onPin={() => handleTogglePinMessage(msg.id)}
                          isPinned={msg.pinned}
                          onSpeak={() => handleSpeak(msg.id, msg.content)}
                          isSpeaking={speakingMsgId === msg.id}
                          onTranslate={() => handleTranslate(msg.id, msg.content)}
                          isTranslating={translatingMsgId === msg.id}
                          onRestoreVersion={(versionIndex) => {
                            const sid = useSessionStore.getState().activeSessionId
                            if (sid) {
                              useSessionStore.getState().restoreMessageVersion(sid, msg.id, versionIndex)
                            }
                          }}
                        />
                        <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3 shadow-sm [&_pre]:!bg-background/20 [&_pre]:!text-foreground [&_code]:!text-primary-foreground [&_pre_code]:!text-foreground">
                          {/* 用户消息附带的图片 */}
                          {msg.images && msg.images.length > 0 && (
                            <MessageImages
                              images={msg.images}
                              onPreview={(src, alt) => setLightbox({ src, alt })}
                            />
                          )}
                          {msg.content && (
                            <div className="text-[13.5px] text-primary-foreground whitespace-pre-wrap break-words leading-[1.65]">
                              {/* 过滤掉旧格式的 [图片: xxx] 标记（新格式已通过 images 字段渲染），搜索时高亮匹配 */}
                              {(() => {
                                const displayText = msg.content.replace(/\[图片: [^\]]+\]\s*/g, '').trim() || msg.content
                                return searchQuery ? highlightSearchText(displayText, searchQuery) : displayText
                              })()}
                            </div>
                          )}
                        </div>
                        {/* 用户消息翻译结果 */}
                        {translatedMessages.get(msg.id) && (
                          <div className="mt-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                            <div className="flex items-center gap-1.5 text-[10px] text-primary/60 mb-1">
                              <Languages size={10} />
                              <span>翻译 ({translatedMessages.get(msg.id)!.lang})</span>
                            </div>
                            <div className="text-[13px] text-foreground leading-[1.6]">
                              {translatedMessages.get(msg.id)!.text}
                            </div>
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-1.5 text-right">
                          {formatTime(msg.timestamp)}
                        </div>
                        {/* 用户消息 Emoji 反应 */}
                        {activeSessionId && (
                          <div className="flex justify-end">
                            <MessageReactions sessionId={activeSessionId} message={msg} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* ====== 助手消息 ====== */
                <div className="flex gap-3 mb-5 items-start" role="article" aria-label="Claude 回复">
                  {/* 多选模式 checkbox + 拖拽手柄 */}
                  {selectMode && (
                    <div className="flex-shrink-0 flex items-center gap-1 mt-2">
                      <GripVertical size={14} className="text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
                      <input
                        type="checkbox"
                        checked={selectedMsgIds.has(msg.id)}
                        onChange={() => toggleMsgSelect(msg.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                      />
                    </div>
                  )}
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] flex items-center justify-center mt-0.5 shadow-sm">
                    <Bot size={13} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5 relative group/msg">
                    <MessageActions
                      message={msg}
                      onCopy={() => {}}
                      onRegenerate={onRegenerateMessage ? () => onRegenerateMessage(msg.id) : undefined}
                      onFork={onForkFromMessage ? () => onForkFromMessage(msg.id) : undefined}
                      onCopyLink={() => handleCopyLink(msg.id)}
                      onQuote={onQuoteMessage ? () => onQuoteMessage(msg) : undefined}
                      bookmarked={msg.bookmarked}
                      onToggleBookmark={() => {
                        const sid = useSessionStore.getState().activeSessionId
                        if (sid) {
                          useSessionStore.getState().toggleMessageBookmark(sid, msg.id)
                        }
                      }}
                      onToggleFavorite={() => handleToggleFavorite(msg)}
                      isFavorited={useFavoritesStore.getState().isFavorited(msg.id)}
                      onSaveToKnowledge={() => setKnowledgeDialogMsg(msg)}
                      onPin={() => handleTogglePinMessage(msg.id)}
                      isPinned={msg.pinned}
                      onSpeak={() => handleSpeak(msg.id, msg.content)}
                      isSpeaking={speakingMsgId === msg.id}
                      onTranslate={() => handleTranslate(msg.id, msg.content)}
                      isTranslating={translatingMsgId === msg.id}
                      onRestoreVersion={(versionIndex) => {
                        const sid = useSessionStore.getState().activeSessionId
                        if (sid) {
                          useSessionStore.getState().restoreMessageVersion(sid, msg.id, versionIndex)
                        }
                      }}
                    />
                    <div className="text-[13.5px] text-foreground break-words leading-[1.7] markdown-body bg-muted/40 rounded-2xl rounded-bl-md px-4 py-3">
                      {!msg.content && !msg.isStreaming ? (
                        <span className="text-muted-foreground italic">(无内容)</span>
                      ) : (
                        /* 解析 thinking 块并分段渲染，文本部分再解析工具调用标签 */
                        (() => {
                          // 为 assistant 消息构建 diff-aware 组件（支持文件路径代码块对比）
                          const diffMap = buildCodeBlockDiffMap(msg.content)
                          const msgComponents = diffMap.size > 0
                            ? createDiffAwareComponents(diffMap)
                            : markdownComponents

                          return parseThinking(stripCliToolTags(msg.content)).parts.map((part, idx) =>
                            part.type === 'thinking' ? (
                              <ThinkingBlock
                                key={idx}
                                content={part.content}
                                markdownComponents={markdownComponents}
                                isOpen={part.isOpen}
                                isStreaming={msg.isStreaming}
                              />
                            ) : (
                              <Fragment key={idx}>
                                {(() => {
                                  const toolParts = parseToolBlocks(part.content)
                                  // 如果没有工具标签，直接 Markdown 渲染
                                  if (toolParts.length === 1 && toolParts[0].type === 'text') {
                                    return (
                                      <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={msgComponents}
                                      >
                                        {toolParts[0].content}
                                      </ReactMarkdown>
                                    )
                                  }
                                  // 将连续的 tool-use + tool-result（相同 id）配对
                                  const paired: Array<{
                                    type: 'text'
                                    content: string
                                  } | {
                                    type: 'tool'
                                    toolUse: ToolUseParsed
                                    toolResult?: ToolResultParsed
                                  }> = []
                                  for (let i = 0; i < toolParts.length; i++) {
                                    const tp = toolParts[i]
                                    if (tp.type === 'tool-use') {
                                      // 检查下一项是否是对应的 tool-result
                                      const next = toolParts[i + 1]
                                      if (next && next.type === 'tool-result' && next.data.id === tp.data.id) {
                                        paired.push({ type: 'tool', toolUse: tp.data, toolResult: next.data })
                                        i++ // 跳过已配对的 tool-result
                                      } else {
                                        paired.push({ type: 'tool', toolUse: tp.data })
                                      }
                                    } else if (tp.type === 'tool-result') {
                                      // 未配对的 tool-result（可能 tool-use 在前面的 part 中）
                                      // 作为独立工具结果显示
                                      paired.push({
                                        type: 'tool',
                                        toolUse: { id: tp.data.id, name: '工具', input: '' },
                                        toolResult: tp.data,
                                      })
                                    } else {
                                      paired.push({ type: 'text', content: tp.content })
                                    }
                                  }
                                  return paired.map((item, j) =>
                                    item.type === 'text' ? (
                                      <ReactMarkdown
                                        key={j}
                                        remarkPlugins={[remarkGfm, remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={msgComponents}
                                      >
                                        {item.content}
                                      </ReactMarkdown>
                                    ) : (
                                      <ToolUseBlock
                                        key={j}
                                        toolUse={item.toolUse}
                                        toolResult={item.toolResult}
                                        isStreaming={msg.isStreaming}
                                      />
                                    )
                                  )
                                })()}
                              </Fragment>
                            )
                          )
                        })()
                      )}
                      {msg.isStreaming && (
                        <>
                          <span className="inline-block w-[2px] h-[1.1em] bg-primary ml-0.5 align-middle animate-typing-cursor" />
                          <StreamingSpeedIndicator content={msg.content} />
                        </>
                      )}
                    </div>
                    {/* 助手消息翻译结果 */}
                    {translatedMessages.get(msg.id) && (
                      <div className="mt-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                        <div className="flex items-center gap-1.5 text-[10px] text-primary/60 mb-1">
                          <Languages size={10} />
                          <span>翻译 ({translatedMessages.get(msg.id)!.lang})</span>
                        </div>
                        <div className="text-[13px] text-foreground leading-[1.6]">
                          {translatedMessages.get(msg.id)!.text}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] text-muted-foreground mt-1.5">
                        {formatTime(msg.timestamp)}
                      </div>
                      {/* 消息字数/Token 悬浮提示 + 阅读时间估算 — 仅在助手长回复 >100 字时显示 */}
                      {!msg.isStreaming && msg.content && countWords(msg.content).total > 100 && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="mt-1.5 text-foreground/40 transition-colors cursor-default"
                                aria-label="消息详情"
                              >
                                <Info size={12} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[11px] leading-relaxed max-w-[220px]">
                              <div className="space-y-0.5">
                                <div>角色：助手</div>
                                {(() => {
                                  const wc = countWords(msg.content)
                                  return (
                                    <div>字数：{wc.total}（中文 {wc.chinese} / 英文 {wc.english}）</div>
                                  )
                                })()}
                                {msg.tokenUsage && (
                                  <div>Token：输入 {msg.tokenUsage.inputTokens.toLocaleString()} / 输出 {msg.tokenUsage.outputTokens.toLocaleString()}</div>
                                )}
                                <div>阅读时间：{estimateReadingTime(msg.content)}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {msg.tokenUsage && (
                        <TokenUsageBadge
                          inputTokens={msg.tokenUsage.inputTokens}
                          outputTokens={msg.tokenUsage.outputTokens}
                        />
                      )}
                      {/* 点赞/踩反馈按钮 */}
                      {activeSessionId && !msg.isStreaming && (
                        <FeedbackButtons sessionId={activeSessionId} message={msg} />
                      )}
                    </div>
                    {/* 助手消息 Emoji 反应 */}
                    {activeSessionId && !msg.isStreaming && (
                      <MessageReactions sessionId={activeSessionId} message={msg} />
                    )}
                    {/* 助手消息底部快捷操作栏 — 仅在非流式时显示 */}
                    {!msg.isStreaming && msg.content && (
                      <AssistantQuickActions
                        message={msg}
                        onContinueInNewChat={handleContinueInNewChat}
                      />
                    )}
                    {/* 快捷回复按钮 -- 仅在最后一条已完成的 assistant 消息上显示 */}
                    {isLastAssistantMessage && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5 animate-fade-in">
                        {generateQuickReplies(msg.content).map((reply, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => onSuggestionClick?.(reply)}
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px]",
                              "border border-border bg-card hover:bg-accent hover:border-primary/30",
                              "text-foreground",
                              "transition-all duration-150 cursor-pointer",
                              "active:scale-95"
                            )}
                          >
                            <Sparkles size={10} className="text-primary/50" />
                            {reply}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              </div>
              </>
              )}
            </Fragment>
            )
          })}
          {/* SuggestionChips 已合并到消息内嵌 quickReplies */}
          {/* 任务进度指示条 */}
          {activeProgress && activeProgress.length > 0 && (
            <ProgressIndicator items={activeProgress} />
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* 多选模式底部操作栏 */}
      {selectMode && selectedMsgIds.size > 0 && (
        <div className="sticky bottom-0 z-20 flex items-center justify-between px-4 py-2 bg-card border-t border-border animate-fade-in">
          <span className="text-[12px] text-muted-foreground">
            已选 {selectedMsgIds.size} 条消息
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBatchCopy} className="text-[12px] gap-1">
              <Copy size={14} /> 复制
            </Button>
            <Button variant="ghost" size="sm" onClick={handleBatchBookmark} className="text-[12px] gap-1">
              <Bookmark size={14} /> 收藏
            </Button>
            <Button variant="ghost" size="sm" onClick={exitSelectMode} className="text-[12px]">
              取消
            </Button>
          </div>
        </div>
      )}

      {/* 右键上下文菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          message={contextMenu.message}
          onClose={() => setContextMenu(null)}
          onCopy={() => { navigator.clipboard.writeText(contextMenu.message.content); toast.success('已复制') }}
          onEdit={contextMenu.message.role === 'user' && onEditMessage ? () => { handleStartEdit(contextMenu.message.id, contextMenu.message.content) } : undefined}
          onRegenerate={contextMenu.message.role === 'assistant' && onRegenerateMessage ? () => onRegenerateMessage(contextMenu.message.id) : undefined}
          onFork={onForkFromMessage ? () => onForkFromMessage(contextMenu.message.id) : undefined}
          onCopyLink={() => handleCopyLink(contextMenu.message.id)}
          onQuote={onQuoteMessage ? () => onQuoteMessage(contextMenu.message) : undefined}
          onBookmark={() => {
            const sid = useSessionStore.getState().activeSessionId
            if (sid) useSessionStore.getState().toggleMessageBookmark(sid, contextMenu.message.id)
          }}
          isBookmarked={contextMenu.message.bookmarked}
          onToggleFavorite={() => handleToggleFavorite(contextMenu.message)}
          isFavorited={useFavoritesStore.getState().isFavorited(contextMenu.message.id)}
          onSaveToKnowledge={() => {
            setKnowledgeDialogMsg(contextMenu.message)
            setContextMenu(null)
          }}
          onPin={() => {
            handleTogglePinMessage(contextMenu.message.id)
            toast.success(contextMenu.message.pinned ? '已取消固定' : '已固定到顶部')
          }}
          isPinned={contextMenu.message.pinned}
          onSpeak={() => handleSpeak(contextMenu.message.id, contextMenu.message.content)}
          isSpeaking={speakingMsgId === contextMenu.message.id}
          onTranslate={() => handleTranslate(contextMenu.message.id, contextMenu.message.content)}
          isTranslating={translatingMsgId === contextMenu.message.id}
          onSelectMode={() => {
            enterSelectMode(contextMenu.message.id)
            setContextMenu(null)
          }}
        />
      )}

      {/* 滚动到底部浮动按钮（含未读消息计数） */}
      <Button
        variant="outline"
        size="icon"
        onClick={scrollToBottom}
        className={cn(
          "absolute bottom-4 right-4 z-30",
          "h-9 w-9 rounded-full",
          "bg-card/80 backdrop-blur-sm border-border",
          "shadow-md shadow-black/15",
          "hover:bg-accent hover:scale-105",
          "transition-all duration-200",
          showScrollBtn
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-2 pointer-events-none"
        )}
        aria-label="滚动到底部"
      >
        <ArrowDown size={16} className="text-muted-foreground" />
        {/* 未读消息计数徽章 */}
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-1.5 -right-1.5",
              "min-w-[18px] h-[18px] px-1",
              "flex items-center justify-center",
              "rounded-full bg-primary text-primary-foreground",
              "text-[10px] font-medium leading-none",
              "shadow-sm"
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* 图片灯箱预览 */}
      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* 保存到知识库对话框 */}
      {knowledgeDialogMsg && (() => {
        const currentSession = allSessions.find(s => s.id === activeSessionId)
        return (
          <SaveToKnowledgeDialog
            open={true}
            onClose={() => setKnowledgeDialogMsg(null)}
            content={knowledgeDialogMsg.content}
            sessionId={activeSessionId || ''}
            sessionTitle={currentSession?.title || ''}
            messageTimestamp={knowledgeDialogMsg.timestamp}
          />
        )
      })()}
    </div>
  )
}
