import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Keyboard, X, Search, Pencil, Check, RotateCcw, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

interface ShortcutItem {
  keys: string[]
  description: string
  /** 唯一标识，用于自定义绑定的 key */
  id: string
}

interface ShortcutCategory {
  name: string
  shortcuts: ShortcutItem[]
}

const STORAGE_KEY = 'claude-code-chat-keybindings'

/** 默认快捷键定义（含唯一 id） */
const DEFAULT_SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    name: '导航',
    shortcuts: [
      { id: 'nav-new-chat', keys: ['Ctrl', 'N'], description: '新建对话' },
      { id: 'nav-toggle-sidebar', keys: ['Ctrl', 'B'], description: '切换侧边栏' },
      { id: 'nav-history', keys: ['Alt', 'H'], description: '会话历史' },
      { id: 'nav-command-palette', keys: ['Ctrl', 'K'], description: '全局命令面板' },
      { id: 'nav-focus-input', keys: ['Ctrl', 'L'], description: '聚焦输入框' },
      { id: 'nav-settings', keys: ['Ctrl', ','], description: '打开设置' },
    ],
  },
  {
    name: '编辑',
    shortcuts: [
      { id: 'edit-send', keys: ['Ctrl', 'Enter'], description: '发送消息' },
      { id: 'edit-newline', keys: ['Shift', 'Enter'], description: '换行' },
      { id: 'edit-prev-history', keys: ['↑'], description: '上一条输入历史' },
      { id: 'edit-next-history', keys: ['↓'], description: '下一条输入历史' },
      { id: 'edit-bold', keys: ['Ctrl', 'B'], description: '粗体（输入框内）' },
      { id: 'edit-italic', keys: ['Ctrl', 'I'], description: '斜体（输入框内）' },
      { id: 'edit-code', keys: ['Ctrl', 'Shift', 'K'], description: '代码块（输入框内）' },
    ],
  },
  {
    name: '工具',
    shortcuts: [
      { id: 'tool-global-search', keys: ['Ctrl', 'Shift', 'F'], description: '全局搜索' },
      { id: 'tool-session-search', keys: ['Ctrl', 'F'], description: '会话内搜索' },
      { id: 'tool-prompt-template', keys: ['Ctrl', 'P'], description: 'Prompt 模板' },
      { id: 'tool-system-prompt', keys: ['Ctrl', 'Shift', 'S'], description: '系统提示词' },
      { id: 'tool-model-compare', keys: ['Ctrl', 'Shift', 'M'], description: '模型对比' },
      { id: 'tool-export', keys: ['Ctrl', 'E'], description: '导出对话' },
      { id: 'tool-bookmarks', keys: ['Ctrl', 'J'], description: '查看书签' },
      { id: 'tool-shortcuts-help', keys: ['Ctrl', '/'], description: '快捷键帮助' },
      { id: 'tool-shortcuts-help-alt', keys: ['?'], description: '快捷键帮助' },
    ],
  },
  {
    name: '视图',
    shortcuts: [
      { id: 'view-toggle-theme', keys: ['Alt', 'D'], description: '切换主题' },
      { id: 'view-zen-mode', keys: ['Ctrl', 'Shift', 'Z'], description: '焦点模式' },
      { id: 'view-timeline', keys: ['Ctrl', 'Shift', 'T'], description: '时间线视图' },
      { id: 'view-escape', keys: ['Escape'], description: '退出焦点模式 / 关闭面板' },
    ],
  },
]

/** 从 localStorage 加载自定义键绑定 */
function loadCustomBindings(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, string[]>
      }
    }
  } catch {
    // ignore
  }
  return {}
}

/** 保存自定义键绑定到 localStorage */
function saveCustomBindings(bindings: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings))
  } catch {
    // ignore
  }
}

/** 将快捷键数组序列化为可比较的字符串 */
function keysToString(keys: string[]): string {
  return keys.map(k => k.toLowerCase()).sort().join('+')
}

/** 将 KeyboardEvent 中按下的键转换为可读的按键名 */
function eventToKeys(e: KeyboardEvent): string[] {
  const keys: string[] = []
  if (e.ctrlKey || e.metaKey) keys.push('Ctrl')
  if (e.shiftKey) keys.push('Shift')
  if (e.altKey) keys.push('Alt')

  // 排除修饰键本身
  const modKeys = new Set(['Control', 'Shift', 'Alt', 'Meta'])
  if (!modKeys.has(e.key)) {
    // 特殊键名映射
    const keyMap: Record<string, string> = {
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'Enter': 'Enter',
      'Escape': 'Escape',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      'Tab': 'Tab',
      ' ': 'Space',
    }
    const keyName = keyMap[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key)
    keys.push(keyName)
  }

  return keys
}

