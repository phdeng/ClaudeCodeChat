import { useMemo } from 'react'
import { X, Printer, Copy, Clock, User, Bot, MessageSquare, Hash } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { useSessionStore } from '../stores/sessionStore'
import type { Session, Message } from '../stores/sessionStore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ChatExportPreviewProps {
  open: boolean
  onClose: () => void
  sessionId: string
}

/**
 * 格式化时间戳为可读字符串
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 计算会话的 Token 使用总计
 */
function computeTokenSummary(messages: Message[]) {
  let totalInput = 0
  let totalOutput = 0
  let countWithUsage = 0

  for (const msg of messages) {
    if (msg.tokenUsage) {
      totalInput += msg.tokenUsage.inputTokens
      totalOutput += msg.tokenUsage.outputTokens
      countWithUsage++
    }
  }

  return { totalInput, totalOutput, countWithUsage }
}

export default function ChatExportPreview({ open, onClose, sessionId }: ChatExportPreviewProps) {
  const sessions = useSessionStore((s) => s.sessions)
  const session = sessions.find((s) => s.id === sessionId)

  const tokenSummary = useMemo(() => {
    if (!session) return { totalInput: 0, totalOutput: 0, countWithUsage: 0 }
    return computeTokenSummary(session.messages)
  }, [session])

  if (!open || !session) return null

  /** 打印导出（利用浏览器 @media print） */
  const handlePrint = () => {
    window.print()
  }

  /** 复制为 Markdown 格式 */
  const handleCopyMarkdown = () => {
    if (!session) return

    let md = `# ${session.title}\n\n`
    md += `> 创建于 ${formatTime(session.createdAt)}\n\n`

    if (session.systemPrompt) {
      md += `## 系统提示词\n\n${session.systemPrompt}\n\n---\n\n`
    }

    for (const msg of session.messages) {
      const role = msg.role === 'user' ? '用户' : '助手'
      const time = formatTime(msg.timestamp)
      md += `### ${role} _(${time})_\n\n${msg.content}\n\n---\n\n`
    }

    if (tokenSummary.countWithUsage > 0) {
      md += `## Token 统计\n\n`
      md += `- 输入 Token: ${tokenSummary.totalInput.toLocaleString()}\n`
      md += `- 输出 Token: ${tokenSummary.totalOutput.toLocaleString()}\n`
      md += `- 总计: ${(tokenSummary.totalInput + tokenSummary.totalOutput).toLocaleString()}\n`
    }

    navigator.clipboard.writeText(md).then(() => {
      toast.success('已复制为 Markdown')
    }).catch(() => {
      toast.error('复制失败')
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-sm">
      {/* 顶部工具栏 — 打印时隐藏 */}
      <div className="no-print flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-primary" />
          <span className="text-sm font-medium text-foreground">对话预览</span>
          <span className="text-xs text-muted-foreground">— {session.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyMarkdown}
            className="text-xs gap-1.5"
          >
            <Copy size={13} />
            复制 Markdown
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-xs gap-1.5"
          >
            <Printer size={13} />
            打印导出
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="text-foreground ml-2"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* 预览内容区域 — 打印时显示 */}
      <ScrollArea className="flex-1">
        <div className="print-content max-w-[800px] mx-auto px-6 py-8">
          {/* 标题区 */}
          <div className="mb-8 pb-6 border-b border-border">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {session.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="opacity-60" />
                创建于 {formatTime(session.createdAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Hash size={13} className="opacity-60" />
                {session.messages.length} 条消息
              </span>
            </div>
            {/* 标签 */}
            {session.tags && session.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {session.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 系统提示词（如有） */}
          {session.systemPrompt && (
            <div className="mb-6 p-4 rounded-lg bg-muted/50 border border-border message-block">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  系统提示词
                </span>
              </div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {session.systemPrompt}
              </div>
            </div>
          )}

          {/* 消息列表 */}
          <div className="space-y-4">
            {session.messages.map((msg) => (
              <MessageBlock key={msg.id} message={msg} />
            ))}
          </div>

          {/* Token 统计摘要 */}
          {tokenSummary.countWithUsage > 0 && (
            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground mb-3">Token 用量统计</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <div className="text-lg font-bold text-foreground">
                    {tokenSummary.totalInput.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">输入 Token</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <div className="text-lg font-bold text-foreground">
                    {tokenSummary.totalOutput.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">输出 Token</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <div className="text-lg font-bold text-primary">
                    {(tokenSummary.totalInput + tokenSummary.totalOutput).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">总计</div>
                </div>
              </div>
            </div>
          )}

          {/* 页脚 */}
          <div className="mt-8 pt-4 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              导出自 Claude Code Chat · {formatTime(Date.now())}
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

/**
 * 单条消息块组件
 */
function MessageBlock({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div
      className={`message-block rounded-lg p-4 border-l-4 ${
        isUser
          ? 'border-l-blue-500 bg-blue-500/5'
          : 'border-l-purple-500 bg-purple-500/5'
      }`}
    >
      {/* 角色标识 + 时间 */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`flex items-center justify-center w-6 h-6 rounded-full ${
            isUser ? 'bg-blue-500/15' : 'bg-purple-500/15'
          }`}
        >
          {isUser ? (
            <User size={13} className="text-blue-400/80" />
          ) : (
            <Bot size={13} className="text-purple-400/80" />
          )}
        </div>
        <span
          className={`text-sm font-semibold ${
            isUser ? 'text-blue-400/80' : 'text-purple-400/80'
          }`}
        >
          {isUser ? '用户' : '助手'}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatTime(message.timestamp)}
        </span>
        {/* Token 用量标注 */}
        {message.tokenUsage && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {message.tokenUsage.inputTokens + message.tokenUsage.outputTokens} tokens
          </span>
        )}
      </div>

      {/* 消息内容 */}
      <div className="markdown-body text-sm text-foreground pl-8">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
