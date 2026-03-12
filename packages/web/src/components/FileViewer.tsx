import React, { useEffect, useCallback, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, FileText } from 'lucide-react'
import { codeToHtml } from 'shiki'
import * as mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { useFileExplorerStore, type OpenFileTab } from '@/stores/fileExplorerStore'
import { useThemeStore } from '@/stores/themeStore'
import { cn } from '@/lib/utils'

/** 图片扩展名集合 */
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp'])

/** 判断是否为图片文件 */
function isImageFile(name: string): boolean {
  const ext = '.' + (name.split('.').pop()?.toLowerCase() || '')
  return IMAGE_EXTS.has(ext)
}

/** 判断是否为 Markdown 文件 */
function isMarkdownFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return ext === 'md' || ext === 'mdx'
}

/** PDF 文件判断 */
function isPdfFile(name: string): boolean {
  return name.toLowerCase().endsWith('.pdf')
}

/** Word 文件判断 */
function isWordFile(name: string): boolean {
  const ext = name.toLowerCase()
  return ext.endsWith('.docx') || ext.endsWith('.doc')
}

/** Excel 文件判断 */
function isExcelFile(name: string): boolean {
  const ext = name.toLowerCase()
  return ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.csv')
}

/** 二进制文件判断（需要通过 raw 端点加载） */
function isBinaryPreview(name: string): boolean {
  return isPdfFile(name) || isWordFile(name) || isExcelFile(name) || isImageFile(name)
}

/** 单个 Tab 组件 */
function FileTab({ tab, isActive, onActivate, onClose }: {
  tab: OpenFileTab
  isActive: boolean
  onActivate: () => void
  onClose: (e: React.MouseEvent) => void
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-border text-[12px] min-w-0 max-w-[160px] group select-none",
        isActive
          ? "bg-background text-foreground border-b-2 border-b-primary"
          : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
      )}
      onClick={onActivate}
      title={tab.path}
    >
      <span className="truncate flex-1">{tab.name}</span>
      <button
        className={cn(
          "flex-shrink-0 p-0.5 rounded hover:bg-accent/80 transition-opacity",
          isActive ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
        )}
        onClick={onClose}
      >
        <X size={12} />
      </button>
    </div>
  )
}