/** 合并默认快捷键和自定义绑定 */
function mergeCategories(customBindings: Record<string, string[]>): ShortcutCategory[] {
  return DEFAULT_SHORTCUT_CATEGORIES.map(cat => ({
    ...cat,
    shortcuts: cat.shortcuts.map(s => ({
      ...s,
      keys: customBindings[s.id] || s.keys,
    })),
  }))
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-[22px] px-1.5 rounded-md text-[11px] font-medium bg-accent border border-border text-foreground shadow-[0_1px_0_1px_rgba(0,0,0,0.3)] font-mono">
      {children}
    </kbd>
  )
}

function ShortcutRow({
  keys,
  description,
  id,
  isCustomized,
  onEdit,
}: ShortcutItem & { isCustomized: boolean; onEdit: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5 group/row">
      <span className="text-[13px] text-muted-foreground">{description}</span>
      <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
        <div className="flex items-center gap-1">
          {keys.map((key, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-[11px] text-muted-foreground">+</span>}
              <Kbd>{key}</Kbd>
            </span>
          ))}
        </div>
        {isCustomized && (
          <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" title="已自定义" />
        )}
        <button
          onClick={() => onEdit(id)}
          className="opacity-0 group-hover/row:opacity-100 transition-opacity duration-150 p-0.5 rounded hover:bg-accent text-foreground flex-shrink-0"
          title="编辑快捷键"
          aria-label={`编辑 ${description} 的快捷键`}
        >
          <Pencil size={11} />
        </button>
      </div>
    </div>
  )
}

