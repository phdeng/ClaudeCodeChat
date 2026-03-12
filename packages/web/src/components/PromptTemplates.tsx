import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Search, Bug, RefreshCw, BookOpen, TestTube, FileText,
  Plus, Trash2, Pencil, X, BookTemplate,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePromptTemplateStore, type PromptTemplate } from '@/stores/promptTemplateStore'
import { useTranslation } from '../i18n'

// ==================== 图标映射 ====================

const ICON_MAP: Record<string, React.ElementType> = {
  Search,
  Bug,
  RefreshCw,
  BookOpen,
  TestTube,
  FileText,
  BookTemplate,
}

function TemplateIcon({ name, size = 12 }: { name?: string; size?: number }) {
  const Icon = name ? ICON_MAP[name] : null
  if (!Icon) return <BookTemplate size={size} />
  return <Icon size={size} />
}

// ==================== 分类配置 ====================

interface CategoryConfig {
  key: string
  label: { zh: string; en: string }
}

const CATEGORIES: CategoryConfig[] = [
  { key: 'all', label: { zh: '全部', en: 'All' } },
  { key: 'code-review', label: { zh: '代码审查', en: 'Code Review' } },
  { key: 'bug-fix', label: { zh: 'Bug 修复', en: 'Bug Fix' } },
  { key: 'refactor', label: { zh: '重构', en: 'Refactor' } },
  { key: 'explain', label: { zh: '解释代码', en: 'Explain' } },
  { key: 'write-tests', label: { zh: '编写测试', en: 'Tests' } },
  { key: 'generate-docs', label: { zh: '文档生成', en: 'Docs' } },
  { key: 'custom', label: { zh: '自定义', en: 'Custom' } },
]

// ==================== 组件 Props ====================

interface PromptTemplatesProps {
  /** 选中模板后的回调 */
  onSelect: (content: string) => void
  /** 是否显示 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
}

// ==================== 主组件 ====================

export default function PromptTemplates({ onSelect, open, onClose }: PromptTemplatesProps) {
  const { lang } = useTranslation()
  const { t } = useTranslation()
  const { templates, addTemplate, updateTemplate, deleteTemplate } = usePromptTemplateStore()

  const [activeCategory, setActiveCategory] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', content: '', category: 'custom' as PromptTemplate['category'] })

  const panelRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // 延迟添加事件监听，避免打开时立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onClose])

  // 过滤模板
  const filteredTemplates = activeCategory === 'all'
    ? templates
    : templates.filter((t) => t.category === activeCategory)

  // 选择模板
  const handleSelect = useCallback((template: PromptTemplate) => {
    onSelect(template.content)
    onClose()
  }, [onSelect, onClose])

  // 提交表单
  const handleFormSubmit = useCallback(() => {
    const name = form.name.trim()
    const content = form.content.trim()
    if (!name || !content) return

    if (editingId) {
      updateTemplate(editingId, { name, content, category: form.category })
      setEditingId(null)
    } else {
      addTemplate({ name, content, category: form.category })
    }
    setForm({ name: '', content: '', category: 'custom' })
    setShowForm(false)
  }, [form, editingId, addTemplate, updateTemplate])

  // 开始编辑
  const startEdit = useCallback((template: PromptTemplate) => {
    setEditingId(template.id)
    setForm({ name: template.name, content: template.content, category: template.category })
    setShowForm(true)
  }, [])

  // 取消表单
  const cancelForm = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', content: '', category: 'custom' })
  }, [])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      className="absolute bottom-7 left-0 w-80 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden"
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5">
          <BookTemplate size={12} className="text-primary" />
          <span className="text-xs font-medium text-foreground">
            {t('promptTemplates.title')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => { setShowForm(v => !v); setEditingId(null); setForm({ name: '', content: '', category: 'custom' }) }}
            className="h-5 w-5 text-foreground cursor-pointer"
            title={t('promptTemplates.newTemplate')}
          >
            <Plus size={12} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="h-5 w-5 text-foreground cursor-pointer"
          >
            <X size={12} />
          </Button>
        </div>
      </div>

      {/* 分类 Tab */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border overflow-x-auto scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={cn(
              'px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer',
              activeCategory === cat.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {lang === 'zh' ? cat.label.zh : cat.label.en}
          </button>
        ))}
      </div>

      {/* 模板列表 */}
      <div className="max-h-56 overflow-y-auto py-1">
        {filteredTemplates.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <span className="text-[12px] text-muted-foreground">
              {t('promptTemplates.noTemplates')}
            </span>
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="group flex items-center gap-2 px-3 py-1.5 hover:bg-accent cursor-pointer transition-colors"
              onClick={() => handleSelect(template)}
            >
              {/* 图标 */}
              <div className="flex-shrink-0 w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                <TemplateIcon name={template.icon} size={12} />
              </div>

              {/* 名称 + 预览 */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">{template.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {template.content.slice(0, 60).replace(/\n/g, ' ')}
                  {template.content.length > 60 ? '...' : ''}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {!template.isBuiltin && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(template) }}
                      className="p-0.5 text-foreground rounded cursor-pointer"
                      title={t('common.edit')}
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTemplate(template.id) }}
                      className="p-0.5 text-muted-foreground hover:text-destructive rounded cursor-pointer"
                      title={t('common.delete')}
                    >
                      <Trash2 size={10} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 新建/编辑模板表单 */}
      {showForm && (
        <div className="border-t border-border px-3 py-2 space-y-1.5">
          <div className="text-[10px] text-muted-foreground font-medium">
            {editingId
              ? (lang === 'zh' ? '编辑模板' : 'Edit Template')
              : t('promptTemplates.newTemplate')}
          </div>
          <input
            type="text"
            placeholder={lang === 'zh' ? '模板名称' : 'Template name'}
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full text-xs px-2 py-1 rounded border border-border bg-background text-foreground outline-none focus:border-primary"
          />
          <textarea
            placeholder={lang === 'zh' ? '模板内容... 使用 {{变量}} 添加占位符' : 'Template content... Use {{variable}} for placeholders'}
            value={form.content}
            onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            rows={3}
            className="w-full text-xs px-2 py-1 rounded border border-border bg-background text-foreground outline-none focus:border-primary resize-none"
          />
          {/* 分类选择 */}
          <select
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as PromptTemplate['category'] }))}
            className="w-full text-xs px-2 py-1 rounded border border-border bg-background text-foreground outline-none focus:border-primary cursor-pointer"
          >
            {CATEGORIES.filter((c) => c.key !== 'all').map((cat) => (
              <option key={cat.key} value={cat.key}>
                {lang === 'zh' ? cat.label.zh : cat.label.en}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelForm}
              className="h-6 text-[10px] px-2 cursor-pointer"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleFormSubmit}
              disabled={!form.name.trim() || !form.content.trim()}
              className="h-6 text-[10px] px-2 cursor-pointer"
            >
              {editingId ? (lang === 'zh' ? '更新' : 'Update') : t('common.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
