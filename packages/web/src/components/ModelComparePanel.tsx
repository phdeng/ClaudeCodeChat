import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

// ==================== 类型定义 ====================

interface ModelComparePanelProps {
  open: boolean
  onClose: () => void
  workingDirectory?: string
  systemPrompt?: string
}

interface ModelDef {
  id: string
  name: string
  color: string
}

interface ModelResponse {
  modelId: string
  content: string
  status: 'idle' | 'streaming' | 'done' | 'error'
  tokenUsage?: { inputTokens: number; outputTokens: number }
}

// ==================== 可用模型 ====================

const MODELS: ModelDef[] = [
  { id: 'claude-sonnet-4-6', name: 'Sonnet', color: 'text-blue-400/80' },
  { id: 'claude-opus-4-6', name: 'Opus', color: 'text-purple-400/80' },
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku', color: 'text-green-400/80' },
]

// ==================== 主组件 ====================

export default function ModelComparePanel({
  open,
  onClose,
  workingDirectory,
  systemPrompt,
}: ModelComparePanelProps) {
  const [selectedModels, setSelectedModels] = useState<string[]>([
    'claude-sonnet-4-6',
    'claude-opus-4-6',
  ])
  const [responses, setResponses] = useState<Map<string, ModelResponse>>(new Map())
  const [prompt, setPrompt] = useState('')
  const [isComparing, setIsComparing] = useState(false)
  const eventSourceRefs = useRef<Map<string, EventSource>>(new Map())
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // 切换模型选择
  const toggleModel = useCallback((modelId: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(modelId)) {
        // 至少保留 2 个模型
        if (prev.length <= 2) return prev
        return prev.filter((id) => id !== modelId)
      }
      // 最多选 3 个
      if (prev.length >= 3) return prev
      return [...prev, modelId]
    })
  }, [])

  // 发送对比请求
  const handleCompare = useCallback(() => {
    if (!prompt.trim() || selectedModels.length < 2) return

    // 关闭之前的 SSE 连接
    eventSourceRefs.current.forEach((es) => es.close())
    eventSourceRefs.current.clear()

    // 初始化响应
    const newResponses = new Map<string, ModelResponse>()
    for (const modelId of selectedModels) {
      newResponses.set(modelId, { modelId, content: '', status: 'streaming' })
    }
    setResponses(newResponses)
    setIsComparing(true)

    // 为每个模型创建独立的 SSE 连接 + HTTP 发送
    for (const modelId of selectedModels) {
      const compareSessionId = `compare-${modelId}-${Date.now()}`
      const compareClientId = `compare-${crypto.randomUUID()}`

      // 建立 SSE 连接
      const es = new EventSource(`/api/chat/stream?clientId=${compareClientId}`)

      es.addEventListener('connected', () => {
        // SSE 连接建立后发送消息
        fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: compareClientId,
            sessionId: compareSessionId,
            message: prompt,
            model: modelId,
            workingDirectory,
            systemPrompt,
          }),
        }).catch(() => {
          setResponses((prev) => {
            const next = new Map(prev)
            const existing = next.get(modelId)
            if (existing) {
              next.set(modelId, { ...existing, status: 'error', content: '发送请求失败' })
            }
            return next
          })
        })
      })

      es.addEventListener('stream', (e: MessageEvent) => {
        const data = JSON.parse(e.data)
        setResponses((prev) => {
          const next = new Map(prev)
          const existing = next.get(modelId)
          if (existing) {
            next.set(modelId, { ...existing, content: existing.content + data.content })
          }
          return next
        })
      })

      es.addEventListener('done', (e: MessageEvent) => {
        const data = JSON.parse(e.data)
        setResponses((prev) => {
          const next = new Map(prev)
          const existing = next.get(modelId)
          if (existing) {
            next.set(modelId, { ...existing, status: 'done', tokenUsage: data.usage })
          }
          return next
        })
        es.close()
      })

      es.addEventListener('error', (e: Event) => {
        // 区分 SSE 连接错误和服务端返回的 error 事件
        if (e instanceof MessageEvent) {
          const data = JSON.parse(e.data)
          setResponses((prev) => {
            const next = new Map(prev)
            const existing = next.get(modelId)
            if (existing) {
              next.set(modelId, { ...existing, status: 'error', content: data.message || '发生未知错误' })
            }
            return next
          })
        }
        // SSE 连接错误会被 onerror 处理
      })

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          setResponses((prev) => {
            const next = new Map(prev)
            const existing = next.get(modelId)
            if (existing && existing.status === 'streaming') {
              next.set(modelId, { ...existing, status: 'error', content: '连接失败' })
            }
            return next
          })
        }
      }

      eventSourceRefs.current.set(modelId, es)
    }
  }, [prompt, selectedModels, workingDirectory, systemPrompt])

  // 检测是否所有模型都完成
  useEffect(() => {
    if (!isComparing) return
    const allDone = Array.from(responses.values()).every(
      (r) => r.status === 'done' || r.status === 'error'
    )
    if (allDone && responses.size > 0) {
      setIsComparing(false)
    }
  }, [responses, isComparing])

  // 自动滚动到底部
  useEffect(() => {
    scrollRefs.current.forEach((el) => {
      el.scrollTop = el.scrollHeight
    })
  }, [responses])

  // 组件卸载时关闭所有 SSE 连接
  useEffect(() => {
    return () => {
      eventSourceRefs.current.forEach((es) => es.close())
    }
  }, [])

  // Escape 键关闭
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // 自动聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [open])

  // 处理键盘事件（Ctrl+Enter 发送）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleCompare()
    }
  }

  if (!open) return null

  const gridCols =
    selectedModels.length === 3 ? 'grid-cols-3' : 'grid-cols-2'

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-sm animate-fade-in">
      {/* 顶部栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">模型对比</h2>
          <span className="text-[11px] text-muted-foreground">
            选择 2-3 个模型并排对比回复
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          className="text-foreground"
        >
          <X size={18} />
        </Button>
      </div>

      {/* 模型选择栏 */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-border bg-card/50">
        <span className="text-[12px] text-muted-foreground">模型：</span>
        {MODELS.map((model) => {
          const isSelected = selectedModels.includes(model.id)
          return (
            <button
              key={model.id}
              onClick={() => toggleModel(model.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium border transition-all ${
                isSelected
                  ? 'border-primary/50 bg-primary/10 text-foreground'
                  : 'border-border bg-secondary/30 text-foreground hover:border-border/80'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isSelected ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
              <span className={isSelected ? model.color : ''}>{model.name}</span>
            </button>
          )
        })}
      </div>

      {/* 对比结果区域 */}
      <div className={`flex-1 min-h-0 grid ${gridCols} gap-3 p-3`}>
        {selectedModels.map((modelId) => {
          const model = MODELS.find((m) => m.id === modelId)!
          const response = responses.get(modelId)
          return (
            <div
              key={modelId}
              className="flex flex-col border border-border rounded-lg overflow-hidden bg-card"
            >
              {/* 列标题 */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
                <span className={`text-sm font-medium ${model.color}`}>
                  {model.name}
                </span>
                {response?.status === 'streaming' && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 size={10} className="animate-spin" />
                    <span className="animate-pulse">生成中...</span>
                  </span>
                )}
                {response?.status === 'done' && (
                  <span className="text-xs text-emerald-400/80">完成</span>
                )}
                {response?.status === 'error' && (
                  <span className="text-xs text-destructive">出错</span>
                )}
                {response?.status === 'done' && response.tokenUsage && (
                  <span className="text-[11px] text-muted-foreground ml-auto font-mono tabular-nums">
                    {response.tokenUsage.outputTokens.toLocaleString()} tokens
                  </span>
                )}
              </div>

              {/* 响应内容 */}
              <ScrollArea className="flex-1">
                <div
                  ref={(el) => {
                    if (el) scrollRefs.current.set(modelId, el)
                  }}
                  className="p-3"
                >
                  {response?.content ? (
                    <div className="prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-[12px] [&_table]:text-[12px] [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-[13px]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {response.content}
                      </ReactMarkdown>
                    </div>
                  ) : response?.status === 'streaming' ? (
                    <div className="flex items-center gap-2 py-4 justify-center">
                      <div className="flex gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                        <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                        <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        等待回复...
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <span className="text-[12px] text-muted-foreground">
                        输入问题后点击发送开始对比
                      </span>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )
        })}
      </div>

      {/* 底部输入区域 */}
      <div className="flex-shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2 max-w-[960px] mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入要对比的问题..."
              rows={2}
              disabled={isComparing}
              className="w-full resize-none rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
            />
            <span className="absolute right-2 bottom-1 text-[10px] text-muted-foreground">
              Ctrl+Enter 发送
            </span>
          </div>
          <Button
            onClick={handleCompare}
            disabled={!prompt.trim() || selectedModels.length < 2 || isComparing}
            size="sm"
            className="h-9 px-4"
          >
            {isComparing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            <span className="ml-1.5">
              {isComparing ? '对比中...' : '发送对比'}
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
