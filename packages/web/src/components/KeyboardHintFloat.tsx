import { useState, useEffect, useCallback, useRef } from 'react'
import { Keyboard, X } from 'lucide-react'
import { useSettingsStore } from '../stores/settingsStore'
import { cn } from '@/lib/utils'

/** 浮动快捷键提示的 hint ID，用于 dismissedHints 持久化 */
const HINT_ID = 'keyboard-shortcuts-float'

/** 速查表中展示的常用快捷键 */
const SHORTCUT_ITEMS = [
  { keys: ['Ctrl', 'K'], description: '命令面板' },
  { keys: ['Ctrl', 'F'], description: '搜索消息' },
  { keys: ['Ctrl', 'Shift', 'S'], description: '代码片段' },
  { keys: ['Ctrl', 'Shift', 'Z'], description: '焦点模式' },
  { keys: ['Ctrl', 'N'], description: '新建会话' },
  { keys: ['/'], description: '斜杠命令' },
  { keys: ['Esc'], description: '关闭弹窗' },
]

/** 快捷键标签 */
function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded text-[10px] font-medium bg-accent border border-border text-foreground shadow-[0_1px_0_0.5px_rgba(0,0,0,0.2)] font-mono leading-none">
      {children}
    </kbd>
  )
}

/**
 * 浮动快捷键帮助提示按钮
 * - 显示在页面右下角（移动端隐藏）
 * - 点击展开常用快捷键速查面板
 * - 支持 Esc 关闭面板
 * - 用户可通过 dismissedHints 永久隐藏
 */
export default function KeyboardHintFloat() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const dismissedHints = useSettingsStore((s) => s.dismissedHints)
  const dismissHint = useSettingsStore((s) => s.dismissHint)

  /** 该提示是否已被用户永久关闭 */
  const isDismissed = dismissedHints.includes(HINT_ID)

  /** 切换面板显示 */
  const togglePanel = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  /** 关闭面板 */
  const closePanel = useCallback(() => {
    setOpen(false)
  }, [])

  /** 永久隐藏此浮动按钮 */
  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      dismissHint(HINT_ID)
      setOpen(false)
    },
    [dismissHint]
  )

  // Esc 键关闭面板
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closePanel()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [open, closePanel])

  // 点击面板外部关闭
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        closePanel()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, closePanel])

  // 已被永久关闭则不渲染
  if (isDismissed) return null

  return (
    // 移动端隐藏（hidden md:block）
    <div className="hidden md:block fixed bottom-6 right-6 z-40">
      {/* 速查面板 */}
      {open && (
        <div
          ref={panelRef}
          className={cn(
            'absolute bottom-12 right-0 w-[260px] rounded-xl border border-border bg-card shadow-xl',
            'animate-in fade-in-0 slide-in-from-bottom-2 duration-200'
          )}
          role="dialog"
          aria-label="快捷键速查表"
        >
          {/* 面板头部 */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Keyboard size={14} className="text-primary" />
              <span className="text-[12px] font-semibold text-foreground">快捷键速查</span>
            </div>
            <button
              onClick={closePanel}
              className="p-0.5 rounded-md text-foreground hover:bg-accent transition-colors"
              aria-label="关闭速查面板"
            >
              <X size={12} />
            </button>
          </div>

          {/* 快捷键列表 */}
          <div className="px-3.5 py-2 space-y-1">
            {SHORTCUT_ITEMS.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-1"
              >
                <span className="text-[12px] text-muted-foreground">{item.description}</span>
                <div className="flex items-center gap-0.5 ml-3 flex-shrink-0">
                  {item.keys.map((key, i) => (
                    <span key={i} className="flex items-center gap-0.5">
                      {i > 0 && (
                        <span className="text-[9px] text-muted-foreground opacity-40">+</span>
                      )}
                      <Kbd>{key}</Kbd>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 面板底部 */}
          <div className="flex items-center justify-between px-3.5 py-2 border-t border-border">
            <button
              onClick={handleDismiss}
              className="text-[10px] text-foreground/60 transition-colors"
            >
              不再显示
            </button>
            <span className="text-[10px] text-muted-foreground/60">
              按 <Kbd>?</Kbd> 查看全部
            </span>
          </div>
        </div>
      )}

      {/* 浮动按钮 */}
      <button
        ref={buttonRef}
        onClick={togglePanel}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          'bg-card border border-border shadow-lg',
          'text-foreground hover:border-primary/40',
          'transition-all duration-200 hover:scale-105',
          open && 'border-primary/40 text-foreground bg-accent'
        )}
        title="快捷键提示"
        aria-label="快捷键提示"
        aria-expanded={open}
      >
        <Keyboard size={18} />
      </button>
    </div>
  )
}
