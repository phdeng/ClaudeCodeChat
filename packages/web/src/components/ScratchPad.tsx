import { StickyNote, Minimize2, X, Copy, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useScratchPadStore } from '../stores/scratchPadStore'
import { toast } from 'sonner'

interface ScratchPadProps {
  onCopyToInput?: (content: string) => void
}

export default function ScratchPad({ onCopyToInput }: ScratchPadProps) {
  const { content, isOpen, isMinimized, setContent, toggleOpen, setMinimized, clear } =
    useScratchPadStore()

  const charCount = content.length

  const handleCopyToInput = () => {
    if (!content.trim()) {
      toast.info('笔记内容为空')
      return
    }
    if (onCopyToInput) {
      onCopyToInput(content)
    }
    navigator.clipboard.writeText(content).then(() => {
      toast.success('已复制到剪贴板')
    })
  }

  const handleClear = () => {
    if (!content.trim()) return
    if (window.confirm('确定要清空笔记内容吗？')) {
      clear()
      toast.success('笔记已清空')
    }
  }

  // 最小化或未展开 — 只显示浮动按钮
  if (!isOpen || isMinimized) {
    return (
      <Button
        variant="outline"
        size="icon"
        className={cn(
          'fixed z-50 size-10 rounded-full shadow-lg',
          'bottom-20 right-4',
          'bg-card border-border hover:bg-accent'
        )}
        onClick={() => {
          if (isMinimized) {
            setMinimized(false)
            if (!isOpen) toggleOpen()
          } else {
            toggleOpen()
          }
        }}
        title="快速笔记"
      >
        <StickyNote className="size-5" />
        {/* 内容非空时显示蓝色圆点指示 */}
        {content.trim().length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-blue-500" />
        )}
      </Button>
    )
  }

  // 展开状态 — 显示浮动面板
  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col',
        'bottom-20 right-4',
        'w-80 h-[400px]',
        'bg-card border border-border rounded-lg shadow-2xl',
        'animate-fade-in'
      )}
    >
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <StickyNote className="size-4 text-muted-foreground" />
          <span>快速笔记</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setMinimized(true)}
            title="最小化"
          >
            <Minimize2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={toggleOpen}
            title="关闭"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 编辑区 */}
      <div className="flex-1 overflow-hidden p-2">
        <textarea
          className="bg-transparent border-0 outline-none resize-none w-full h-full text-sm"
          placeholder="在这里记录想法、代码片段、提示词草稿..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      {/* 底部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border">
        <span className="text-xs text-muted-foreground">
          {charCount} 字
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleCopyToInput}
            title="复制到输入框"
          >
            <Copy className="size-3.5" />
            <span>复制</span>
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={handleClear}
            title="清空"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            <span>清空</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
