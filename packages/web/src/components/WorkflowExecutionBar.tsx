import { Square, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkflowStore } from '../stores/workflowStore'
import { useTranslation } from '../i18n'

/**
 * 工作流执行进度条
 * 在消息列表顶部显示当前工作流的执行状态
 */
export default function WorkflowExecutionBar() {
  const { t } = useTranslation()
  const execution = useWorkflowStore((s) => s.execution)
  const stopExecution = useWorkflowStore((s) => s.stopExecution)

  if (!execution) return null

  const progress = ((execution.currentStepIndex + 1) / execution.totalSteps) * 100
  const isRunning = execution.status === 'running'
  const isCompleted = execution.status === 'completed'
  const isError = execution.status === 'error'

  // 获取当前步骤标签
  const workflow = useWorkflowStore.getState().workflows.find(
    (w) => w.id === execution.workflowId
  )
  const currentStepLabel = workflow?.steps[execution.currentStepIndex]?.label || ''

  return (
    <div className="flex-shrink-0 border-b border-border bg-primary/5">
      {/* 进度条 */}
      <div className="h-[2px] bg-secondary">
        <div
          className={`h-full transition-all duration-500 ${
            isCompleted
              ? 'bg-green-500'
              : isError
                ? 'bg-destructive'
                : 'bg-primary'
          }`}
          style={{ width: `${isCompleted ? 100 : progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between px-4 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {isRunning && (
            <Loader2 size={13} className="text-primary animate-spin flex-shrink-0" />
          )}
          {isCompleted && (
            <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
          )}
          {isError && (
            <AlertCircle size={13} className="text-destructive flex-shrink-0" />
          )}

          <span className="text-[12px] font-medium text-foreground truncate">
            {execution.workflowName}
          </span>

          <span className="text-[11px] text-muted-foreground flex-shrink-0">
            {isCompleted
              ? t('workflow.completed')
              : isError
                ? t('workflow.error')
                : t('workflow.stepProgress', {
                    current: String(execution.currentStepIndex + 1),
                    total: String(execution.totalSteps),
                  })}
          </span>

          {isRunning && currentStepLabel && (
            <span className="text-[11px] text-primary/80 truncate">
              {currentStepLabel}
            </span>
          )}
        </div>

        {isRunning && (
          <Button
            variant="ghost"
            size="xs"
            onClick={stopExecution}
            className="text-[11px] text-destructive hover:text-destructive flex-shrink-0 h-6"
          >
            <Square size={10} className="mr-1" />
            {t('workflow.stop')}
          </Button>
        )}
      </div>
    </div>
  )
}
