import { useEffect, useRef } from 'react'
import { CheckCircle, XCircle, Info, AlertTriangle, Trash2, CheckCheck } from 'lucide-react'
import { useNotificationStore, type Notification } from '../stores/notificationStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface NotificationCenterProps {
  open: boolean
  onClose: () => void
}

/** 通知类型对应的图标和颜色 */
const TYPE_CONFIG: Record<Notification['type'], { Icon: typeof CheckCircle; color: string }> = {
  success: { Icon: CheckCircle, color: 'text-green-400/80' },
  error: { Icon: XCircle, color: 'text-red-400/80' },
  info: { Icon: Info, color: 'text-blue-400/80' },
  warning: { Icon: AlertTriangle, color: 'text-amber-400/80' },
}

/** 格式化相对时间 */
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

export default function NotificationCenter({ open, onClose }: NotificationCenterProps) {
  const { notifications, markAsRead, markAllAsRead, clearAll, unreadCount } = useNotificationStore()
  const panelRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // 延迟添加监听，避免触发按钮的点击事件导致立即关闭
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onClose])

  // Escape 关闭
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const unread = unreadCount()

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-1 z-50 w-[360px] max-h-[480px] flex flex-col rounded-lg border border-border bg-card shadow-lg"
    >
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-foreground">通知</span>
          {unread > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {unread} 条未读
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={markAllAsRead}
            disabled={unread === 0}
            className="text-[12px] text-foreground gap-1"
          >
            <CheckCheck size={12} />
            全部已读
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={clearAll}
            disabled={notifications.length === 0}
            className="text-[12px] text-foreground gap-1"
          >
            <Trash2 size={12} />
            清空
          </Button>
        </div>
      </div>

      {/* 通知列表 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Info size={32} className="mb-2 opacity-30" />
            <span className="text-[13px]">暂无通知</span>
          </div>
        ) : (
          notifications.map((n) => {
            const { Icon, color } = TYPE_CONFIG[n.type]
            return (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer',
                  !n.read && 'bg-accent/10'
                )}
                onClick={() => {
                  if (!n.read) markAsRead(n.id)
                }}
              >
                {/* 未读标记 */}
                <div className="flex-shrink-0 w-1.5 pt-1.5">
                  {!n.read && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400/80" />
                  )}
                </div>

                {/* 类型图标 */}
                <Icon size={16} className={cn('flex-shrink-0 mt-0.5', color)} />

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      'text-[13px] truncate',
                      n.read ? 'text-foreground' : 'text-foreground font-medium'
                    )}>
                      {n.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">
                      {formatRelativeTime(n.timestamp)}
                    </span>
                  </div>
                  {n.message && (
                    <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
