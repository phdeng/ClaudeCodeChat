/**
 * 文件内容预览弹窗
 * 支持代码高亮、图片预览、Markdown 渲染等
 */
import { useState, useEffect, useMemo } from 'react'
import { Loader2, AlertCircle, FileText, Plus, Image as ImageIcon, FileCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface FilePreviewDialogProps {
  open: boolean
  onClose: () => void
  filePath: string
  workingDirectory?: string
  onAddToContext?: (item: {
    type: 'file'
    path: string
    displayName: string
    size?: number
    lineCount?: number
    language?: string
  }) => void
}

/** 文件读取 API 返回结果 */
interface FileReadResult {
  content: string
  size: number
  lineCount: number
  truncated?: boolean
}

/** 图片扩展名集合 */
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'])

/** Markdown 扩展名 */
const MARKDOWN_EXTS = new Set(['md', 'mdx', 'markdown'])

/** 代码文件扩展名 → 语言映射 */
const CODE_LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  sql: 'sql',
  vue: 'vue',
  svelte: 'svelte',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  graphql: 'graphql',
  gql: 'graphql',
  proto: 'protobuf',
  lua: 'lua',
  r: 'r',
  dart: 'dart',
  zig: 'zig',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  ml: 'ocaml',
  clj: 'clojure',
  lisp: 'lisp',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  env: 'dotenv',
}

/** 文件大小限制：100KB */
const MAX_FILE_SIZE = 100 * 1024

/** 从路径提取文件名 */
function getFileName(filePath: string): string {
  const segments = filePath.split(/[/\\]/).filter(Boolean)
  return segments.length > 0 ? segments[segments.length - 1] : filePath
}

/** 获取文件扩展名（小写） */
function getExtension(filePath: string): string {
  const name = getFileName(filePath)
  const dotIdx = name.lastIndexOf('.')
  if (dotIdx === -1) return ''
  return name.substring(dotIdx + 1).toLowerCase()
}

