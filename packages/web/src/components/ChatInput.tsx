import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowUp, Square, Mic, MicOff, ImagePlus, X, Bold, Italic, Code, TextQuote, Plus, Trash2, Pencil, BarChart2, Save, User, Bot, MessageSquareQuote, Lightbulb, ChevronDown, ChevronUp, FolderOpen, Settings2 as SettingsIcon, FileText, AlertTriangle, BookTemplate } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import CommandPalette, { type CommandPaletteItem, type CommandPaletteHandle } from './CommandPalette'
import AutoComplete, { type AutoCompleteHandle } from './AutoComplete'
import { usePhrasesStore } from '@/stores/phrasesStore'
import { useSessionStore, type Message } from '@/stores/sessionStore'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useTranslation } from '../i18n'
import PromptTemplates from './PromptTemplates'

// ==================== 图片附件类型 ====================

/** 附件图片信息 */
interface AttachedImage {
  id: string
  /** base64 编码的图片数据（含 data:image/... 前缀） */
  base64: string
  /** 文件名 */
  name: string
  /** 预览用的 base64 URL */
  preview: string
}

// ==================== Web Speech API 类型声明 ====================

/** SpeechRecognition 实例类型 */
interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: ISpeechRecognitionEvent) => void) | null
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface ISpeechRecognitionEvent {
  resultIndex: number
  results: {
    length: number
    [index: number]: {
      isFinal: boolean
      0: { transcript: string; confidence: number }
    }
  }
}

interface ISpeechRecognitionErrorEvent {
  error: string
  message: string
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition

// ==================== Token 估算 ====================

/**
 * 估算文本的 token 数量（简单估算）
 * - 中文：约 1.5 个字符 = 1 token
 * - 英文/其他：约 4 个字符 = 1 token
 * - 混合内容使用加权计算
 */
function estimateTokens(text: string): number {
  if (!text) return 0

  // 统计中文字符数（CJK 统一汉字基本区）
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  // 非中文字符数
  const otherChars = text.length - chineseChars

  // 加权计算
  const chineseTokens = chineseChars / 1.5
  const otherTokens = otherChars / 4

  return Math.ceil(chineseTokens + otherTokens)
}

// ==================== 会话统计计算 ====================

function computeSessionStats(messages: Message[]) {
  const userMsgs = messages.filter(m => m.role === 'user')
  const assistantMsgs = messages.filter(m => m.role === 'assistant')
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
  const avgChars = messages.length > 0 ? Math.round(totalChars / messages.length) : 0
  const maxChars = messages.length > 0 ? Math.max(...messages.map(m => m.content.length)) : 0
  const codeBlocks = messages.reduce((sum, m) => sum + (m.content.match(/```/g) || []).length / 2, 0)

  let duration = ''
  if (messages.length >= 2) {
    const diffMs = messages[messages.length - 1].timestamp - messages[0].timestamp
    const mins = Math.floor(diffMs / 60000)
    const hours = Math.floor(mins / 60)
    duration = hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`
  }

  return {
    userCount: userMsgs.length,
    assistantCount: assistantMsgs.length,
    totalChars,
    avgChars,
    maxChars,
    codeBlocks: Math.floor(codeBlocks),
    duration,
  }
}

// ==================== 类型定义 ====================

interface ChatInputProps {
  onSend: (message: string, images?: Array<{ base64: string; name: string }>) => void
  onStop: () => void
  isStreaming: boolean
  workingDirectory?: string
  onCommand?: (command: string) => void
  /** 被引用的消息（引用回复功能） */
  quotedMessage?: { role: string; content: string } | null
  /** 清除引用消息的回调 */
  onClearQuote?: () => void
}

/** 触发器状态：跟踪当前激活的 @ 或 / 或 # 弹出框 */
interface TriggerState {
  type: 'file' | 'command' | 'hash'
  /** 触发符号 (@ 或 / 或 #) 在输入框中的索引 */
  startIndex: number
  /** 触发符号后面的搜索文本 */
  query: string
}

// ==================== 主组件 ====================

export default function ChatInput({
  onSend,
  onStop,
  isStreaming,
  workingDirectory,
  onCommand,
  quotedMessage,
  onClearQuote,
}: ChatInputProps) {
  const { t, lang } = useTranslation()
  const isMobile = useIsMobile()
  const [input, setInput] = useState('')
  const [trigger, setTrigger] = useState<TriggerState | null>(null)
  const [palettePosition, setPalettePosition] = useState({ left: 0, bottom: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])

  const [showStats, setShowStats] = useState(false)

  // # 消息引用补全列表的选中索引
  const [hashSelectedIndex, setHashSelectedIndex] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const paletteRef = useRef<CommandPaletteHandle>(null)
  const autoCompleteRef = useRef<AutoCompleteHandle>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const statsPanelRef = useRef<HTMLDivElement>(null)
  const hashMenuRef = useRef<HTMLDivElement>(null)
  const hashSelectedItemRef = useRef<HTMLButtonElement>(null)
  // 用于累积已确认的识别文本，避免中间结果重复追加
  const finalTranscriptRef = useRef('')

  // 输入历史（存储在 ref 中避免丢失且不触发重渲染）
  const inputHistoryRef = useRef<string[]>([])
  const historyIndexRef = useRef(-1)
  const tempInputRef = useRef('')  // 保存用户当前未发送的输入

  const hasContent = input.trim().length > 0 || attachedImages.length > 0

  // ==================== 草稿自动保存 ====================
  const { sessions, activeSessionId, setDraft, getDraft, clearDraft } = useSessionStore()
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 标记是否正在切换会话，避免切换时触发不必要的草稿保存 */
  const isSwitchingSessionRef = useRef(false)
  /** 记录当前草稿是否已保存（用于显示"草稿已保存"提示） */
  const [draftSaved, setDraftSaved] = useState(false)

  // 会话切换时恢复草稿
  useEffect(() => {
    if (!activeSessionId) return
    isSwitchingSessionRef.current = true
    const draft = getDraft(activeSessionId)
    setInput(draft)
    setDraftSaved(!!draft)
    // 延迟重置标记，确保 setInput 引起的 handleChange 不会触发保存
    requestAnimationFrame(() => {
      isSwitchingSessionRef.current = false
    })
  }, [activeSessionId, getDraft])

  // 组件卸载时清除防抖定时器
  useEffect(() => {
    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current)
      }
    }
  }, [])

