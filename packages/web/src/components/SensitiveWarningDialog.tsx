/**
 * 敏感信息警告弹窗组件
 * 在检测到用户消息中包含敏感信息时弹出，提供遮罩发送、原文发送和取消三个选项
 */

import { useCallback, useEffect } from 'react'
import type { SensitiveMatch } from '@/utils/sensitiveDetector'
import { maskSensitive } from '@/utils/sensitiveDetector'

interface SensitiveWarningDialogProps {
  /** 是否显示弹窗 */
  open: boolean
  /** 关闭弹窗回调 */
  onClose: () => void
  /** 检测到的敏感信息匹配列表 */
  matches: SensitiveMatch[]
  /** 原始消息文本 */
  originalText: string
  /** 确认以原文发送 */
  onSendOriginal: () => void
  /** 遮罩后发送 */
  onSendMasked: (maskedText: string) => void
}

/** 敏感信息类型对应的颜色样式 */
const TYPE_COLORS: Record<SensitiveMatch['type'], { bg: string; text: string; border: string }> = {
  api_key: { bg: 'rgba(239, 68, 68, 0.15)', text: '#fca5a5', border: '#dc2626' },
  password: { bg: 'rgba(249, 115, 22, 0.15)', text: '#fdba74', border: '#ea580c' },
  private_key: { bg: 'rgba(239, 68, 68, 0.15)', text: '#fca5a5', border: '#dc2626' },
  phone: { bg: 'rgba(234, 179, 8, 0.15)', text: '#fde047', border: '#ca8a04' },
  id_card: { bg: 'rgba(234, 179, 8, 0.15)', text: '#fde047', border: '#ca8a04' },
  email_password: { bg: 'rgba(249, 115, 22, 0.15)', text: '#fdba74', border: '#ea580c' },
  token: { bg: 'rgba(249, 115, 22, 0.15)', text: '#fdba74', border: '#ea580c' },
  connection_string: { bg: 'rgba(168, 85, 247, 0.15)', text: '#d8b4fe', border: '#9333ea' },
}

export default function SensitiveWarningDialog({
  open,
  onClose,
  matches,
  originalText,
  onSendOriginal,
  onSendMasked,
}: SensitiveWarningDialogProps) {
  // ESC 键关闭弹窗
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // 遮罩后发送
  const handleSendMasked = useCallback(() => {
    const maskedText = maskSensitive(originalText, matches)
    onSendMasked(maskedText)
  }, [originalText, matches, onSendMasked])

  if (!open) return null

  return (
    // 遮罩层
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        // 点击遮罩层外部关闭
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* 弹窗主体 */}
      <div
        className="mx-4 w-full max-w-lg rounded-xl border shadow-2xl"
        style={{
          backgroundColor: 'var(--color-bg-secondary, #1a1a2e)',
          borderColor: 'var(--color-border, #333)',
          animation: 'sensitiveDialogFadeIn 0.2s ease-out',
        }}
      >
        {/* 标题栏 */}
        <div
          className="flex items-center gap-3 rounded-t-xl px-6 py-4"
          style={{
            borderBottom: '1px solid var(--color-border, #333)',
            background: 'rgba(239, 68, 68, 0.08)',
          }}
        >
          <span className="text-2xl" role="img" aria-label="警告">
            &#x26A0;&#xFE0F;
          </span>
          <div>
            <h3
              className="text-base font-semibold"
              style={{ color: 'var(--color-text-primary, #f5f5f5)' }}
            >
              检测到敏感信息
            </h3>
            <p
              className="mt-0.5 text-xs"
              style={{ color: 'var(--color-text-secondary, #a3a3a3)' }}
            >
              您的消息中包含 {matches.length} 处疑似敏感信息
            </p>
          </div>
        </div>

        {/* 检测结果列表 */}
        <div className="max-h-64 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            {matches.map((match, index) => {
              const colors = TYPE_COLORS[match.type] || TYPE_COLORS.api_key
              return (
                <div
                  key={`${match.startIndex}-${match.endIndex}-${index}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{
                    backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}33`,
                  }}
                >
                  {/* 类型标签 */}
                  <span
                    className="shrink-0 rounded px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${colors.border}33`,
                      color: colors.text,
                      border: `1px solid ${colors.border}66`,
                    }}
                  >
                    {match.label}
                  </span>
                  {/* 遮罩后的值 */}
                  <code
                    className="min-w-0 flex-1 truncate font-mono text-xs"
                    style={{ color: colors.text }}
                    title={match.value}
                  >
                    {match.value}
                  </code>
                </div>
              )
            })}
          </div>
        </div>

        {/* 操作按钮 */}
        <div
          className="flex flex-col gap-2 rounded-b-xl px-6 py-4 sm:flex-row sm:justify-end"
          style={{ borderTop: '1px solid var(--color-border, #333)' }}
        >
          {/* 取消 */}
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--color-bg-tertiary, #262626)',
              color: 'var(--color-text-secondary, #a3a3a3)',
              border: '1px solid var(--color-border, #333)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-hover, #333)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary, #262626)'
            }}
          >
            取消
          </button>

          {/* 确认原文发送（橙色警告） */}
          <button
            onClick={onSendOriginal}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'rgba(249, 115, 22, 0.2)',
              color: '#fdba74',
              border: '1px solid rgba(249, 115, 22, 0.4)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.35)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.2)'
            }}
          >
            确认原文发送
          </button>

          {/* 遮罩后发送（绿色安全首选） */}
          <button
            onClick={handleSendMasked}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.25)',
              color: '#86efac',
              border: '1px solid rgba(34, 197, 94, 0.5)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.25)'
            }}
          >
            遮罩后发送
          </button>
        </div>

        {/* 底部提示 */}
        <div
          className="rounded-b-xl px-6 py-3 text-center text-xs"
          style={{
            color: 'var(--color-text-tertiary, #666)',
            borderTop: '1px solid var(--color-border, #333)',
            background: 'rgba(0, 0, 0, 0.15)',
          }}
        >
          建议在发送前检查并移除敏感信息
        </div>
      </div>

      {/* 弹窗动画样式 */}
      <style>{`
        @keyframes sensitiveDialogFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