/** 判断文件类型 */
function getFileType(filePath: string): 'image' | 'markdown' | 'code' | 'text' {
  const ext = getExtension(filePath)
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (MARKDOWN_EXTS.has(ext)) return 'markdown'
  if (CODE_LANG_MAP[ext]) return 'code'
  return 'text'
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FilePreviewDialog({
  open,
  onClose,
  filePath,
  workingDirectory,
  onAddToContext,
}: FilePreviewDialogProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number>(0)
  const [lineCount, setLineCount] = useState<number>(0)
  const [truncated, setTruncated] = useState(false)

  const fileName = useMemo(() => getFileName(filePath), [filePath])
  const fileType = useMemo(() => getFileType(filePath), [filePath])
  const ext = useMemo(() => getExtension(filePath), [filePath])
  const language = useMemo(() => CODE_LANG_MAP[ext] || '', [ext])

  // 加载文件内容
  useEffect(() => {
    if (!open || !filePath) return

    // 图片不需要读取内容
    if (fileType === 'image') {
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    const loadFile = async () => {
      setLoading(true)
      setError(null)
      setContent('')
      setTruncated(false)

      try {
        const url = `/api/filesystem/read-file?path=${encodeURIComponent(filePath)}`
        const res = await fetch(url)

        if (!res.ok) {
          const errData = await res.json().catch(() => null)
          const errMsg = errData?.error || errData?.message || `读取失败 (HTTP ${res.status})`
          throw new Error(errMsg)
        }

        const data: FileReadResult = await res.json()
        if (cancelled) return

        setContent(data.content || '')
        setFileSize(data.size || 0)
        setLineCount(data.lineCount || data.content?.split('\n').length || 0)
        setTruncated(data.truncated || (data.size > MAX_FILE_SIZE))
      } catch (e: any) {
        if (cancelled) return
        const msg = e.message || '文件读取失败'
        setError(msg)
        console.error('文件预览加载失败:', e)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadFile()
    return () => {
      cancelled = true
    }
  }, [open, filePath, fileType])

  /** 添加到上下文 */
  const handleAddToContext = () => {
    if (!onAddToContext) return
    onAddToContext({
      type: 'file',
      path: filePath,
      displayName: fileName,
      size: fileSize || undefined,
      lineCount: lineCount || undefined,
      language: language || undefined,
    })
    toast.success(`已添加 ${fileName} 到上下文`)
  }

  /** 渲染文件内容 */
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="size-6 text-primary animate-spin" />
          <span className="text-[13px] text-muted-foreground">正在加载文件...</span>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertCircle className="size-6 text-destructive" />
          <span className="text-[13px] text-destructive text-center max-w-[300px]">{error}</span>
        </div>
      )
    }

    // 图片预览
    if (fileType === 'image') {
      // 通过 API 读取图片（使用文件路径作为 src）
      const imgSrc = `/api/filesystem/read-file?path=${encodeURIComponent(filePath)}&raw=true`
      return (
        <div className="flex items-center justify-center p-4">
          <img
            src={imgSrc}
            alt={fileName}
            className="max-w-full max-h-[400px] object-contain rounded-lg border border-border"
            onError={() => setError('图片加载失败')}
          />
        </div>
      )
    }

    // 代码文件（带行号）
    if (fileType === 'code' || fileType === 'text') {
      const lines = content.split('\n')
      const lineNumWidth = String(lines.length).length

      return (
        <div className="relative">
          {truncated && (
            <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-[12px] text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="size-3.5 flex-shrink-0" />
              <span>文件过大（{formatSize(fileSize)}），内容已截断显示</span>
            </div>
          )}
          <pre className="text-[13px] leading-relaxed font-mono overflow-x-auto">
            <code>
              {lines.map((line, i) => (
                <div key={i} className="flex hover:bg-accent/50 transition-colors">
                  <span className="select-none text-muted-foreground/50 text-right pr-4 pl-4 flex-shrink-0 border-r border-border/50"
                    style={{ minWidth: `${lineNumWidth + 2}ch` }}
                  >
                    {i + 1}
                  </span>
                  <span className="pl-4 pr-4 flex-1 whitespace-pre">
                    {line || ' '}
                  </span>
                </div>
              ))}
            </code>
          </pre>
        </div>
      )
    }

    // Markdown：简单的格式化文本展示
    if (fileType === 'markdown') {
      return (
        <div className="relative">
          {truncated && (
            <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-[12px] text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="size-3.5 flex-shrink-0" />
              <span>文件过大（{formatSize(fileSize)}），内容已截断显示</span>
            </div>
          )}
          <pre className="text-[13px] leading-relaxed font-mono p-4 whitespace-pre-wrap break-words">
            {content}
          </pre>
        </div>
      )
    }

    return null
  }

  /** 获取文件类型图标 */
  const FileTypeIcon = () => {
    switch (fileType) {
      case 'image':
        return <ImageIcon className="size-4 text-purple-400" />
      case 'code':
        return <FileCode className="size-4 text-blue-400" />
      default:
        return <FileText className="size-4 text-muted-foreground" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={cn(
          'max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden',
          // 移动端全屏
          'sm:rounded-lg',
        )}
      >
        {/* 标题栏 */}
        <DialogHeader className="px-5 py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-[15px] pr-8">
            <FileTypeIcon />
            <span className="truncate">{fileName}</span>
            {language && (
              <span className="text-[10px] text-muted-foreground bg-accent px-2 py-0.5 rounded flex-shrink-0">
                {language}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* 内容区域 */}
        <ScrollArea className="flex-1 min-h-0">
          {renderContent()}
        </ScrollArea>

        {/* 底部信息栏 + 操作 */}
        <div className="border-t border-border flex-shrink-0">
          {/* 文件信息 */}
          {!loading && !error && (
            <div className="flex items-center gap-4 px-5 py-2 text-[11px] text-muted-foreground border-b border-border/50">
              {fileSize > 0 && (
                <span>大小: {formatSize(fileSize)}</span>
              )}
              {lineCount > 0 && (
                <span>行数: {lineCount}</span>
              )}
              {language && (
                <span>语言: {language}</span>
              )}
              {fileType === 'image' && (
                <span>类型: 图片</span>
              )}
            </div>
          )}
          <DialogFooter className="px-5 py-3 sm:gap-2">
            {onAddToContext && (
              <Button
                variant="default"
                size="sm"
                onClick={handleAddToContext}
                disabled={!!error}
                className="text-[12px] gap-1.5"
              >
                <Plus className="size-3.5" />
                添加到上下文
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-[12px]"
            >
              关闭
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