/** 录入模式组件 */
function KeyRecorder({
  shortcutId,
  description,
  currentKeys,
  allShortcuts,
  onConfirm,
  onCancel,
}: {
  shortcutId: string
  description: string
  currentKeys: string[]
  allShortcuts: ShortcutItem[]
  onConfirm: (id: string, newKeys: string[]) => void
  onCancel: () => void
}) {
  const [capturedKeys, setCapturedKeys] = useState<string[] | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)
  const recorderRef = useRef<HTMLDivElement>(null)

  // 捕获键盘事件
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const keys = eventToKeys(e)
      // 只按了修饰键时忽略
      if (keys.length === 0) return

      setCapturedKeys(keys)

      // 冲突检测
      const newKeyStr = keysToString(keys)
      const conflicting = allShortcuts.find(
        s => s.id !== shortcutId && keysToString(s.keys) === newKeyStr
      )
      setConflict(conflicting ? conflicting.description : null)
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [shortcutId, allShortcuts])

  // 自动聚焦
  useEffect(() => {
    recorderRef.current?.focus()
  }, [])

  return (
    <div
      ref={recorderRef}
      tabIndex={-1}
      className="flex flex-col gap-2 py-2 px-3 rounded-lg bg-accent/50 border border-primary/30 outline-none"
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-foreground font-medium">{description}</span>
      </div>

      <div className="flex items-center gap-2">
        {capturedKeys ? (
          <div className="flex items-center gap-1">
            {capturedKeys.map((key, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-[11px] text-muted-foreground">+</span>}
                <Kbd>{key}</Kbd>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[12px] text-muted-foreground animate-pulse">按下新的快捷键...</span>
        )}
      </div>

      {conflict && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-400/80">
          <AlertTriangle size={12} />
          <span>与「{conflict}」冲突</span>
        </div>
      )}

      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="ghost"
          size="xs"
          onClick={onCancel}
          className="text-[11px] text-foreground"
        >
          取消
        </Button>
        <Button
          variant="default"
          size="xs"
          onClick={() => {
            if (capturedKeys && capturedKeys.length > 0) {
              onConfirm(shortcutId, capturedKeys)
            }
          }}
          disabled={!capturedKeys || capturedKeys.length === 0}
          className="text-[11px]"
        >
          <Check size={11} className="mr-1" />
          确认
        </Button>
      </div>
    </div>
  )
}

export default function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [customBindings, setCustomBindings] = useState<Record<string, string[]>>(loadCustomBindings)
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 录入模式下不处理 Escape 关闭对话框
      if (editingId) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [onClose, editingId]
  )

  useEffect(() => {
    if (!open) return
    setSearchQuery('')
    setEditingId(null)
    setCustomBindings(loadCustomBindings())
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  /** 合并后的快捷键分类 */
  const mergedCategories = useMemo(
    () => mergeCategories(customBindings),
    [customBindings]
  )

  /** 所有快捷键（扁平列表，用于冲突检测） */
  const allShortcuts = useMemo(
    () => mergedCategories.flatMap(c => c.shortcuts),
    [mergedCategories]
  )

  /** 自定义绑定的 id 集合 */
  const customizedIds = useMemo(
    () => new Set(Object.keys(customBindings)),
    [customBindings]
  )

  const hasCustomBindings = customizedIds.size > 0

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return mergedCategories

    const query = searchQuery.toLowerCase().trim()
    return mergedCategories.map((category) => ({
      ...category,
      shortcuts: category.shortcuts.filter(
        (s) =>
          s.description.toLowerCase().includes(query) ||
          s.keys.some((k) => k.toLowerCase().includes(query))
      ),
    })).filter((category) => category.shortcuts.length > 0)
  }, [searchQuery, mergedCategories])

  const totalCount = useMemo(
    () => filteredCategories.reduce((sum, c) => sum + c.shortcuts.length, 0),
    [filteredCategories]
  )

  /** 确认自定义快捷键 */
  const handleConfirmEdit = useCallback((id: string, newKeys: string[]) => {
    // 检查是否和默认值相同
    const defaultShortcut = DEFAULT_SHORTCUT_CATEGORIES.flatMap(c => c.shortcuts).find(s => s.id === id)
    const isDefault = defaultShortcut && keysToString(defaultShortcut.keys) === keysToString(newKeys)

    const next = { ...customBindings }
    if (isDefault) {
      // 和默认值相同则移除自定义
      delete next[id]
    } else {
      next[id] = newKeys
    }
    setCustomBindings(next)
    saveCustomBindings(next)
    setEditingId(null)
    toast.success('快捷键已更新')
  }, [customBindings])

  /** 恢复所有默认 */
  const handleResetAll = useCallback(() => {
    setCustomBindings({})
    saveCustomBindings({})
    setEditingId(null)
    toast.success('已恢复所有默认快捷键')
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (editingId) {
            setEditingId(null)
          } else {
            onClose()
          }
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="键盘快捷键设置"
    >
      <Card className="w-full max-w-lg rounded-2xl flex flex-col gap-0 py-0 overflow-hidden shadow-2xl animate-fade-in">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Keyboard size={18} className="text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">键盘快捷键</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {hasCustomBindings && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handleResetAll}
                className="text-[11px] text-foreground gap-1"
                title="恢复所有默认快捷键"
              >
                <RotateCcw size={12} />
                恢复默认
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="text-foreground"
              aria-label="关闭"
            >
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="px-5 pt-3 pb-1">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="搜索快捷键..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus={!editingId}
              className="w-full h-8 pl-8 pr-3 rounded-lg text-[13px] bg-accent/50 border border-border/50 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors"
              aria-label="搜索快捷键"
            />
          </div>
        </div>

        {/* 快捷键分类列表 */}
        <div className="px-5 py-3 max-h-[60vh] overflow-y-auto">
          {filteredCategories.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[13px] text-muted-foreground">没有找到匹配的快捷键</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              {filteredCategories.map((category) => (
                <div key={category.name}>
                  <h3 className="text-[12px] font-semibold text-primary/80 uppercase tracking-wider mb-2 pb-1 border-b border-border/50">
                    {category.name}
                  </h3>
                  <div className="space-y-0.5">
                    {category.shortcuts.map((shortcut) =>
                      editingId === shortcut.id ? (
                        <KeyRecorder
                          key={shortcut.id}
                          shortcutId={shortcut.id}
                          description={shortcut.description}
                          currentKeys={shortcut.keys}
                          allShortcuts={allShortcuts}
                          onConfirm={handleConfirmEdit}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <ShortcutRow
                          key={shortcut.id}
                          {...shortcut}
                          isCustomized={customizedIds.has(shortcut.id)}
                          onEdit={setEditingId}
                        />
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            共 {totalCount} 个快捷键
            {hasCustomBindings && (
              <span className="ml-2">
                · {customizedIds.size} 个已自定义
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            按 <Kbd>Esc</Kbd> 关闭
          </p>
        </div>
      </Card>
    </div>
  )
}

/** 导出合并后的快捷键，供其他组件使用 */
export function getActiveKeybindings(): ShortcutItem[] {
  const custom = loadCustomBindings()
  return mergeCategories(custom).flatMap(c => c.shortcuts)
}

/** 导出默认快捷键分类，供外部参考 */
export { DEFAULT_SHORTCUT_CATEGORIES }