  /** 防抖保存草稿（1 秒） */
  const saveDraftDebounced = useCallback((sessionId: string, content: string) => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current)
    }
    draftTimerRef.current = setTimeout(() => {
      setDraft(sessionId, content)
      setDraftSaved(!!content.trim())
      draftTimerRef.current = null
    }, 1000)
  }, [setDraft])

  // ==================== 会话统计 ====================
  const activeSession = sessions.find(s => s.id === activeSessionId)
  const sessionMessages = activeSession?.messages ?? []
  const sessionStats = computeSessionStats(sessionMessages)

  // ==================== # 消息引用：过滤匹配的历史消息 ====================
  const hashFilteredMessages = (() => {
    if (!trigger || trigger.type !== 'hash') return []
    const query = trigger.query.toLowerCase()
    const filtered = sessionMessages
      .filter(m => !m.isStreaming) // 排除正在流式输出的消息
      .filter(m => !query || m.content.toLowerCase().includes(query))
      .slice(-8) // 最多显示 8 条（取最近的）
      .reverse() // 最新的消息在最上面
    return filtered
  })()

  // 当 hashFilteredMessages 变化时重置选中索引
  useEffect(() => {
    if (trigger?.type === 'hash') {
      setHashSelectedIndex(0)
    }
  }, [trigger?.type, trigger?.query])

  // # 选中项滚动到可视区域
  useEffect(() => {
    hashSelectedItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [hashSelectedIndex])

  /** 选中 # 消息引用后的处理 */
  const handleHashSelect = useCallback(
    (message: Message) => {
      if (!trigger || trigger.type !== 'hash') return

      // 生成引用文本：内容前 50 个字符
      const preview = message.content.slice(0, 50).replace(/\n/g, ' ')
      const roleName = message.role === 'user' ? (lang === 'zh' ? '用户' : 'User') : 'Claude'
      const quoteLabel = lang === 'zh' ? '引用' : 'Quote'
      const quoteText = `> [${quoteLabel}${roleName}] ${preview}${message.content.length > 50 ? '...' : ''}\n\n`

      // 替换 #搜索词 为引用文本
      const before = input.slice(0, trigger.startIndex)
      const afterTrigger = input.slice(trigger.startIndex + 1 + trigger.query.length)
      const newValue = `${before}${quoteText}${afterTrigger}`
      setInput(newValue)
      setTrigger(null)

      // 将光标移到引用文本之后
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const newCursorPos = before.length + quoteText.length
          textareaRef.current.selectionStart = newCursorPos
          textareaRef.current.selectionEnd = newCursorPos
          textareaRef.current.focus()
        }
      })
    },
    [input, trigger, lang]
  )

  // 点击外部关闭统计面板
  useEffect(() => {
    if (!showStats) return
    const handleClickOutside = (e: MouseEvent) => {
      if (statsPanelRef.current && !statsPanelRef.current.contains(e.target as Node)) {
        setShowStats(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showStats])

  // 点击外部关闭 # 消息引用面板
  useEffect(() => {
    if (trigger?.type !== 'hash') return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        hashMenuRef.current &&
        !hashMenuRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setTrigger(null)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [trigger?.type])

  // ==================== 提示词模板 ====================
  const [showTemplates, setShowTemplates] = useState(false)

  /** 选择模板后将内容填入输入框 */
  const handleTemplateSelect = useCallback((content: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setInput(prev => prev + content)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = input.slice(0, start)
    const after = input.slice(end)
    const newValue = before + content + after
    setInput(newValue)

    // 将光标移到插入内容之后
    requestAnimationFrame(() => {
      const newPos = start + content.length
      textarea.selectionStart = newPos
      textarea.selectionEnd = newPos
      textarea.focus()
    })
  }, [input])

  // ==================== 快捷短语 ====================
  const [showPhrases, setShowPhrases] = useState(false)
  const [phraseForm, setPhraseForm] = useState({ label: '', content: '' })
  const [showPhraseForm, setShowPhraseForm] = useState(false)
  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null)
  const phrasePanelRef = useRef<HTMLDivElement>(null)
  const { phrases, addPhrase, updatePhrase, deletePhrase } = usePhrasesStore()

  /** 将短语内容插入到 textarea 光标位置 */
  const insertPhrase = useCallback((content: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setInput(prev => prev + content)
      setShowPhrases(false)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = input.slice(0, start)
    const after = input.slice(end)
    const newValue = before + content + after
    setInput(newValue)
    setShowPhrases(false)

    // 将光标移到插入内容之后
    requestAnimationFrame(() => {
      const newPos = start + content.length
      textarea.selectionStart = newPos
      textarea.selectionEnd = newPos
      textarea.focus()
    })
  }, [input])

  /** 提交新建/编辑短语表单 */
  const handlePhraseFormSubmit = useCallback(() => {
    const label = phraseForm.label.trim()
    const content = phraseForm.content.trim()
    if (!label || !content) return

    if (editingPhraseId) {
      updatePhrase(editingPhraseId, label, content)
      setEditingPhraseId(null)
    } else {
      addPhrase(label, content)
    }
    setPhraseForm({ label: '', content: '' })
    setShowPhraseForm(false)
  }, [phraseForm, editingPhraseId, addPhrase, updatePhrase])

  /** 开始编辑某个短语 */
  const startEditPhrase = useCallback((id: string, label: string, content: string) => {
    setEditingPhraseId(id)
    setPhraseForm({ label, content })
    setShowPhraseForm(true)
  }, [])

  // 点击外部关闭短语面板
  useEffect(() => {
    if (!showPhrases) return
    const handleClickOutside = (e: MouseEvent) => {
      if (phrasePanelRef.current && !phrasePanelRef.current.contains(e.target as Node)) {
        setShowPhrases(false)
        setShowPhraseForm(false)
        setEditingPhraseId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPhrases])

  // ==================== 图片处理 ====================

  /** 最大允许的图片数量 */
  const MAX_IMAGES = 4
  /** 单张图片最大大小（5MB） */
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024

  /** 处理图片文件，转为 base64 并添加到附件列表 */
  const processImageFile = useCallback((file: File) => {
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(lang === 'zh' ? '图片大小不能超过 5MB' : 'Image size cannot exceed 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      // 使用函数式更新确保并发 FileReader 完成时每次检查基于最新状态
      // 避免多张图片同时粘贴时超过限制的竞态条件
      setAttachedImages(prev => {
        if (prev.length >= MAX_IMAGES) {
          toast.error(lang === 'zh' ? `最多只能添加 ${MAX_IMAGES} 张图片` : `Cannot add more than ${MAX_IMAGES} images`)
          return prev
        }
        return [...prev, {
          id: crypto.randomUUID(),
          base64,
          name: file.name || 'screenshot.png',
          preview: base64,
        }]
      })
    }
    reader.onerror = () => {
      toast.error(lang === 'zh' ? '图片读取失败' : 'Failed to read image')
    }
    reader.readAsDataURL(file)
  }, [lang])

  /** 移除已附加的图片 */
  const removeImage = useCallback((id: string) => {
    setAttachedImages(prev => prev.filter(img => img.id !== id))
  }, [])

  /** 处理粘贴事件（拦截粘贴的图片） */
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        processImageFile(file)
      }
    }
  }, [processImageFile])

  /** 通过文件选择器选择图片 */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        processImageFile(file)
      } else {
        toast.error(lang === 'zh' ? `不支持的文件类型: ${file.name}` : `Unsupported file type: ${file.name}`)
      }
    }
    // 清空 input 以便再次选择同一文件
    e.target.value = ''
  }, [processImageFile, lang])

  // 字数统计与 token 估算
  const charCount = input.length
  const tokenCount = estimateTokens(input)
  const isOverLimit = charCount > 4000

  // ==================== 语音输入 ====================

  /** 记录开始录音时输入框已有的文本，用于追加识别结果 */
  const inputBeforeListeningRef = useRef('')

  const startListening = useCallback(() => {
    // 检查浏览器是否支持 Web Speech API
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      toast.error(lang === 'zh' ? '当前浏览器不支持语音识别，请使用 Chrome 或 Edge' : 'Speech recognition not supported. Please use Chrome or Edge')
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true       // 持续识别
    recognition.interimResults = true   // 实时显示中间结果
    recognition.lang = lang === 'zh' ? 'zh-CN' : 'en-US'

    // 记录开始录音时的已有输入内容
    inputBeforeListeningRef.current = input
    finalTranscriptRef.current = ''

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let finalText = ''
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalText += transcript
        } else {
          interimText += transcript
        }
      }

      // 累积最终确认的文本
      if (finalText) {
        finalTranscriptRef.current += finalText
      }

      // 将已确认文本 + 当前中间结果 拼接到原始输入之后
      const combined = finalTranscriptRef.current + interimText
      setInput(inputBeforeListeningRef.current + combined)
    }

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      setIsListening(false)
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        toast.error((lang === 'zh' ? '语音识别出错: ' : 'Speech recognition error: ') + event.error)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    toast.success(lang === 'zh' ? '开始语音识别，请说话...' : 'Listening, please speak...')
  }, [input, lang])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // ==================== Markdown 格式化辅助 ====================

  /** 在选中文本周围包裹 Markdown 语法符号 */
  const wrapSelection = useCallback((prefix: string, suffix: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selected = text.slice(start, end)

    const placeholder = lang === 'zh' ? '文本' : 'text'
    const newText = text.slice(0, start) + prefix + (selected || placeholder) + suffix + text.slice(end)
    setInput(newText)

    // 设置光标位置
    requestAnimationFrame(() => {
      if (selected) {
        // 如果有选中文本，选中替换后的区域
        textarea.selectionStart = start + prefix.length
        textarea.selectionEnd = start + prefix.length + selected.length
      } else {
        // 如果没有选中文本，选中默认占位文本
        textarea.selectionStart = start + prefix.length
        textarea.selectionEnd = start + prefix.length + placeholder.length
      }
      textarea.focus()
    })
  }, [lang])

  // 组件卸载时清理语音识别
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  // ==================== 自动调整高度 ====================
  useEffect(() => {
    if (textareaRef.current) {
      const maxHeight = isMobile ? 100 : 160
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, maxHeight) + 'px'
    }
  }, [input, isMobile])

  // ==================== 弹出框位置计算 ====================
  const updatePalettePosition = useCallback(() => {
    if (!textareaRef.current || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const textareaRect = textareaRef.current.getBoundingClientRect()

    // 弹出框显示在输入框上方
    const bottom = containerRect.bottom - textareaRect.top + 8
    const left = 8

    setPalettePosition({ left, bottom })
  }, [])

  // ==================== 触发检测 ====================
  const detectTrigger = useCallback(
    (value: string, cursorPos: number) => {
      if (!value || cursorPos === 0) {
        setTrigger(null)
        return
      }

      const textBeforeCursor = value.slice(0, cursorPos)

      // 1. 检测 / 命令：光标所在行以 / 开头，且 / 后无空格
      const lastNewline = textBeforeCursor.lastIndexOf('\n')
      const lineStart = lastNewline + 1
      const currentLine = textBeforeCursor.slice(lineStart)

      if (currentLine.startsWith('/')) {
        const query = currentLine.slice(1)
        if (!query.includes(' ')) {
          setTrigger({ type: 'command', startIndex: lineStart, query })
          updatePalettePosition()
          return
        }
      }

      // 2. 检测 @ 文件引用：光标前最近的 @，且 @ 前为空白/行首/字符串开头
      const atIndex = textBeforeCursor.lastIndexOf('@')
      if (atIndex >= 0) {
        const charBeforeAt = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' '
        const isValidPosition =
          charBeforeAt === ' ' ||
          charBeforeAt === '\n' ||
          charBeforeAt === '\t' ||
          atIndex === 0

        if (isValidPosition) {
          const query = textBeforeCursor.slice(atIndex + 1)
          // 同一行内（无换行符）
          if (!query.includes('\n')) {
            setTrigger({ type: 'file', startIndex: atIndex, query })
            updatePalettePosition()
            return
          }
        }
      }

      // 3. 检测 # 消息引用：光标前最近的 #，且 # 前为空白/行首/字符串开头
      const hashIndex = textBeforeCursor.lastIndexOf('#')
      if (hashIndex >= 0) {
        const charBeforeHash = hashIndex > 0 ? textBeforeCursor[hashIndex - 1] : ' '
        const isValidHashPosition =
          charBeforeHash === ' ' ||
          charBeforeHash === '\n' ||
          charBeforeHash === '\t' ||
          hashIndex === 0

        if (isValidHashPosition) {
          const query = textBeforeCursor.slice(hashIndex + 1)
          // 同一行内（无换行符）
          if (!query.includes('\n')) {
            setTrigger({ type: 'hash', startIndex: hashIndex, query })
            setHashSelectedIndex(0)
            updatePalettePosition()
            return
          }
        }
      }

      setTrigger(null)
    },
    [updatePalettePosition]
  )

  // ==================== 输入变化 ====================
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart || 0
    setInput(value)
    detectTrigger(value, cursorPos)

    // 防抖保存草稿（切换会话时不触发）
    if (!isSwitchingSessionRef.current && activeSessionId) {
      saveDraftDebounced(activeSessionId, value)
    }
  }

  // ==================== 发送消息 ====================
  const handleSubmit = () => {
    if ((!input.trim() && attachedImages.length === 0) || isStreaming) return
    // 保存到历史（避免重复）
    const trimmed = input.trim()
    if (trimmed) {
      const history = inputHistoryRef.current
      if (history.length === 0 || history[history.length - 1] !== trimmed) {
        history.push(trimmed)
      }
      // 限制历史长度
      if (history.length > 50) {
        history.shift()
      }
    }
    historyIndexRef.current = -1
    tempInputRef.current = ''

    // 构建发送内容：如果有引用消息，在前面添加 Markdown 引用格式
    let sendContent = trimmed || (lang === 'zh' ? '（见图片）' : '(see images)')
    if (quotedMessage) {
      const quotedText = quotedMessage.content.slice(0, 200)
      const quotedLines = quotedText.split('\n').map(line => `> ${line}`).join('\n')
      sendContent = `${quotedLines}\n\n${sendContent}`
      onClearQuote?.()
    }

    // 发送消息和图片
    const images = attachedImages.length > 0
      ? attachedImages.map(img => ({ base64: img.base64, name: img.name }))
      : undefined
    onSend(sendContent, images)
    setInput('')
    setAttachedImages([])
    setTrigger(null)

    // 清除草稿
    if (activeSessionId) {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current)
        draftTimerRef.current = null
      }
      clearDraft(activeSessionId)
      setDraftSaved(false)
    }
  }

  // ==================== 选中面板项处理 ====================
  const handlePaletteSelect = useCallback(
    (item: CommandPaletteItem) => {
      if (!trigger) return

      if (item.type === 'command') {
        // 直接执行类命令：由父组件处理
        const directCommands = ['/clear', '/new', '/settings', '/sessions', '/cost', '/system', '/prompts', '/clear-context', '/git', '/files', '/snippets', '/exportimage', '/pin', '/zen', '/theme', '/workflow', '/context']
        if (directCommands.includes(item.value)) {
          setInput('')
          setTrigger(null)
          onCommand?.(item.value)
          return
        }

        // 发送类命令：作为消息发送给 CLI
        const sendCommands = ['/compact', '/help', '/init', '/model']
        if (sendCommands.includes(item.value)) {
          setInput('')
          setTrigger(null)
          onSend(item.value)
          return
        }
      } else {
        // 文件引用：替换 @query 为 @filepath，并在路径后添加空格
        const before = input.slice(0, trigger.startIndex)
        const afterTrigger = input.slice(trigger.startIndex + 1 + trigger.query.length)
        const newValue = `${before}@${item.value} ${afterTrigger}`
        setInput(newValue)
        setTrigger(null)

        // 将光标移到插入内容之后
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            const newCursorPos = before.length + 1 + item.value.length + 1
            textareaRef.current.selectionStart = newCursorPos
            textareaRef.current.selectionEnd = newCursorPos
            textareaRef.current.focus()
          }
        })
      }
    },
    [input, trigger, onCommand, onSend]
  )

  // ==================== @ 文件自动补全选中处理 ====================
  const handleAutoCompleteSelect = useCallback(
    (value: string) => {
      if (!trigger || trigger.type !== 'file') return

      // 替换 @query 为 @filepath，并在路径后添加空格
      const before = input.slice(0, trigger.startIndex)
      const afterTrigger = input.slice(trigger.startIndex + 1 + trigger.query.length)
      const newValue = `${before}@${value} ${afterTrigger}`
      setInput(newValue)
      setTrigger(null)

      // 将光标移到插入内容之后
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const newCursorPos = before.length + 1 + value.length + 1
          textareaRef.current.selectionStart = newCursorPos
          textareaRef.current.selectionEnd = newCursorPos
          textareaRef.current.focus()
        }
      })
    },
    [input, trigger]
  )

  // ==================== 关闭面板 ====================
  const handlePaletteClose = useCallback(() => {
    setTrigger(null)
  }, [])

  // ==================== 键盘事件 ====================
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // # 消息引用面板打开时拦截导航键
    if (trigger?.type === 'hash' && hashFilteredMessages.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHashSelectedIndex(prev => Math.max(0, prev - 1))
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHashSelectedIndex(prev => Math.min(hashFilteredMessages.length - 1, prev + 1))
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const selected = hashFilteredMessages[hashSelectedIndex]
        if (selected) handleHashSelect(selected)
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        const selected = hashFilteredMessages[hashSelectedIndex]
        if (selected) handleHashSelect(selected)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setTrigger(null)
        return
      }
    }

    // @ 文件自动补全面板打开时拦截导航键
    if (trigger?.type === 'file' && autoCompleteRef.current) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        autoCompleteRef.current.moveUp()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        autoCompleteRef.current.moveDown()
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (autoCompleteRef.current.hasItems()) {
          autoCompleteRef.current.confirm()
        }
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        if (autoCompleteRef.current.hasItems()) {
          autoCompleteRef.current.confirm()
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setTrigger(null)
        return
      }
    }

    // / 命令面板打开时拦截导航键
    if (trigger?.type === 'command' && paletteRef.current) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        paletteRef.current.moveUp()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        paletteRef.current.moveDown()
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (paletteRef.current.hasItems()) {
          paletteRef.current.confirm()
        }
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        if (paletteRef.current.hasItems()) {
          paletteRef.current.confirm()
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setTrigger(null)
        return
      }
    }

    // ==================== Markdown 格式化快捷键 ====================

    // Ctrl+B — 粗体（包裹选中文本或插入 **文本**）
    if (e.ctrlKey && !e.shiftKey && e.key === 'b') {
      e.preventDefault()
      e.stopPropagation()  // 防止冒泡到 ChatLayout 的 Ctrl+B 侧边栏切换
      wrapSelection('**', '**')
      return
    }

    // Ctrl+I — 斜体
    if (e.ctrlKey && !e.shiftKey && e.key === 'i') {
      e.preventDefault()
      wrapSelection('*', '*')
      return
    }

    // Ctrl+` — 行内代码
    if (e.ctrlKey && e.key === '`') {
      e.preventDefault()
      wrapSelection('`', '`')
      return
    }

    // Ctrl+Shift+K — 代码块
    if (e.ctrlKey && e.shiftKey && e.key === 'K') {
      e.preventDefault()
      wrapSelection('\n```\n', '\n```\n')
      return
    }

    // ↑ 键回溯输入历史（仅在光标在第一行且面板未打开时）
    if (e.key === 'ArrowUp' && !trigger) {
      const textarea = textareaRef.current
      if (textarea) {
        const cursorPos = textarea.selectionStart
        const textBeforeCursor = input.slice(0, cursorPos)
        const isFirstLine = !textBeforeCursor.includes('\n')

        if (isFirstLine && inputHistoryRef.current.length > 0) {
          e.preventDefault()
          const history = inputHistoryRef.current

          if (historyIndexRef.current === -1) {
            // 保存当前输入
            tempInputRef.current = input
            historyIndexRef.current = history.length - 1
          } else if (historyIndexRef.current > 0) {
            historyIndexRef.current--
          }

          setInput(history[historyIndexRef.current])
        }
      }
      return
    }

    // ↓ 键前进输入历史
    if (e.key === 'ArrowDown' && !trigger) {
      const textarea = textareaRef.current
      if (textarea) {
        const cursorPos = textarea.selectionStart
        const textAfterCursor = input.slice(cursorPos)
        const isLastLine = !textAfterCursor.includes('\n')

        if (isLastLine && historyIndexRef.current >= 0) {
          e.preventDefault()
          const history = inputHistoryRef.current

          if (historyIndexRef.current < history.length - 1) {
            historyIndexRef.current++
            setInput(history[historyIndexRef.current])
          } else {
            // 恢复到原始输入
            historyIndexRef.current = -1
            setInput(tempInputRef.current)
          }
        }
      }
      return
    }

    // 默认：Enter 发送消息
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // ==================== 光标移动时重新检测 ====================
  const handleCursorChange = () => {
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart || 0
      detectTrigger(input, cursorPos)
    }
  }

  // ==================== 拖拽文件 ====================
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // 检查是否真正离开容器（而非进入子元素）
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const references: string[] = []
    const imageFiles: File[] = []

    // 优先使用文件列表
    if (e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i]
        // 判断是否为图片文件
        if (file.type.startsWith('image/')) {
          imageFiles.push(file)
        } else {
          // 非图片文件走原有的文件引用逻辑
          const filePath = (file as File & { path?: string }).path || file.name
          references.push(`@${filePath}`)
        }
      }
    } else {
      // 如果没有文件列表，尝试获取 text/plain 数据（如从文件管理器拖拽路径）
      const textData = e.dataTransfer.getData('text/plain')
      if (textData) {
        // 按换行符分割，可能拖拽了多个路径
        const paths = textData.split(/\r?\n/).filter(Boolean)
        for (const p of paths) {
          references.push(`@${p.trim()}`)
        }
      }
    }

    // 处理图片文件
    for (const file of imageFiles) {
      processImageFile(file)
    }

    // 处理非图片文件引用
    if (references.length > 0) {
      const suffix = references.join(' ') + ' '
      setInput((prev) => (prev ? prev.trimEnd() + ' ' + suffix : suffix))
    }

    // 聚焦输入框
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  // ==================== 智能上下文提示 ====================
  const { dismissedHints, dismissHint } = useSessionStore()
  const [hintsCollapsed, setHintsCollapsed] = useState(true)

  /** 计算当前应该显示的智能提示 */
  const contextHints = (() => {
    const hints: Array<{ id: string; text: string; type: 'project' | 'conversation'; action?: string; icon: 'folder' | 'settings' | 'file' | 'warning' }> = []

    // 项目上下文提示
    if (!workingDirectory && !dismissedHints.includes('no-working-dir')) {
      hints.push({
        id: 'no-working-dir',
        text: lang === 'zh' ? '选择项目文件夹以获得更好的代码理解能力' : 'Select a project folder for better code understanding',
        type: 'project',
        icon: 'folder',
      })
    }

    if (workingDirectory && !activeSession?.systemPrompt && !dismissedHints.includes('no-system-prompt')) {
      hints.push({
        id: 'no-system-prompt',
        text: lang === 'zh' ? '设置系统提示词可以让 Claude 更了解你的项目' : 'Set a system prompt to help Claude understand your project',
        type: 'project',
        action: '/system',
        icon: 'settings',
      })
    }

    // 对话上下文提示
    if (sessionMessages.length > 20 && !dismissedHints.includes('long-conversation')) {
      hints.push({
        id: 'long-conversation',
        text: lang === 'zh' ? '对话较长，可以创建新会话以获得更好的响应质量' : 'Long conversation. Consider starting a new session for better responses',
        type: 'conversation',
        action: '/new',
        icon: 'warning',
      })
    }

    if (
      sessionMessages.length > 0 &&
      !dismissedHints.includes('recent-error')
    ) {
      const lastFewMessages = sessionMessages.slice(-4)
      const hasError = lastFewMessages.some(
        (m) =>
          m.role === 'assistant' &&
          (m.content.toLowerCase().includes('error') ||
            m.content.includes('错误') ||
            m.content.includes('失败') ||
            m.content.toLowerCase().includes('exception') ||
            m.content.toLowerCase().includes('traceback'))
      )
      if (hasError) {
        hints.push({
          id: 'recent-error',
          text: lang === 'zh' ? '遇到错误？尝试更详细地描述问题或提供错误日志' : 'Got errors? Try describing the issue in more detail or providing error logs',
          type: 'conversation',
          icon: 'warning',
        })
      }
    }

    return hints
  })()

  // ==================== 渲染 ====================
  return (
    <div className="flex-shrink-0 px-3 sm:px-5 pb-3 sm:pb-4 pt-2 max-w-[960px] mx-auto w-full">
      {/* 智能上下文提示条 */}
      {contextHints.length > 0 && (
        <div className="mb-2">
          {/* 折叠/展开按钮 */}
          <button
            onClick={() => setHintsCollapsed(v => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground/70 transition-colors mb-1 cursor-pointer"
          >
            <Lightbulb size={10} />
            <span>{lang === 'zh' ? '智能提示' : 'Smart hints'} ({contextHints.length})</span>
            {hintsCollapsed ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
          </button>

          {!hintsCollapsed && (
            <div className="space-y-1">
              {contextHints.map((hint) => (
                <div
                  key={hint.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] transition-colors',
                    hint.type === 'project'
                      ? 'bg-blue-500/8 text-blue-400/80 border border-blue-500/15'
                      : 'bg-yellow-500/8 text-yellow-400/80 border border-yellow-500/15'
                  )}
                >
                  {/* 图标 */}
                  <span className="flex-shrink-0">
                    {hint.icon === 'folder' && <FolderOpen size={12} />}
                    {hint.icon === 'settings' && <SettingsIcon size={12} />}
                    {hint.icon === 'file' && <FileText size={12} />}
                    {hint.icon === 'warning' && <AlertTriangle size={12} />}
                  </span>

                  {/* 提示文字（可点击跳转） */}
                  <span
                    className={cn(
                      'flex-1',
                      hint.action && 'cursor-pointer hover:underline'
                    )}
                    onClick={() => {
                      if (hint.action) {
                        onCommand?.(hint.action)
                      }
                    }}
                  >
                    {hint.text}
                  </span>

                  {/* 关闭按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      dismissHint(hint.id)
                    }}
                    className="flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        className={cn(
          "relative rounded-xl border bg-card transition-colors duration-150 focus-within:border-primary",
          isListening ? "border-red-500 border-2" : "border-ring"
        )}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 拖拽覆盖层 */}
        {isDragging && (
          <div className="absolute inset-0 z-10 bg-primary/5 border-2 border-dashed border-primary rounded-xl flex items-center justify-center">
            <span className="text-primary text-[13px] font-medium pointer-events-none">
              {t('promptTemplates.dragFileHint')}
            </span>
          </div>
        )}

        {/* @ 文件路径自动补全 */}
        {trigger?.type === 'file' && workingDirectory && (
          <AutoComplete
            ref={autoCompleteRef}
            type="file"
            query={trigger.query}
            workingDirectory={workingDirectory}
            onSelect={handleAutoCompleteSelect}
            onClose={handlePaletteClose}
            position={palettePosition}
          />
        )}

        {/* / 斜杠命令面板 */}
        {trigger?.type === 'command' && (
          <CommandPalette
            ref={paletteRef}
            type={trigger.type}
            query={trigger.query}
            position={palettePosition}
            onSelect={handlePaletteSelect}
            onClose={handlePaletteClose}
            workingDirectory={workingDirectory}
          />
        )}

        {/* # 消息引用补全面板 */}
        {trigger?.type === 'hash' && (
          <div
            ref={hashMenuRef}
            className="absolute z-50 animate-fade-in"
            style={{
              left: palettePosition.left,
              bottom: palettePosition.bottom,
              minWidth: 320,
              maxWidth: 460,
            }}
          >
            <div className="rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
              {/* 标题栏 */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <MessageSquareQuote size={12} className="text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground font-medium">
                  {lang === 'zh' ? '引用历史消息' : 'Quote message'}
                </span>
                {trigger.query && (
                  <span className="text-[11px] text-primary ml-auto font-mono truncate max-w-[140px]">
                    #{trigger.query}
                  </span>
                )}
              </div>

              {/* 消息列表 */}
              <div className="max-h-[240px] overflow-y-auto py-1">
                {hashFilteredMessages.length === 0 ? (
                  <div className="flex items-center justify-center py-6">
                    <span className="text-[12px] text-muted-foreground">
                      {sessionMessages.length === 0
                        ? (lang === 'zh' ? '当前会话暂无消息' : 'No messages in this session')
                        : (lang === 'zh' ? '没有匹配的消息' : 'No matching messages')}
                    </span>
                  </div>
                ) : (
                  hashFilteredMessages.map((msg, index) => {
                    const isUser = msg.role === 'user'
                    const preview = msg.content.slice(0, 50).replace(/\n/g, ' ')
                    const time = new Date(msg.timestamp)
                    const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`

                    return (
                      <button
                        key={msg.id}
                        ref={index === hashSelectedIndex ? hashSelectedItemRef : undefined}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors',
                          index === hashSelectedIndex
                            ? 'bg-accent text-accent-foreground'
                            : 'text-foreground hover:bg-accent/50'
                        )}
                        onMouseEnter={() => setHashSelectedIndex(index)}
                        onClick={() => handleHashSelect(msg)}
                      >
                        {/* 角色图标 */}
                        <div className={cn(
                          'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center',
                          isUser ? 'bg-primary/15 text-primary' : 'bg-emerald-500/15 text-emerald-500'
                        )}>
                          {isUser ? <User size={10} /> : <Bot size={10} />}
                        </div>

                        {/* 内容摘要 */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] truncate">
                            {preview}{msg.content.length > 50 ? '...' : ''}
                          </div>
                        </div>

                        {/* 时间 */}
                        <span className="flex-shrink-0 text-[10px] text-muted-foreground tabular-nums">
                          {timeStr}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>

              {/* 底部快捷键提示 */}
              <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border">
                <span className="text-[10px] text-muted-foreground">
                  <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">&#8593;&#8595;</kbd> {lang === 'zh' ? '选择' : 'Select'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">Enter</kbd> {t('common.confirm')}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  <kbd className="px-1 py-0.5 rounded bg-accent text-[9px] font-mono">Esc</kbd> {t('common.close')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 图片预览区域 */}
        {attachedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1">
            {attachedImages.map(img => (
              <div key={img.id} className="relative group">
                <img
                  src={img.preview}
                  alt={img.name}
                  className="h-16 w-16 rounded-lg object-cover border border-border"
                />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title={t('common.remove')}
                >
                  <X size={12} />
                </button>
                <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-black/50 text-white rounded-b-lg truncate px-1">
                  {img.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 引用消息预览条 */}
        {quotedMessage && (
          <div className="flex items-start gap-2 px-3 py-2 mx-3 mt-2 rounded-lg bg-accent/30 border-l-2 border-primary/50">
            <div className="flex-1 min-w-0">
              <span className="text-[11px] text-primary font-medium">
                {t('messageList.quoteReply')} {quotedMessage.role === 'user' ? t('floatingToolbar.user') : 'Claude'}
              </span>
              <p className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5">
                {quotedMessage.content.slice(0, 150)}
              </p>
            </div>
            <button
              onClick={onClearQuote}
              className="flex-shrink-0 text-foreground p-0.5 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* 隐藏的文件选择器 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onClick={handleCursorChange}
          onSelect={handleCursorChange}
          placeholder={isMobile ? t('chatInput.placeholder').replace(/\s*\(.*\)$/, '') : t('chatInput.placeholder')}
          rows={1}
          className={cn(
            "w-full bg-transparent text-foreground placeholder:text-muted-foreground placeholder:opacity-50 resize-none px-4 py-3 outline-none leading-[1.6]",
            isMobile
              ? "text-[14px] min-h-[42px] max-h-[100px] pr-16"
              : "text-[13.5px] min-h-[44px] max-h-[160px] pr-24"
          )}
        />

        {/* 录音状态提示 */}
        {isListening && (
          <div className="px-4 pb-1 text-[11px] text-red-400/80 animate-pulse flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400/90" />
            {t('chatInput.voiceListening')}
          </div>
        )}

        {/* 图片上传 / 麦克风 / 发送 / 停止按钮 */}
        <div className={cn(
          "absolute right-2 bottom-2 flex items-center",
          isMobile ? "gap-0.5" : "gap-1"
        )}>
          {/* 图片上传按钮：仅在非流式输出时显示, 移动端隐藏 */}
          {!isStreaming && !isMobile && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => fileInputRef.current?.click()}
              className="text-foreground"
              title={t('chatInput.uploadImage')}
            >
              <ImagePlus size={14} />
            </Button>
          )}

          {/* 麦克风按钮：仅在非流式输出时显示, 移动端隐藏 */}
          {!isStreaming && !isMobile && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={toggleListening}
              className={cn(
                isListening
                  ? 'bg-red-400/90 text-white hover:bg-red-500 animate-pulse'
                  : 'text-foreground'
              )}
              title={isListening ? t('chatInput.voiceListening') : t('chatInput.voiceInput')}
            >
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
            </Button>
          )}

          {/* 发送 / 停止按钮 — 移动端放大 */}
          {isStreaming ? (
            <Button
              variant="destructive"
              size={isMobile ? 'icon-sm' : 'icon-xs'}
              onClick={onStop}
            >
              <Square size={isMobile ? 18 : 14} />
            </Button>
          ) : (
            <Button
              variant={hasContent ? 'default' : 'ghost'}
              size={isMobile ? 'icon-sm' : 'icon-xs'}
              onClick={handleSubmit}
              disabled={!hasContent}
              className={cn(
                !hasContent && 'bg-accent text-muted-foreground'
              )}
            >
              <ArrowUp size={isMobile ? 18 : 14} strokeWidth={2.5} />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
        {/* 左侧：草稿提示 + 格式化工具栏按钮 */}
        <div className="flex items-center gap-0">
          {/* 草稿已保存提示 */}
          {draftSaved && (
            <span className="flex items-center gap-0.5 mr-1.5 text-muted-foreground select-none">
              <Save size={10} />
              <span className="text-[10px]">{lang === 'zh' ? '草稿已保存' : 'Draft saved'}</span>
            </span>
          )}
          {/* 格式化按钮 — 移动端隐藏 */}
          {!isMobile && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => wrapSelection('**', '**')}
                  className="text-muted-foreground h-5 w-5 cursor-pointer hover:bg-accent"
                >
                  <Bold size={11} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">{lang === 'zh' ? '粗体' : 'Bold'} (Ctrl+B)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => wrapSelection('*', '*')}
                  className="text-muted-foreground h-5 w-5 cursor-pointer hover:bg-accent"
                >
                  <Italic size={11} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">{lang === 'zh' ? '斜体' : 'Italic'} (Ctrl+I)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => wrapSelection('`', '`')}
                  className="text-muted-foreground h-5 w-5 cursor-pointer hover:bg-accent"
                >
                  <Code size={11} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">{lang === 'zh' ? '行内代码' : 'Inline code'} (Ctrl+`)</TooltipContent>
            </Tooltip>

            {/* 快捷短语按钮 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => { setShowPhrases(v => !v); setShowPhraseForm(false); setEditingPhraseId(null) }}
                    className={cn(
                      "h-5 w-5 cursor-pointer",
                      showPhrases
                        ? "text-primary"
                        : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <TextQuote size={11} />
                  </Button>

                  {/* 快捷短语下拉面板（向上弹出） */}
                  {showPhrases && (
                    <div
                      ref={phrasePanelRef}
                      className="absolute bottom-7 left-0 w-72 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden"
                    >
                      {/* 头部 */}
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                        <span className="text-xs font-medium text-foreground">{lang === 'zh' ? '快捷短语' : 'Quick phrases'}</span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => { setShowPhraseForm(v => !v); setEditingPhraseId(null); setPhraseForm({ label: '', content: '' }) }}
                          className="h-5 w-5 text-foreground cursor-pointer"
                          title={lang === 'zh' ? '添加短语' : 'Add phrase'}
                        >
                          <Plus size={12} />
                        </Button>
                      </div>

                      {/* 短语列表 */}
                      <div className="max-h-48 overflow-y-auto">
                        {phrases.length === 0 ? (
                          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                            {lang === 'zh' ? '暂无短语，点击 + 添加' : 'No phrases yet, click + to add'}
                          </div>
                        ) : (
                          phrases.map((phrase) => (
                            <div
                              key={phrase.id}
                              className="group flex items-center gap-1 px-3 py-1.5 hover:bg-accent cursor-pointer transition-colors"
                              onClick={() => insertPhrase(phrase.content)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-foreground truncate">{phrase.label}</div>
                                <div className="text-[10px] text-muted-foreground truncate">{phrase.content}</div>
                              </div>
                              <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); startEditPhrase(phrase.id, phrase.label, phrase.content) }}
                                  className="p-0.5 text-foreground rounded cursor-pointer"
                                  title={t('common.edit')}
                                >
                                  <Pencil size={10} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deletePhrase(phrase.id) }}
                                  className="p-0.5 text-muted-foreground hover:text-destructive rounded cursor-pointer"
                                  title={t('common.delete')}
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* 新建/编辑短语表单 */}
                      {showPhraseForm && (
                        <div className="border-t border-border px-3 py-2 space-y-1.5">
                          <div className="text-[10px] text-muted-foreground font-medium">
                            {editingPhraseId ? (lang === 'zh' ? '编辑短语' : 'Edit phrase') : (lang === 'zh' ? '新建短语' : 'New phrase')}
                          </div>
                          <input
                            type="text"
                            placeholder={lang === 'zh' ? '标题（如：代码审查）' : 'Title (e.g. Code Review)'}
                            value={phraseForm.label}
                            onChange={(e) => setPhraseForm(prev => ({ ...prev, label: e.target.value }))}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="w-full text-xs px-2 py-1 rounded border border-border bg-background text-foreground outline-none focus:border-primary"
                          />
                          <textarea
                            placeholder={lang === 'zh' ? '短语内容...' : 'Phrase content...'}
                            value={phraseForm.content}
                            onChange={(e) => setPhraseForm(prev => ({ ...prev, content: e.target.value }))}
                            onKeyDown={(e) => e.stopPropagation()}
                            rows={2}
                            className="w-full text-xs px-2 py-1 rounded border border-border bg-background text-foreground outline-none focus:border-primary resize-none"
                          />
                          <div className="flex items-center gap-1.5 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setShowPhraseForm(false); setEditingPhraseId(null); setPhraseForm({ label: '', content: '' }) }}
                              className="h-6 text-[10px] px-2 cursor-pointer"
                            >
                              {t('common.cancel')}
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={handlePhraseFormSubmit}
                              disabled={!phraseForm.label.trim() || !phraseForm.content.trim()}
                              className="h-6 text-[10px] px-2 cursor-pointer"
                            >
                              {editingPhraseId ? (lang === 'zh' ? '更新' : 'Update') : t('common.save')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              {!showPhrases && <TooltipContent side="top" className="text-[10px]">{lang === 'zh' ? '快捷短语' : 'Quick phrases'}</TooltipContent>}
            </Tooltip>

            {/* 提示词模板按钮 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setShowTemplates(v => !v)}
                    className={cn(
                      "h-5 w-5 cursor-pointer",
                      showTemplates
                        ? "text-primary"
                        : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <BookTemplate size={11} />
                  </Button>

                  {/* 提示词模板下拉面板 */}
                  <PromptTemplates
                    open={showTemplates}
                    onSelect={handleTemplateSelect}
                    onClose={() => setShowTemplates(false)}
                  />
                </div>
              </TooltipTrigger>
              {!showTemplates && <TooltipContent side="top" className="text-[10px]">{t('promptTemplates.title')}</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
          )}

          {/* 分隔符 — 移动端隐藏 */}
          {!isMobile && <span className="mx-1.5 text-muted-foreground opacity-20">|</span>}

          {/* 中间：快捷键提示 */}
          {isMobile ? (
            <p>{t('chatInput.enterSend')} · {t('chatInput.slashCommand')}</p>
          ) : (
            <>
              <p className="hidden sm:block">{t('chatInput.shiftEnterNewline')} · {t('chatInput.enterSend')} · {t('chatInput.slashCommand')} · {t('chatInput.atFile')} · {t('chatInput.hashQuote')}</p>
              <p className="sm:hidden">{t('chatInput.enterSend')} · {t('chatInput.slashCommand')}</p>
            </>
          )}
        </div>

        {/* 右侧：字数统计 + 会话统计按钮 */}
        <div className="flex items-center gap-1 ml-2">
          {hasContent && (
            <p
              className={cn(
                'font-mono whitespace-nowrap',
                tokenCount > 5000
                  ? 'text-red-500'
                  : tokenCount > 2000
                    ? 'text-orange-500'
                    : isOverLimit
                      ? 'text-destructive'
                      : ''
              )}
            >
              {charCount} {lang === 'zh' ? '字' : 'chars'} · ~{tokenCount} tokens
            </p>
          )}

          {/* 会话统计按钮 */}
          {sessionMessages.length > 0 && (
            <div className="relative">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowStats(v => !v)}
                      className={cn(
                        "p-0.5 rounded transition-colors cursor-pointer",
                        showStats
                          ? "text-primary"
                          : "text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <BarChart2 size={12} />
                    </button>
                  </TooltipTrigger>
                  {!showStats && <TooltipContent side="top" className="text-[10px]">{lang === 'zh' ? '会话统计' : 'Session stats'}</TooltipContent>}
                </Tooltip>
              </TooltipProvider>

              {/* 会话统计悬浮面板 */}
              {showStats && (
                <div
                  ref={statsPanelRef}
                  className="absolute bottom-7 right-0 w-80 bg-popover/90 backdrop-blur-md border border-border rounded-lg shadow-lg z-50 overflow-hidden"
                >
                  {/* 标题栏 */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-xs font-medium text-foreground">{lang === 'zh' ? '会话统计' : 'Session stats'}</span>
                    <button
                      onClick={() => setShowStats(false)}
                      className="text-foreground p-0.5 rounded cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {/* 统计网格 */}
                  <div className="grid grid-cols-2 gap-3 p-3">
                    {/* 总消息数 */}
                    <div className="flex flex-col items-center py-2 rounded-md bg-accent/30">
                      <span className="text-lg font-bold text-foreground">
                        {sessionStats.userCount + sessionStats.assistantCount}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {lang === 'zh' ? `总消息 (用户 ${sessionStats.userCount} / 助手 ${sessionStats.assistantCount})` : `Total (User ${sessionStats.userCount} / Assistant ${sessionStats.assistantCount})`}
                      </span>
                    </div>

                    {/* 总字数 */}
                    <div className="flex flex-col items-center py-2 rounded-md bg-accent/30">
                      <span className="text-lg font-bold text-foreground">
                        {sessionStats.totalChars.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{lang === 'zh' ? '总字数' : 'Total chars'}</span>
                    </div>

                    {/* 平均每条消息字数 */}
                    <div className="flex flex-col items-center py-2 rounded-md bg-accent/30">
                      <span className="text-lg font-bold text-foreground">
                        {sessionStats.avgChars.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{lang === 'zh' ? '平均字数/条' : 'Avg chars/msg'}</span>
                    </div>

                    {/* 最长消息字数 */}
                    <div className="flex flex-col items-center py-2 rounded-md bg-accent/30">
                      <span className="text-lg font-bold text-foreground">
                        {sessionStats.maxChars.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{lang === 'zh' ? '最长消息字数' : 'Longest message'}</span>
                    </div>

                    {/* 代码块数量 */}
                    <div className="flex flex-col items-center py-2 rounded-md bg-accent/30">
                      <span className="text-lg font-bold text-foreground">
                        {sessionStats.codeBlocks}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{lang === 'zh' ? '代码块数量' : 'Code blocks'}</span>
                    </div>

                    {/* 会话时长 */}
                    <div className="flex flex-col items-center py-2 rounded-md bg-accent/30">
                      <span className="text-lg font-bold text-foreground">
                        {sessionStats.duration || '-'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{lang === 'zh' ? '会话时长' : 'Duration'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
