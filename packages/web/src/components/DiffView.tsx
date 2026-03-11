import { useMemo } from 'react'
import { X, GitCompareArrows, Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

// ==================== Diff 算法 ====================

type DiffLineType = 'unchanged' | 'added' | 'removed'

interface DiffLine {
  type: DiffLineType
  content: string
  /** 原始文本行号（removed / unchanged 有值） */
  oldLineNo: number | null
  /** 修改后文本行号（added / unchanged 有值） */
  newLineNo: number | null
}

/**
 * 简单的逐行 diff 算法，基于最长公共子序列 (LCS)。
 * 使用动态规划找到两组行的 LCS，然后据此标记每行为 unchanged / added / removed。
 */
function computeDiff(original: string, modified: string): DiffLine[] {
  const oldLines = original.split('\n')
  const newLines = modified.split('\n')

  const m = oldLines.length
  const n = newLines.length

  // 构建 LCS 表
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

  // 回溯生成 diff 结果
  const result: DiffLine[] = []
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({
        type: 'unchanged',
        content: oldLines[i - 1],
        oldLineNo: i,
        newLineNo: j,
      })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({
        type: 'added',
        content: newLines[j - 1],
        oldLineNo: null,
        newLineNo: j,
      })
      j--
    } else {
      result.push({
        type: 'removed',
        content: oldLines[i - 1],
        oldLineNo: i,
        newLineNo: null,
      })
      i--
    }
  }

  result.reverse()
  return result
}

// ==================== 组件 ====================

interface DiffViewProps {
  originalText: string
  modifiedText: string
  onClose: () => void
}

export default function DiffView({ originalText, modifiedText, onClose }: DiffViewProps) {
  const diffLines = useMemo(() => computeDiff(originalText, modifiedText), [originalText, modifiedText])

  const stats = useMemo(() => {
    let added = 0
    let removed = 0
    for (const line of diffLines) {
      if (line.type === 'added') added++
      if (line.type === 'removed') removed++
    }
    return { added, removed }
  }, [diffLines])

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <GitCompareArrows size={18} className="text-primary" />
          <h2 className="text-[15px] font-semibold text-foreground">内容对比</h2>
          <div className="flex items-center gap-3 ml-3">
            <span className="flex items-center gap-1 text-[12px] text-green-400">
              <Plus size={12} />
              {stats.added} 行添加
            </span>
            <span className="flex items-center gap-1 text-[12px] text-red-400">
              <Minus size={12} />
              {stats.removed} 行删除
            </span>
          </div>
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

      {/* Diff 主体 */}
      <ScrollArea className="flex-1">
        <div className="p-4 max-w-5xl mx-auto">
          {/* 如果完全相同 */}
          {stats.added === 0 && stats.removed === 0 && (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-[14px]">
              内容完全相同，无差异
            </div>
          )}

          {/* Diff 行 */}
          {(stats.added > 0 || stats.removed > 0) && (
            <div className="rounded-lg border border-border overflow-hidden font-mono text-[13px] leading-[1.6]">
              {diffLines.map((line, index) => (
                <div
                  key={index}
                  className={
                    line.type === 'removed'
                      ? 'flex bg-red-500/10'
                      : line.type === 'added'
                        ? 'flex bg-green-500/10'
                        : 'flex bg-transparent'
                  }
                >
                  {/* 旧行号 */}
                  <div className="flex-shrink-0 w-[52px] text-right pr-2 py-0.5 select-none text-muted-foreground/50 text-[11px] border-r border-border/50">
                    {line.oldLineNo ?? ''}
                  </div>
                  {/* 新行号 */}
                  <div className="flex-shrink-0 w-[52px] text-right pr-2 py-0.5 select-none text-muted-foreground/50 text-[11px] border-r border-border/50">
                    {line.newLineNo ?? ''}
                  </div>
                  {/* 差异标记 */}
                  <div className="flex-shrink-0 w-[24px] text-center py-0.5 select-none font-bold">
                    {line.type === 'removed' && <span className="text-red-400">-</span>}
                    {line.type === 'added' && <span className="text-green-400">+</span>}
                  </div>
                  {/* 内容 */}
                  <div
                    className={
                      'flex-1 py-0.5 px-2 whitespace-pre-wrap break-all ' +
                      (line.type === 'removed'
                        ? 'text-red-400'
                        : line.type === 'added'
                          ? 'text-green-400'
                          : 'text-foreground')
                    }
                  >
                    {line.content || '\u00A0'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
