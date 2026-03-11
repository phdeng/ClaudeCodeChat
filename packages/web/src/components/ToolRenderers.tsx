/**
 * 工具调用富渲染组件
 * 将 Claude CLI 不同工具的输入输出渲染为专用的富交互组件
 */
import { useState, useMemo, useCallback } from 'react'
import { Copy, Check, FileText, FolderTree } from 'lucide-react'
import { cn } from '@/lib/utils'

// ======== 通用工具 ========

/** 复制按钮组件 */
function CopyButton({ text, size = 10, className }: { text: string; size?: number; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-0.5 px-1 py-0.5 rounded",
        "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50",
        "transition-colors duration-150",
        className
      )}
      title="复制"
    >
      {copied ? (
        <Check size={size} className="text-green-400/80" />
      ) : (
        <Copy size={size} />
      )}
    </button>
  )
}

/** 文件路径显示 + 复制按钮 */
function FilePath({ path, className }: { path: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-[11px]", className)}>
      <FileText size={11} className="flex-shrink-0 text-blue-400/70" />
      <span className="text-blue-400/90 break-all">{path}</span>
      <CopyButton text={path} size={10} />
    </span>
  )
}

/** 小标签 */
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
      "bg-primary/10 text-primary/80",
      className
    )}>
      {children}
    </span>
  )
}

// ======== 解析工具 ========

interface ParsedInput {
  [key: string]: unknown
}

