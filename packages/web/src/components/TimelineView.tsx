import { User, Bot, X, Clock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Message } from '../stores/sessionStore'

// ==================== 时间格式化工具函数 ====================

/** 格式化时间为 HH:MM */
function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** 格式化日期分隔线文本：今天/昨天/M月D日/YYYY年M月D日 */
function formatDateSeparator(ts: number): string {
  const date = new Date(ts)
  const now = new Date()

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

  if (dayStart === todayStart) return '今天'
  if (dayStart === yesterdayStart) return '昨天'

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

// ==================== 组件 ====================

interface TimelineViewProps {
  messages: Message[]
  onClose: () => void
}

export default function TimelineView({ messages, onClose }: TimelineViewProps) {
  // 过滤掉空消息
  const validMessages = messages.filter((m) => m.content.trim().length > 0)

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col">
      {/* 顶部标题栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-primary" />
          <h2 className="text-[15px] font-semibold text-foreground">时间线视图</h2>
          <span className="text-[12px] text-muted-foreground ml-2">
            共 {validMessages.length} 条消息
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-foreground"
        >
          <X size={18} />
        </Button>
      </div>

      {/* 时间线主体 */}
      <ScrollArea className="flex-1">
        <div className="max-w-[780px] mx-auto px-6 py-8">
          {validMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Clock size={40} className="mb-3 opacity-30" />
              <p className="text-[13px]">暂无消息</p>
            </div>
          ) : (
            <div className="relative">
              {/* 垂直连接线 */}
              <div className="absolute left-[60px] top-0 bottom-0 w-px bg-border" />

              {validMessages.map((msg, i) => (
                <div key={msg.id} className="flex gap-4 mb-6">
                  {/* 左侧时间标签 */}
                  <div className="w-[60px] flex-shrink-0 text-right pt-0.5">
                    {/* 日期变化时显示日期标签 */}
                    {(i === 0 || !isSameDay(msg.timestamp, validMessages[i - 1].timestamp)) && (
                      <div className="text-[10px] text-primary font-medium mb-0.5">
                        {formatDateSeparator(msg.timestamp)}
                      </div>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>

                  {/* 时间轴节点 */}
                  <div className="relative z-10 flex-shrink-0 pt-1">
                    <div
                      className={cn(
                        'w-3 h-3 rounded-full border-2',
                        msg.role === 'user'
                          ? 'bg-blue-400/80 border-blue-400/50'
                          : 'bg-purple-400/80 border-purple-400/50'
                      )}
                    />
                  </div>

                  {/* 右侧消息卡片 */}
                  <Card className="flex-1 max-w-[600px] transition-colors hover:border-primary/30">
                    <CardContent className="p-3">
                      {/* 卡片头部：角色 + token */}
                      <div className="flex items-center gap-2 mb-2">
                        {msg.role === 'user' ? (
                          <User size={14} className="text-blue-400/80" />
                        ) : (
                          <Bot size={14} className="text-purple-400/80" />
                        )}
                        <span className="text-[12px] font-medium text-foreground">
                          {msg.role === 'user' ? '用户' : 'Claude'}
                        </span>
                        {msg.tokenUsage && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {msg.tokenUsage.inputTokens + msg.tokenUsage.outputTokens} tokens
                          </span>
                        )}
                      </div>

                      {/* 消息内容预览 */}
                      <div className="text-[13px] text-foreground line-clamp-4 prose prose-sm prose-invert max-w-none [&_pre]:bg-accent/50 [&_pre]:p-2 [&_pre]:rounded [&_code]:text-[12px] [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content.slice(0, 500)}
                        </ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
