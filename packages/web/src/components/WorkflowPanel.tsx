import { useState, useCallback } from 'react'
import {
  X,
  Plus,
  Trash2,
  Play,
  ChevronUp,
  ChevronDown,
  Pencil,
  ArrowLeft,
  GitBranch,
  GripVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkflowStore, type Workflow, type WorkflowStep } from '../stores/workflowStore'
import { toast } from 'sonner'
import { useTranslation } from '../i18n'

interface WorkflowPanelProps {
  open: boolean
  onClose: () => void
  onExecute: (workflow: Workflow) => void
}

type ViewMode = 'list' | 'edit'

/**
 * 工作流管理面板
 * 支持创建/编辑/删除工作流，以及步骤编排
 */
export default function WorkflowPanel({ open, onClose, onExecute }: WorkflowPanelProps) {
  const { t } = useTranslation()
  const { workflows, addWorkflow, updateWorkflow, removeWorkflow } = useWorkflowStore()
  const execution = useWorkflowStore((s) => s.execution)

  const [view, setView] = useState<ViewMode>('list')
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)

  // 编辑表单状态
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSteps, setEditSteps] = useState<WorkflowStep[]>([])

  /** 开始创建新工作流 */
  const handleCreate = useCallback(() => {
    setEditingWorkflow(null)
    setEditName('')
    setEditDescription('')
    setEditSteps([
      { id: crypto.randomUUID(), label: '', prompt: '' },
    ])
    setView('edit')
  }, [])

  /** 开始编辑已有工作流 */
  const handleEdit = useCallback((workflow: Workflow) => {
    setEditingWorkflow(workflow)
    setEditName(workflow.name)
    setEditDescription(workflow.description)
    setEditSteps(workflow.steps.map((s) => ({ ...s })))
    setView('edit')
  }, [])

  /** 保存工作流（新建或更新） */
  const handleSave = useCallback(() => {
    const trimmedName = editName.trim()
    if (!trimmedName) {
      toast.error(t('workflow.nameRequired'))
      return
    }

    // 过滤空步骤
    const validSteps = editSteps.filter((s) => s.prompt.trim())
    if (validSteps.length === 0) {
      toast.error(t('workflow.stepsRequired'))
      return
    }

    // 给没有 label 的步骤设置默认 label
    const stepsWithLabels = validSteps.map((s, i) => ({
      ...s,
      label: s.label.trim() || `${t('workflow.step')} ${i + 1}`,
    }))

    if (editingWorkflow) {
      updateWorkflow(editingWorkflow.id, {
        name: trimmedName,
        description: editDescription.trim(),
        steps: stepsWithLabels,
      })
      toast.success(t('workflow.updated'))
    } else {
      addWorkflow({
        name: trimmedName,
        description: editDescription.trim(),
        steps: stepsWithLabels,
      })
      toast.success(t('workflow.created'))
    }

    setView('list')
  }, [editName, editDescription, editSteps, editingWorkflow, addWorkflow, updateWorkflow, t])

  /** 删除工作流 */
  const handleDelete = useCallback(
    (id: string) => {
      removeWorkflow(id)
      toast.success(t('workflow.deleted'))
    },
    [removeWorkflow, t]
  )

  /** 执行工作流 */
  const handleExecute = useCallback(
    (workflow: Workflow) => {
      if (execution) {
        toast.error(t('workflow.alreadyRunning'))
        return
      }
      if (workflow.steps.length === 0) {
        toast.error(t('workflow.noSteps'))
        return
      }
      onExecute(workflow)
      onClose()
    },
    [execution, onExecute, onClose, t]
  )

  // ===== 步骤编辑操作 =====

  const addStep = useCallback(() => {
    setEditSteps((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: '', prompt: '' },
    ])
  }, [])

  const removeStep = useCallback((index: number) => {
    setEditSteps((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateStep = useCallback((index: number, field: 'label' | 'prompt', value: string) => {
    setEditSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    )
  }, [])

  const moveStep = useCallback((index: number, direction: 'up' | 'down') => {
    setEditSteps((prev) => {
      const newSteps = [...prev]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= newSteps.length) return prev
      ;[newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]]
      return newSteps
    })
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-[90vw] max-w-[700px] max-h-[80vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            {view === 'edit' && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setView('list')}
              >
                <ArrowLeft size={14} />
              </Button>
            )}
            <GitBranch size={16} className="text-primary" />
            <h2 className="text-sm font-medium">
              {view === 'list'
                ? t('workflow.title')
                : editingWorkflow
                  ? t('workflow.editWorkflow')
                  : t('workflow.createWorkflow')}
            </h2>
            {view === 'list' && (
              <span className="text-[11px] text-muted-foreground">
                ({workflows.length})
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X size={14} />
          </Button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4">
          {view === 'list' ? (
            <ListView
              workflows={workflows}
              execution={execution}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onExecute={handleExecute}
              onCreate={handleCreate}
              t={t}
            />
          ) : (
            <EditView
              editName={editName}
              editDescription={editDescription}
              editSteps={editSteps}
              onNameChange={setEditName}
              onDescriptionChange={setEditDescription}
              onAddStep={addStep}
              onRemoveStep={removeStep}
              onUpdateStep={updateStep}
              onMoveStep={moveStep}
              onSave={handleSave}
              t={t}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== 列表视图 ====================

interface ListViewProps {
  workflows: Workflow[]
  execution: ReturnType<typeof useWorkflowStore.getState>['execution']
  onEdit: (w: Workflow) => void
  onDelete: (id: string) => void
  onExecute: (w: Workflow) => void
  onCreate: () => void
  t: ReturnType<typeof useTranslation>['t']
}

function ListView({ workflows, execution, onEdit, onDelete, onExecute, onCreate, t }: ListViewProps) {
  return (
    <div className="space-y-3">
      {/* 创建按钮 */}
      <Button
        variant="outline"
        size="sm"
        onClick={onCreate}
        className="w-full border-dashed"
      >
        <Plus size={14} className="mr-1.5" />
        {t('workflow.createWorkflow')}
      </Button>

      {workflows.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-[13px]">
          {t('workflow.empty')}
        </div>
      )}

      {workflows.map((workflow) => {
        const isRunning =
          execution?.workflowId === workflow.id && execution?.status === 'running'

        return (
          <div
            key={workflow.id}
            className="group border border-border rounded-lg p-3 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-medium text-foreground truncate">
                  {workflow.name}
                </h3>
                {workflow.description && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    {workflow.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] text-muted-foreground/70">
                    {t('workflow.stepCount', { count: String(workflow.steps.length) })}
                  </span>
                  {/* 步骤预览 */}
                  <div className="flex items-center gap-1">
                    {workflow.steps.slice(0, 4).map((step, i) => (
                      <span
                        key={step.id}
                        className="text-[10px] text-primary/60 bg-primary/5 px-1.5 py-0.5 rounded"
                        title={step.label}
                      >
                        {i + 1}. {step.label.length > 8 ? step.label.slice(0, 8) + '...' : step.label}
                      </span>
                    ))}
                    {workflow.steps.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{workflow.steps.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onExecute(workflow)}
                  disabled={isRunning}
                  title={t('workflow.execute')}
                  className="text-primary hover:text-primary"
                >
                  <Play size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onEdit(workflow)}
                  title={t('common.edit')}
                >
                  <Pencil size={12} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onDelete(workflow.id)}
                  title={t('common.delete')}
                  className="text-destructive/60 hover:text-destructive"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ==================== 编辑视图 ====================

interface EditViewProps {
  editName: string
  editDescription: string
  editSteps: WorkflowStep[]
  onNameChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onAddStep: () => void
  onRemoveStep: (i: number) => void
  onUpdateStep: (i: number, field: 'label' | 'prompt', v: string) => void
  onMoveStep: (i: number, dir: 'up' | 'down') => void
  onSave: () => void
  t: ReturnType<typeof useTranslation>['t']
}

function EditView({
  editName,
  editDescription,
  editSteps,
  onNameChange,
  onDescriptionChange,
  onAddStep,
  onRemoveStep,
  onUpdateStep,
  onMoveStep,
  onSave,
  t,
}: EditViewProps) {
  return (
    <div className="space-y-4">
      {/* 工作流名称 */}
      <div>
        <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
          {t('workflow.name')}
        </label>
        <input
          type="text"
          value={editName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('workflow.namePlaceholder')}
          className="w-full px-3 py-1.5 rounded-md bg-secondary/50 border border-border text-[13px] outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* 描述 */}
      <div>
        <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
          {t('workflow.description')}
        </label>
        <input
          type="text"
          value={editDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={t('workflow.descriptionPlaceholder')}
          className="w-full px-3 py-1.5 rounded-md bg-secondary/50 border border-border text-[13px] outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* 步骤列表 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] text-muted-foreground font-medium">
            {t('workflow.steps')} ({editSteps.length})
          </label>
          <span className="text-[10px] text-muted-foreground/60">
            {t('workflow.prevHint')}
          </span>
        </div>

        <div className="space-y-3">
          {editSteps.map((step, index) => (
            <div
              key={step.id}
              className="border border-border rounded-lg p-3 bg-secondary/20"
            >
              <div className="flex items-center gap-2 mb-2">
                {/* 序号 + 拖拽图标 */}
                <div className="flex items-center gap-1 text-muted-foreground/50">
                  <GripVertical size={12} />
                  <span className="text-[11px] font-mono w-4 text-center">
                    {index + 1}
                  </span>
                </div>

                {/* 步骤标签 */}
                <input
                  type="text"
                  value={step.label}
                  onChange={(e) => onUpdateStep(index, 'label', e.target.value)}
                  placeholder={t('workflow.stepLabelPlaceholder')}
                  className="flex-1 px-2 py-1 rounded bg-secondary/50 border border-border text-[12px] outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
                />

                {/* 上移/下移/删除 */}
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onMoveStep(index, 'up')}
                    disabled={index === 0}
                    className="h-6 w-6"
                  >
                    <ChevronUp size={12} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onMoveStep(index, 'down')}
                    disabled={index === editSteps.length - 1}
                    className="h-6 w-6"
                  >
                    <ChevronDown size={12} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onRemoveStep(index)}
                    disabled={editSteps.length <= 1}
                    className="h-6 w-6 text-destructive/60 hover:text-destructive"
                  >
                    <Trash2 size={11} />
                  </Button>
                </div>
              </div>

              {/* 提示词模板 */}
              <textarea
                value={step.prompt}
                onChange={(e) => onUpdateStep(index, 'prompt', e.target.value)}
                placeholder={
                  index === 0
                    ? t('workflow.promptPlaceholderFirst')
                    : t('workflow.promptPlaceholderNext')
                }
                rows={3}
                className="w-full px-2 py-1.5 rounded bg-secondary/50 border border-border text-[12px] outline-none focus:border-primary/50 placeholder:text-muted-foreground/50 resize-y min-h-[60px]"
              />
            </div>
          ))}
        </div>

        {/* 添加步骤 */}
        <Button
          variant="outline"
          size="sm"
          onClick={onAddStep}
          className="w-full mt-2 border-dashed text-[12px]"
        >
          <Plus size={13} className="mr-1" />
          {t('workflow.addStep')}
        </Button>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end pt-2 border-t border-border">
        <Button size="sm" onClick={onSave}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  )
}