/** 代码内容渲染 — Shiki 语法高亮 + 行号（复用 themeStore 代码主题） */
function CodeContent({ content, language }: { content: string; language: string }) {
  const [highlightedHtml, setHighlightedHtml] = useState<string>('')
  const [isHighlighting, setIsHighlighting] = useState(true)
  const shikiTheme = useThemeStore((s) => s.resolvedCodeTheme())

  useEffect(() => {
    let cancelled = false
    setIsHighlighting(true)

    // Shiki 语法高亮（异步），使用用户选择的代码主题
    codeToHtml(content, {
      lang: language || 'text',
      theme: shikiTheme,
    }).then(html => {
      if (!cancelled) {
        setHighlightedHtml(html)
        setIsHighlighting(false)
      }
    }).catch(() => {
      // 高亮失败时降级为纯文本
      if (!cancelled) {
        setHighlightedHtml('')
        setIsHighlighting(false)
      }
    })

    return () => { cancelled = true }
  }, [content, language, shikiTheme])

  // 高亮完成前显示纯文本（带行号）
  if (isHighlighting || !highlightedHtml) {
    const lines = content.split('\n')
    return (
      <div className="flex text-[13px] font-mono leading-[0.7]">
        <div className="flex-shrink-0 select-none text-right pr-4 pl-4 text-muted-foreground/50 border-r border-border bg-muted/20">
          {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <pre className="flex-1 pl-4 pr-4 overflow-x-auto"><code>{content}</code></pre>
      </div>
    )
  }

  return (
    <div
      className="shiki-file-viewer text-[13px] leading-[0.7] overflow-x-auto [&_code]:!text-[13px]"
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
    />
  )
}

/** Markdown 渲染 — 复用项目已有的 markdown-body 样式 */
function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="p-6 overflow-auto markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

/** PDF 预览 — iframe 方式 */
function PdfContent({ filePath }: { filePath: string }) {
  const url = `/api/filesystem/raw?path=${encodeURIComponent(filePath)}`
  return (
    <iframe
      src={url}
      className="w-full h-full border-0"
      title="PDF 预览"
    />
  )
}

/** Word 文档预览 — mammoth 转 HTML */
function WordContent({ filePath }: { filePath: string }) {
  const [html, setHtml] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    fetch(`/api/filesystem/raw?path=${encodeURIComponent(filePath)}`)
      .then(res => {
        if (!res.ok) throw new Error('获取文件失败')
        return res.arrayBuffer()
      })
      .then(buffer => mammoth.convertToHtml({ arrayBuffer: buffer }))
      .then(result => {
        if (!cancelled) {
          setHtml(result.value)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || '文档解析失败')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [filePath])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-sm">解析文档中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive">
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div
      className="p-6 overflow-auto markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** Excel 预览 — xlsx 解析为表格 */
function ExcelContent({ filePath }: { filePath: string }) {
  const [sheets, setSheets] = useState<{ name: string; data: string[][] }[]>([])
  const [activeSheet, setActiveSheet] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    fetch(`/api/filesystem/raw?path=${encodeURIComponent(filePath)}`)
      .then(res => {
        if (!res.ok) throw new Error('获取文件失败')
        return res.arrayBuffer()
      })
      .then(buffer => {
        const workbook = XLSX.read(buffer, { type: 'array' })
        const result = workbook.SheetNames.map(name => {
          const sheet = workbook.Sheets[name]
          const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
          return { name, data: data as string[][] }
        })
        if (!cancelled) {
          setSheets(result)
          setActiveSheet(0)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || '表格解析失败')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [filePath])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-sm">解析表格中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive">
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  const currentSheet = sheets[activeSheet]

  return (
    <div className="flex flex-col h-full">
      {/* Sheet 标签栏 */}
      {sheets.length > 1 && (
        <div className="flex border-b border-border bg-muted/20 flex-shrink-0 overflow-x-auto">
          {sheets.map((sheet, i) => (
            <button
              key={sheet.name}
              className={cn(
                "px-3 py-1.5 text-xs border-r border-border whitespace-nowrap",
                i === activeSheet ? "bg-background text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60"
              )}
              onClick={() => setActiveSheet(i)}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}
      {/* 表格内容 */}
      <div className="flex-1 overflow-auto">
        {currentSheet && currentSheet.data.length > 0 ? (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="sticky top-0 bg-muted/60 border border-border px-2 py-1 text-left text-muted-foreground font-medium w-[40px]">#</th>
                {(currentSheet.data[0] || []).map((_, colIdx) => (
                  <th key={colIdx} className="sticky top-0 bg-muted/60 border border-border px-2 py-1 text-left text-muted-foreground font-medium">
                    {String.fromCharCode(65 + (colIdx % 26))}{colIdx >= 26 ? Math.floor(colIdx / 26) : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentSheet.data.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-accent/30">
                  <td className="border border-border px-2 py-1 text-muted-foreground bg-muted/20 text-center">{rowIdx + 1}</td>
                  {row.map((cell, colIdx) => (
                    <td key={colIdx} className="border border-border px-2 py-1 max-w-[200px] truncate">
                      {cell != null ? String(cell) : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">空表格</div>
        )}
      </div>
    </div>
  )
}

/** 空状态提示 */
function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
      <FileText size={40} className="opacity-30" />
      <p className="text-sm">在左侧文件树中点击文件打开</p>
    </div>
  )
}

/** 文件查看器面板 — 右侧多 Tab 展示 */
export default function FileViewer() {
  const {
    openTabs, activeTabPath, setActiveTab, closeTab,
    updateTabContent, updateTabLoading, updateTabError,
    closeAllTabs, closeOtherTabs,
  } = useFileExplorerStore()
  const tabsRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null)

  const activeTab = openTabs.find(t => t.path === activeTabPath) || null

  // 自动加载当前 Tab 的文件内容
  useEffect(() => {
    if (!activeTab || activeTab.content !== undefined || activeTab.loading) return
    // 二进制文件（PDF/Word/Excel/图片）不走文本 API
    if (isBinaryPreview(activeTab.name)) {
      updateTabContent(activeTab.path, '__binary__')
      return
    }
    loadFileContent(activeTab.path)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.path, activeTab?.content, activeTab?.loading])

  // 调用后端 API 加载文件内容
  const loadFileContent = useCallback(async (filePath: string) => {
    updateTabLoading(filePath, true)
    try {
      const res = await fetch(`/api/filesystem/read-file?path=${encodeURIComponent(filePath)}&maxSize=500000`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: '读取失败' }))
        updateTabError(filePath, errData.error || '读取失败')
        return
      }
      const data = await res.json()
      let content = data.content || ''
      if (data.truncated) {
        content += '\n\n--- 文件过大，已截断显示 ---'
      }
      updateTabContent(filePath, content)
    } catch {
      updateTabError(filePath, '网络错误，读取失败')
    }
  }, [updateTabContent, updateTabLoading, updateTabError])

  // 关闭指定 Tab（阻止冒泡）
  const handleCloseTab = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    closeTab(path)
  }, [closeTab])

  // Tab 右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, path })
  }, [])

  // 点击外部区域关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [contextMenu])

  // Tab 栏鼠标滚轮横向滚动
  const handleTabsWheel = useCallback((e: React.WheelEvent) => {
    if (tabsRef.current) {
      tabsRef.current.scrollLeft += e.deltaY
    }
  }, [])

  // 根据文件类型渲染内容区
  const renderContent = () => {
    if (!activeTab) return <EmptyState />

    if (activeTab.loading) {
      return (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">加载中...</span>
          </div>
        </div>
      )
    }

    if (activeTab.error) {
      return (
        <div className="flex-1 flex items-center justify-center text-destructive">
          <p className="text-sm">{activeTab.error}</p>
        </div>
      )
    }

    if (!activeTab.content) return <EmptyState />

    // PDF
    if (isPdfFile(activeTab.name)) {
      return (
        <div className="flex-1 overflow-hidden">
          <PdfContent filePath={activeTab.path} />
        </div>
      )
    }

    // Word
    if (isWordFile(activeTab.name)) {
      return <WordContent filePath={activeTab.path} />
    }

    // Excel
    if (isExcelFile(activeTab.name)) {
      return <ExcelContent filePath={activeTab.path} />
    }

    // 图片
    if (isImageFile(activeTab.name)) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <img
            src={`/api/filesystem/raw?path=${encodeURIComponent(activeTab.path)}`}
            alt={activeTab.name}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )
    }

    // Markdown
    if (isMarkdownFile(activeTab.name)) {
      return (
        <div className="flex-1 overflow-auto">
          <MarkdownContent content={activeTab.content} />
        </div>
      )
    }

    // 代码/文本 — Shiki 高亮
    return (
      <div className="flex-1 overflow-auto">
        <CodeContent content={activeTab.content} language={activeTab.language} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tab 栏 */}
      {openTabs.length > 0 && (
        <div className="flex items-center border-b border-border bg-muted/20 flex-shrink-0">
          <div
            ref={tabsRef}
            className="flex-1 flex overflow-x-auto scrollbar-none"
            onWheel={handleTabsWheel}
          >
            {openTabs.map(tab => (
              <div
                key={tab.path}
                onContextMenu={(e) => handleContextMenu(e, tab.path)}
              >
                <FileTab
                  tab={tab}
                  isActive={tab.path === activeTabPath}
                  onActivate={() => setActiveTab(tab.path)}
                  onClose={(e) => handleCloseTab(e, tab.path)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 文件内容区域 */}
      {renderContent()}

      {/* 右键菜单（关闭/关闭其他/全部关闭） */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            onClick={() => { closeTab(contextMenu.path); setContextMenu(null) }}
          >
            关闭
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            onClick={() => { closeOtherTabs(contextMenu.path); setContextMenu(null) }}
          >
            关闭其他
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors text-destructive"
            onClick={() => { closeAllTabs(); setContextMenu(null) }}
          >
            全部关闭
          </button>
        </div>
      )}
    </div>
  )
}