function safeParse(input: string): ParsedInput | null {
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

// ======== 1. 文件编辑工具 (Edit/Write/MultiEdit) ========

/** 简单 diff 渲染：old_string → new_string */
function DiffView({ oldStr, newStr }: { oldStr: string; newStr: string }) {
  const oldLines = oldStr.split('\n')
  const newLines = newStr.split('\n')

  return (
    <div className="rounded overflow-hidden border border-neutral-700/50">
      <div className="px-2 py-1 bg-neutral-800/80 border-b border-neutral-700/50">
        <span className="text-[10px] text-neutral-400 font-mono">diff</span>
      </div>
      <pre className={cn(
        "text-[11px] leading-[1.6] px-0 py-1",
        "bg-neutral-900/95",
        "overflow-x-auto max-h-[300px] overflow-y-auto",
        "font-mono"
      )}>
        {oldLines.map((line, i) => (
          <div key={`old-${i}`} className="px-3 bg-red-500/10 text-red-400">
            <span className="select-none text-red-400/50 mr-2">-</span>{line}
          </div>
        ))}
        {newLines.map((line, i) => (
          <div key={`new-${i}`} className="px-3 bg-green-500/10 text-green-400">
            <span className="select-none text-green-400/50 mr-2">+</span>{line}
          </div>
        ))}
      </pre>
    </div>
  )
}

export function EditToolRenderer({ input, result }: { input: string; result?: string }) {
  const parsed = useMemo(() => safeParse(input), [input])
  if (!parsed) return <GenericRenderer input={input} result={result} />

  const filePath = (parsed.file_path as string) || ''
  const oldString = (parsed.old_string as string) || ''
  const newString = (parsed.new_string as string) || ''
  const content = (parsed.content as string) || '' // Write 工具的内容

  return (
    <div className="space-y-1.5">
      {/* 文件路径 */}
      {filePath && (
        <div>
          <div className="text-[10px] text-muted-foreground/50 mb-0.5">文件</div>
          <FilePath path={filePath} />
        </div>
      )}

      {/* Diff 展示 (Edit) */}
      {oldString && newString && (
        <DiffView oldStr={oldString} newStr={newString} />
      )}

      {/* Write 工具：显示写入内容 */}
      {content && !oldString && (
        <div>
          <div className="text-[10px] text-muted-foreground/50 mb-0.5">写入内容</div>
          <pre className={cn(
            "text-[11px] leading-[1.5] p-2 rounded",
            "bg-neutral-900/95 text-green-300/90",
            "overflow-x-auto max-h-[200px] overflow-y-auto",
            "font-mono whitespace-pre-wrap break-all",
            "border border-neutral-700/50"
          )}>
            {content}
          </pre>
        </div>
      )}

      {/* 执行结果 */}
      {result && (
        <div>
          <div className="text-[10px] text-muted-foreground/50 mb-0.5">执行结果</div>
          <pre className={cn(
            "text-[11px] leading-[1.5] p-2 rounded",
            "bg-background/50 text-muted-foreground/80",
            "overflow-x-auto max-h-[150px] overflow-y-auto",
            "font-mono whitespace-pre-wrap break-all"
          )}>
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}

/** MultiEdit 工具渲染器 */
export function MultiEditToolRenderer({ input, result }: { input: string; result?: string }) {
  const parsed = useMemo(() => safeParse(input), [input])
  if (!parsed) return <GenericRenderer input={input} result={result} />

  const filePath = (parsed.file_path as string) || ''
  const edits = (parsed.edits as Array<{ old_string: string; new_string: string }>) || []

  return (
    <div className="space-y-1.5">
      {filePath && (
        <div>
          <div className="text-[10px] text-muted-foreground/50 mb-0.5">文件</div>
          <div className="flex items-center gap-2">
            <FilePath path={filePath} />
            <Badge>{edits.length} 处编辑</Badge>
          </div>
        </div>
      )}

      {edits.map((edit, i) => (
        <div key={i}>
          <div className="text-[10px] text-muted-foreground/50 mb-0.5">编辑 #{i + 1}</div>
          <DiffView oldStr={edit.old_string || ''} newStr={edit.new_string || ''} />
        </div>
      ))}

      {result && (
        <div>
          <div className="text-[10px] text-muted-foreground/50 mb-0.5">执行结果</div>
          <pre className={cn(
            "text-[11px] leading-[1.5] p-2 rounded",
            "bg-background/50 text-muted-foreground/80",
            "overflow-x-auto max-h-[150px] overflow-y-auto",
            "font-mono whitespace-pre-wrap break-all"
          )}>
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}

// ======== 2. Bash 命令执行 ========

export function BashToolRenderer({ input, result }: { input: string; result?: string }) {
  const parsed = useMemo(() => safeParse(input), [input])
  const command = parsed?.command as string || ''
  const timeout = parsed?.timeout as number | undefined
  const [outputCopied, setOutputCopied] = useState(false)

  // 尝试从结果中解析 exit code
  const { output, exitCode } = useMemo(() => {
    if (!result) return { output: '', exitCode: undefined as number | undefined }
    // 有些结果末尾可能有 exit code 信息
    const exitMatch = result.match(/\(exit code: (\d+)\)\s*$/)
    if (exitMatch) {
      return {
        output: result.slice(0, exitMatch.index).trimEnd(),
        exitCode: parseInt(exitMatch[1], 10),
      }
    }
    return { output: result, exitCode: undefined }
  }, [result])

  const handleCopyOutput = useCallback(() => {
    if (output) {
      navigator.clipboard.writeText(output).then(() => {
        setOutputCopied(true)
        setTimeout(() => setOutputCopied(false), 2000)
      })
    }
  }, [output])

  return (
    <div className="space-y-1.5">
      {/* 命令行 */}
      {command && (
        <div className="rounded overflow-hidden border border-neutral-700/50">
          <div className="flex items-center justify-between px-2 py-1 bg-neutral-800/80 border-b border-neutral-700/50">
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500/60" />
                <span className="w-2 h-2 rounded-full bg-yellow-500/60" />
                <span className="w-2 h-2 rounded-full bg-green-500/60" />
              </div>
              <span className="text-[10px] text-neutral-400 ml-1.5 font-mono">terminal</span>
            </div>
            {timeout && (
              <span className="text-[10px] text-neutral-500 font-mono">timeout: {timeout}ms</span>
            )}
          </div>
          <pre className={cn(
            "text-[11px] leading-[1.5] px-3 py-2",
            "bg-neutral-900/95 text-green-400",
            "overflow-x-auto font-mono whitespace-pre-wrap break-all"
          )}>
            <span className="text-cyan-400/80 select-none">$ </span>{command}
          </pre>
        </div>
      )}

      {/* 输出 */}
      {output && (
        <div className="rounded overflow-hidden border border-neutral-700/50">
          <div className="flex items-center justify-between px-2 py-1 bg-neutral-800/80 border-b border-neutral-700/50">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-neutral-400 font-mono">output</span>
              {exitCode !== undefined && (
                <Badge className={exitCode === 0
                  ? "bg-green-500/10 text-green-400/80"
                  : "bg-red-500/10 text-red-400/80"
                }>
                  exit: {exitCode}
                </Badge>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleCopyOutput() }}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]",
                "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50",
                "transition-colors duration-150"
              )}
              title="复制输出"
            >
              {outputCopied ? (
                <>
                  <Check size={10} className="text-green-400/80" />
                  <span className="text-green-400/80">已复制</span>
                </>
              ) : (
                <>
                  <Copy size={10} />
                  <span>复制</span>
                </>
              )}
            </button>
          </div>
          <pre className={cn(
            "text-[11px] leading-[1.5] px-3 py-2",
            "bg-neutral-900/95 text-green-300/90",
            "overflow-x-auto max-h-[400px] overflow-y-auto",
            "font-mono whitespace-pre-wrap break-all"
          )}>
            {output}
          </pre>
        </div>
      )}
    </div>
  )
}

// ======== 3. 文件搜索 (Glob/Grep) ========

export function SearchToolRenderer({ toolName, input, result }: { toolName: string; input: string; result?: string }) {
  const parsed = useMemo(() => safeParse(input), [input])
  const isGrep = toolName === 'Grep'

  const pattern = parsed?.pattern as string || ''
  const path = parsed?.path as string || ''
  const glob = parsed?.glob as string || ''
  const type = parsed?.type as string || ''

  // 解析结果为文件列表
  const { files, totalCount } = useMemo(() => {
    if (!result) return { files: [] as string[], totalCount: 0 }
    const lines = result.split('\n').filter(l => l.trim())
    return { files: lines, totalCount: lines.length }
  }, [result])

  return (
    <div className="space-y-1.5">
      {/* 搜索参数 */}
      <div>
        <div className="text-[10px] text-muted-foreground/50 mb-0.5">
          {isGrep ? '搜索模式' : '文件模式'}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <code className={cn(
            "text-[11px] px-1.5 py-0.5 rounded font-mono",
            "bg-purple-500/10 text-purple-400/90 border border-purple-500/20"
          )}>
            {isGrep ? `/${pattern}/` : pattern}
          </code>
          {path && (
            <span className="text-[10px] text-muted-foreground/60 font-mono">
              in {path}
            </span>
          )}
          {glob && (
            <span className="text-[10px] text-muted-foreground/60 font-mono">
              glob: {glob}
            </span>
          )}
          {type && (
            <span className="text-[10px] text-muted-foreground/60 font-mono">
              type: {type}
            </span>
          )}
        </div>
      </div>

      {/* 搜索结果 */}
      {result && (
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] text-muted-foreground/50">搜索结果</span>
            <Badge>{totalCount} 个匹配</Badge>
          </div>
          <div className={cn(
            "rounded overflow-hidden border border-neutral-700/50",
            "bg-neutral-900/95",
            "max-h-[300px] overflow-y-auto"
          )}>
            {files.map((file, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono",
                  "hover:bg-neutral-800/60 transition-colors",
                  i < files.length - 1 && "border-b border-neutral-800/50"
                )}
              >
                <FileText size={10} className="flex-shrink-0 text-blue-400/60" />
                <span className="text-neutral-300 break-all flex-1">{file}</span>
                <CopyButton text={file} size={9} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ======== 4. 文件读取 (Read) ========

export function ReadToolRenderer({ input, result }: { input: string; result?: string }) {
  const parsed = useMemo(() => safeParse(input), [input])
  const filePath = (parsed?.file_path as string) || ''
  const offset = parsed?.offset as number | undefined
  const limit = parsed?.limit as number | undefined

  return (
    <div className="space-y-1.5">
      {/* 文件路径 */}
      {filePath && (
        <div>
          <div className="text-[10px] text-muted-foreground/50 mb-0.5">文件</div>
          <div className="flex items-center gap-2 flex-wrap">
            <FilePath path={filePath} />
            {(offset !== undefined || limit !== undefined) && (
              <span className="text-[10px] text-muted-foreground/50 font-mono">
                {offset !== undefined && `offset: ${offset}`}
                {offset !== undefined && limit !== undefined && ', '}
                {limit !== undefined && `limit: ${limit}`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 文件内容 */}
      {result && (
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-muted-foreground/50">文件内容</span>
            <CopyButton text={result} size={10} className="text-[10px]" />
          </div>
          <pre className={cn(
            "text-[11px] leading-[1.5] p-2 rounded",
            "bg-neutral-900/95 text-neutral-300",
            "overflow-x-auto max-h-[300px] overflow-y-auto",
            "font-mono whitespace-pre-wrap break-all",
            "border border-neutral-700/50"
          )}>
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}

// ======== 5. 目录列表 (LS) ========

/** 解析 LS 输出为树形缩进结构 */
function parseDirectoryTree(content: string): Array<{ name: string; indent: number; isDir: boolean }> {
  const lines = content.split('\n').filter(l => l.trim())
  return lines.map(line => {
    // 计算前导空格（缩进层级）
    const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length || 0
    const indent = Math.floor(leadingSpaces / 2)
    const name = line.trim()
    // 以 / 结尾或不包含 . 的可能是目录
    const isDir = name.endsWith('/') || (!name.includes('.') && !name.startsWith('-'))
    return { name: name.replace(/\/$/, ''), indent, isDir }
  })
}

export function LSToolRenderer({ input, result }: { input: string; result?: string }) {
  const parsed = useMemo(() => safeParse(input), [input])
  const path = (parsed?.path as string) || ''

  const entries = useMemo(() => {
    if (!result) return []
    return parseDirectoryTree(result)
  }, [result])

  return (
    <div className="space-y-1.5">
      {path && (
        <div>
          <div className="text-[10px] text-muted-foreground/50 mb-0.5">目录</div>
          <FilePath path={path} />
        </div>
      )}

      {entries.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] text-muted-foreground/50">目录内容</span>
            <Badge>{entries.length} 项</Badge>
          </div>
          <div className={cn(
            "rounded overflow-hidden border border-neutral-700/50",
            "bg-neutral-900/95",
            "max-h-[300px] overflow-y-auto",
            "py-1"
          )}>
            {entries.map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono hover:bg-neutral-800/60 transition-colors"
                style={{ paddingLeft: `${8 + entry.indent * 16}px` }}
              >
                {entry.isDir ? (
                  <FolderTree size={10} className="flex-shrink-0 text-yellow-400/70" />
                ) : (
                  <FileText size={10} className="flex-shrink-0 text-blue-400/60" />
                )}
                <span className={cn(
                  "break-all",
                  entry.isDir ? "text-yellow-300/90" : "text-neutral-300"
                )}>
                  {entry.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 如果无法解析为树结构，回退到原始内容 */}
      {result && entries.length === 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground/50 mb-0.5">结果</div>
          <pre className={cn(
            "text-[11px] leading-[1.5] p-2 rounded",
            "bg-background/50 text-muted-foreground/80",
            "overflow-x-auto max-h-[200px] overflow-y-auto",
            "font-mono whitespace-pre-wrap break-all"
          )}>
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}

// ======== 通用回退渲染器 ========

export function GenericRenderer({ input, result }: { input: string; result?: string }) {
  return (
    <div className="space-y-1.5">
      {input && (
        <div>
          <div className="text-[10px] text-muted-foreground/50 mb-0.5">输入参数</div>
          <pre className={cn(
            "text-[11px] leading-[1.5] p-2 rounded",
            "bg-background/50 text-muted-foreground/80",
            "overflow-x-auto max-h-[200px] overflow-y-auto",
            "font-mono whitespace-pre-wrap break-all"
          )}>
            {(() => {
              try {
                return JSON.stringify(JSON.parse(input), null, 2)
              } catch {
                return input
              }
            })()}
          </pre>
        </div>
      )}
      {result && (
        <div>
          <div className="text-[10px] text-muted-foreground/50 mb-0.5">执行结果</div>
          <pre className={cn(
            "text-[11px] leading-[1.5] p-2 rounded",
            "bg-background/50 text-muted-foreground/80",
            "overflow-x-auto max-h-[200px] overflow-y-auto",
            "font-mono whitespace-pre-wrap break-all"
          )}>
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}

// ======== 主分发函数 ========

/** 根据工具名称选择对应的富渲染器 */
export function ToolContentRenderer({ toolName, input, result }: {
  toolName: string
  input: string
  result?: string
}) {
  switch (toolName) {
    case 'Edit':
    case 'Write':
      return <EditToolRenderer input={input} result={result} />
    case 'MultiEdit':
      return <MultiEditToolRenderer input={input} result={result} />
    case 'Bash':
      return <BashToolRenderer input={input} result={result} />
    case 'Glob':
    case 'Grep':
      return <SearchToolRenderer toolName={toolName} input={input} result={result} />
    case 'Read':
      return <ReadToolRenderer input={input} result={result} />
    case 'LS':
      return <LSToolRenderer input={input} result={result} />
    default:
      return <GenericRenderer input={input} result={result} />
  }
}
