import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Maximize2,
  X,
  ClipboardPaste,
  Download,
} from 'lucide-react'
import { codeToHtml } from 'shiki'
import { toast } from 'sonner'
import { useSnippetStore } from '@/stores/snippetStore'
import { useThemeStore } from '@/stores/themeStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ============================================================
// useCopyToClipboard Hook - 复制到剪贴板
// ============================================================

/** 复制到剪贴板的 hook */
export function useCopyToClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), timeout)
    })
  }, [timeout])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { copied, copy }
}

// ============================================================
// InlineDiffView - 内联 Diff 视图组件（LCS 算法）
// ============================================================

/** 内联 Diff 视图组件：紧凑地显示在代码块下方，绿色=新增，红色=删除 */
export function InlineDiffView({ originalCode, modifiedCode }: { originalCode: string; modifiedCode: string }) {
  const diffLines = useMemo(() => {
    const oldLines = originalCode.split('\n')
    const newLines = modifiedCode.split('\n')
    const m = oldLines.length
    const n = newLines.length

    // LCS 动态规划
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
        }
      }
    }

    // 回溯
    const result: Array<{ type: 'unchanged' | 'added' | 'removed'; content: string; oldNo: number | null; newNo: number | null }> = []
    let i = m
    let j = n
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        result.push({ type: 'unchanged', content: oldLines[i - 1], oldNo: i, newNo: j })
        i--; j--
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.push({ type: 'added', content: newLines[j - 1], oldNo: null, newNo: j })
        j--
      } else {
        result.push({ type: 'removed', content: oldLines[i - 1], oldNo: i, newNo: null })
        i--
      }
    }
    result.reverse()
    return result
  }, [originalCode, modifiedCode])

  const stats = useMemo(() => {
    let added = 0, removed = 0
    for (const line of diffLines) {
      if (line.type === 'added') added++
      if (line.type === 'removed') removed++
    }
    return { added, removed }
  }, [diffLines])

  if (stats.added === 0 && stats.removed === 0) {
    return (
      <div className="px-3 py-2 text-[11px] text-muted-foreground/60 border-t border-border/50 bg-card/30">
        内容完全相同，无差异
      </div>
    )
  }

  return (
    <div className="border-t border-border/50">
      {/* Diff 统计摘要 */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-card/30 border-b border-border/30">
        <GitBranch size={11} className="text-muted-foreground/60" />
        <span className="text-[10px] text-muted-foreground/60 font-medium">变更对比</span>
        <span className="flex items-center gap-0.5 text-[10px] text-green-400">
          +{stats.added}
        </span>
        <span className="flex items-center gap-0.5 text-[10px] text-red-400">
          -{stats.removed}
        </span>
      </div>
      {/* Diff 行 */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto font-mono text-[11px] leading-[1.6]">
        {diffLines.map((line, index) => (
          <div
            key={index}
            className={cn(
              "flex",
              line.type === 'removed' && "bg-red-500/10",
              line.type === 'added' && "bg-green-500/10"
            )}
          >
            {/* 旧行号 */}
            <div className="flex-shrink-0 w-[40px] text-right pr-1.5 py-0 select-none text-muted-foreground/40 text-[10px] border-r border-border/30">
              {line.oldNo ?? ''}
            </div>
            {/* 新行号 */}
            <div className="flex-shrink-0 w-[40px] text-right pr-1.5 py-0 select-none text-muted-foreground/40 text-[10px] border-r border-border/30">
              {line.newNo ?? ''}
            </div>
            {/* 差异标记 */}
            <div className="flex-shrink-0 w-[20px] text-center py-0 select-none font-bold text-[10px]">
              {line.type === 'removed' && <span className="text-red-400">-</span>}
              {line.type === 'added' && <span className="text-green-400">+</span>}
            </div>
            {/* 内容 */}
            <div
              className={cn(
                'flex-1 py-0 px-2 whitespace-pre-wrap break-all',
                line.type === 'removed' && 'text-red-400',
                line.type === 'added' && 'text-green-400',
                line.type === 'unchanged' && 'text-foreground/70'
              )}
            >
              {line.content || '\u00A0'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// CodeBlock - 代码块组件（语法高亮、复制、全屏、折叠、Diff、保存片段）
// ============================================================

/** 代码块组件：带语言标签、复制按钮、折叠、全屏查看和 Shiki 语法高亮 */
function CodeBlock({ children, className, filePath, previousCode }: { children?: React.ReactNode; className?: string; filePath?: string; previousCode?: string }) {
  const { copied, copy } = useCopyToClipboard()
  // 用于"复制为引用"的独立状态
  const { copied: quoteCopied, copy: quoteCopy } = useCopyToClipboard()

  const codeString = String(children ?? '').replace(/\n$/, '')

  // 从 className 提取语言名称（格式为 language-xxx）
  const langMatch = className?.match(/language-(\w+)/)
  const language = langMatch ? langMatch[1] : null

  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)
  // 长代码折叠状态（每个实例独立）
  const [collapsed, setCollapsed] = useState(true)
  // 全屏查看状态
  const [fullscreen, setFullscreen] = useState(false)
  // Diff 视图状态（当有 previousCode 时可切换）
  const [showDiff, setShowDiff] = useState(false)
  const hasDiff = typeof previousCode === 'string'

  // 计算代码行数，判断是否需要折叠
  const lines = codeString.split('\n')
  const isLong = lines.length > 20
  const shouldCollapse = isLong && collapsed

  // Shiki 主题：使用 themeStore 中用户选择的代码高亮主题
  const shikiTheme = useThemeStore((s) => s.resolvedCodeTheme())

  useEffect(() => {
    if (!codeString || !language) return
    let cancelled = false
    codeToHtml(codeString, {
      lang: language,
      theme: shikiTheme,
    }).then((html) => {
      if (!cancelled) setHighlightedHtml(html)
    }).catch(() => {
      // 高亮失败时保持原始显示
    })
    return () => { cancelled = true }
  }, [codeString, language, shikiTheme])

  // 全屏时按 Escape 关闭
  useEffect(() => {
    if (!fullscreen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    // 全屏时禁止背景滚动
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [fullscreen])

  /** 复制代码 */
  const handleCopy = () => {
    copy(codeString)
    toast.success('已复制到剪贴板')
  }

  /** 复制为引用（带 ``` 围栏格式） */
  const handleCopyAsQuote = () => {
    const fenced = '```' + (language || '') + '\n' + codeString + '\n```'
    quoteCopy(fenced)
    toast.success('已复制为代码引用，可粘贴到输入框')
  }

  // 代码内容渲染（shiki 高亮或原始代码）
  const codeContent = highlightedHtml ? (
    <div
      className="shiki-wrapper"
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
    />
  ) : (
    <pre className={className}>
      <code className={className}>{children}</code>
    </pre>
  )

  return (
    <div className="relative group/code rounded-lg overflow-hidden border border-border" role="region" aria-label={`代码块${language ? ` (${language})` : ''}`}>
      {/* 顶部工具栏：语言标签 + 文件路径 + 操作按钮 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-card/50">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[11px] text-muted-foreground font-mono uppercase select-none flex-shrink-0">
            {language || 'text'}
          </span>
          {filePath && (
            <span className="text-[10px] text-muted-foreground/60 font-mono truncate" title={filePath}>
              {filePath}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* 查看 Diff 按钮（仅当有前一版本代码时显示） */}
          {hasDiff && (
            <Button
              variant={showDiff ? 'default' : 'ghost'}
              size="xs"
              onClick={() => setShowDiff(!showDiff)}
              className={cn(
                "text-[11px] h-5 px-1.5 gap-1",
                showDiff
                  ? ""
                  : "text-foreground opacity-0 group-hover/code:opacity-100 transition-all duration-150"
              )}
              title="查看文件变更对比"
            >
              <GitBranch size={11} />
              <span>{showDiff ? '隐藏 diff' : '查看 diff'}</span>
            </Button>
          )}
          {/* 复制为引用按钮 */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleCopyAsQuote}
            className={cn(
              "text-[11px] h-5 px-1.5",
              "text-foreground",
              "opacity-0 group-hover/code:opacity-100 transition-all duration-150"
            )}
            title="复制为代码引用（带 ``` 围栏）"
          >
            {quoteCopied ? (
              <Check size={11} className="text-[var(--color-success)]" />
            ) : (
              <ClipboardPaste size={11} />
            )}
          </Button>
          {/* 全屏查看按钮 */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setFullscreen(true)}
            className={cn(
              "text-[11px] h-5 px-1.5",
              "text-foreground",
              "opacity-0 group-hover/code:opacity-100 transition-all duration-150"
            )}
            title="全屏查看"
          >
            <Maximize2 size={11} />
          </Button>
          {/* 复制代码按钮 */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleCopy}
            className={cn(
              "text-[11px] h-5 px-1.5",
              "text-foreground",
              "opacity-0 group-hover/code:opacity-100 transition-all duration-150"
            )}
            title="复制代码"
          >
            {copied ? (
              <>
                <Check size={11} className="text-[var(--color-success)]" />
                <span className="text-[var(--color-success)]">已复制</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span>复制</span>
              </>
            )}
          </Button>
          {/* 保存代码片段按钮 */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              useSnippetStore.getState().addSnippet(codeString, language || 'text')
              toast.success('代码片段已保存')
            }}
            className={cn(
              "text-[11px] h-5 px-1.5",
              "text-foreground",
              "opacity-0 group-hover/code:opacity-100 transition-all duration-150"
            )}
            title="保存代码片段 (Ctrl+Shift+S 管理)"
          >
            <Download size={11} />
            <span>保存</span>
          </Button>
        </div>
      </div>

      {/* 代码内容区域（可折叠） */}
      <div
        className="relative"
        style={{
          maxHeight: shouldCollapse ? '320px' : 'none',
          overflow: 'hidden',
        }}
      >
        {codeContent}
        {/* 折叠时底部渐变遮罩 + 展开按钮 */}
        {shouldCollapse && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--color-code-bg,hsl(var(--card)))] to-transparent flex items-end justify-center pb-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setCollapsed(false)}
              className={cn(
                "text-[11px] gap-1",
                "text-foreground",
                "border border-border bg-card/80 backdrop-blur-sm"
              )}
            >
              <ChevronDown size={11} />
              <span>展开全部 ({lines.length} 行)</span>
            </Button>
          </div>
        )}
      </div>

      {/* 展开后的折叠按钮 */}
      {!collapsed && isLong && (
        <div className="flex justify-center border-t border-border/50 bg-card/30">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setCollapsed(true)}
            className={cn(
              "w-full text-[11px] gap-1 rounded-none",
              "text-foreground"
            )}
          >
            <ChevronUp size={11} />
            <span>折叠代码</span>
          </Button>
        </div>
      )}

      {/* 内联 Diff 视图（当有 previousCode 且用户点击"查看 diff"时显示） */}
      {showDiff && hasDiff && (
        <InlineDiffView originalCode={previousCode!} modifiedCode={codeString} />
      )}

      {/* 全屏查看 overlay */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col"
          onClick={() => setFullscreen(false)}
        >
          {/* 全屏顶部工具栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
            <span className="text-sm font-mono text-muted-foreground uppercase">
              {language || 'text'}
              {filePath && (
                <span className="ml-2 text-[11px] text-muted-foreground normal-case font-mono">{filePath}</span>
              )}
              <span className="ml-3 text-[11px] text-muted-foreground normal-case">
                {lines.length} 行
              </span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleCopy() }}
                className="text-[12px] text-foreground"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-[var(--color-success)]" />
                    <span className="text-[var(--color-success)]">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>复制代码</span>
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleCopyAsQuote() }}
                className="text-[12px] text-foreground"
              >
                {quoteCopied ? (
                  <>
                    <Check size={13} className="text-[var(--color-success)]" />
                    <span className="text-[var(--color-success)]">已复制</span>
                  </>
                ) : (
                  <>
                    <ClipboardPaste size={13} />
                    <span>复制引用</span>
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setFullscreen(false) }}
                className="text-[12px] text-foreground"
              >
                <X size={13} />
                <span>关闭</span>
              </Button>
            </div>
          </div>
          {/* 全屏代码内容 */}
          <div
            className="flex-1 overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {highlightedHtml ? (
              <div
                className="shiki-wrapper"
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            ) : (
              <pre className={cn(className, "text-[13px]")}>
                <code className={className}>{children}</code>
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CodeBlock
