import { useState, useEffect, useCallback } from 'react'
import { Settings2, X, Sparkles, Eraser } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface SystemPromptDialogProps {
  open: boolean
  onClose: () => void
  sessionId: string
  currentPrompt: string
  onSave: (prompt: string) => void
}

/** 预设模板 */
const PRESET_TEMPLATES = [
  {
    label: '代码专家',
    prompt: '你是一个资深软件工程师，擅长写高质量、可维护的代码。请用简洁的方式回答问题。',
  },
  {
    label: '翻译助手',
    prompt: '你是一个专业翻译，擅长中英文互译。请保持原文的语气和风格。',
  },
  {
    label: '学习导师',
    prompt: '你是一个耐心的老师，善于用简单易懂的方式解释复杂概念。请循序渐进地教学。',
  },
]

export default function SystemPromptDialog({
  open,
  onClose,
  currentPrompt,
  onSave,
}: SystemPromptDialogProps) {
  const [draft, setDraft] = useState(currentPrompt)

  // 每次打开时同步外部值
  useEffect(() => {
    if (open) {
      setDraft(currentPrompt)
    }
  }, [open, currentPrompt])

  // Escape 关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  const handleSave = () => {
    onSave(draft.trim())
    onClose()
  }

  const handleClear = () => {
    setDraft('')
  }

  const handleApplyTemplate = (prompt: string) => {
    setDraft(prompt)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <Card className="w-full max-w-lg rounded-2xl flex flex-col gap-0 py-0 overflow-hidden shadow-2xl animate-fade-in">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Settings2 size={18} className="text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">系统提示词</h2>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="text-foreground"
          >
            <X size={14} />
          </Button>
        </div>

        {/* 内容区域 */}
        <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* 说明文字 */}
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            自定义系统提示词会在每次对话中发送给 Claude，用于设定回答的风格和行为。
          </p>

          {/* 输入框 */}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="输入自定义指令，Claude 会在每次对话中遵循这些指令..."
            rows={5}
            className="w-full rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground placeholder:opacity-50 resize-none px-3.5 py-3 outline-none text-[13px] leading-[1.7] focus:border-primary transition-colors"
          />

          <Separator />

          {/* 预设模板 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Sparkles size={13} className="text-muted-foreground" />
              <span className="text-[12px] font-medium text-muted-foreground">快速模板</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_TEMPLATES.map((tpl) => (
                <Button
                  key={tpl.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyTemplate(tpl.prompt)}
                  className="text-[12px] h-7 px-3"
                >
                  {tpl.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-[12px] text-foreground gap-1.5"
          >
            <Eraser size={13} />
            清空
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-[12px]"
            >
              取消
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              className="text-[12px]"
            >
              保存
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
