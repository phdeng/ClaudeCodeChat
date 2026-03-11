import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ==================== 类型定义 ====================

/** 工作流步骤 */
export interface WorkflowStep {
  id: string
  /** 步骤标签，如"分析代码"、"生成方案" */
  label: string
  /** 提示词模板，支持 {{prev}} 引用上一步的 AI 回复 */
  prompt: string
}

/** 工作流定义 */
export interface Workflow {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  createdAt: number
  updatedAt: number
}

/** 工作流执行状态 */
export interface WorkflowExecution {
  workflowId: string
  workflowName: string
  currentStepIndex: number
  totalSteps: number
  status: 'running' | 'paused' | 'completed' | 'error'
  /** 上一步 AI 回复内容（用于替换 {{prev}}） */
  prevOutput: string
}

interface WorkflowState {
  /** 所有工作流 */
  workflows: Workflow[]
  /** 当前执行状态（null 表示没有正在执行的工作流） */
  execution: WorkflowExecution | null

  // ===== CRUD =====
  addWorkflow: (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) => Workflow
  updateWorkflow: (id: string, updates: Partial<Pick<Workflow, 'name' | 'description' | 'steps'>>) => void
  removeWorkflow: (id: string) => void

  // ===== 执行管理 =====
  startExecution: (workflow: Workflow) => void
  advanceStep: (prevOutput: string) => WorkflowStep | null
  stopExecution: () => void
  completeExecution: () => void
  setExecutionError: () => void
}

// ==================== 预置工作流模板 ====================

const PRESET_WORKFLOWS: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '代码审查工作流',
    description: '自动化代码审查：分析结构 → 找出问题 → 提供修改建议',
    steps: [
      {
        id: crypto.randomUUID(),
        label: '分析代码结构',
        prompt: '请分析当前项目的代码结构和架构，列出主要模块、文件组织方式和依赖关系。重点关注代码质量和设计模式。',
      },
      {
        id: crypto.randomUUID(),
        label: '找出潜在问题',
        prompt: '基于以下代码结构分析，请找出潜在的问题和改进点，包括但不限于：性能问题、安全隐患、代码重复、错误处理不当、可维护性问题。\n\n上一步分析结果：\n{{prev}}',
      },
      {
        id: crypto.randomUUID(),
        label: '提供修改建议',
        prompt: '基于以下发现的问题，请提供具体的修改建议和代码示例。优先级从高到低排列，每个建议包含：问题描述、影响范围、修改方案和代码示例。\n\n发现的问题：\n{{prev}}',
      },
    ],
  },
  {
    name: 'TDD 开发工作流',
    description: '测试驱动开发：分析需求 → 编写测试 → 实现功能 → 重构优化',
    steps: [
      {
        id: crypto.randomUUID(),
        label: '分析需求',
        prompt: '请分析当前需要实现的功能需求，明确输入输出、边界条件和异常情况。列出功能点清单和验收标准。',
      },
      {
        id: crypto.randomUUID(),
        label: '编写测试用例',
        prompt: '基于以下需求分析，请编写完整的测试用例。包括正常流程测试、边界条件测试和异常情况测试。使用合适的测试框架。\n\n需求分析：\n{{prev}}',
      },
      {
        id: crypto.randomUUID(),
        label: '实现功能代码',
        prompt: '基于以下测试用例，请实现让所有测试通过的功能代码。代码应该简洁、可读，遵循最佳实践。\n\n测试用例：\n{{prev}}',
      },
      {
        id: crypto.randomUUID(),
        label: '重构优化',
        prompt: '基于以下实现代码，请进行重构优化。包括：消除重复代码、改进命名、提取公共逻辑、优化性能、增强错误处理。确保所有测试仍然通过。\n\n实现代码：\n{{prev}}',
      },
    ],
  },
  {
    name: '文档生成工作流',
    description: '自动化文档生成：分析代码 → 生成 API 文档 → 生成使用示例',
    steps: [
      {
        id: crypto.randomUUID(),
        label: '分析代码接口',
        prompt: '请分析当前项目的公共 API 和接口，列出所有导出的函数、类、类型和常量。包括参数类型、返回值类型和功能描述。',
      },
      {
        id: crypto.randomUUID(),
        label: '生成 API 文档',
        prompt: '基于以下接口分析，请生成完整的 API 文档。每个 API 包括：功能描述、参数说明、返回值说明、异常情况和注意事项。使用 Markdown 格式。\n\n接口分析：\n{{prev}}',
      },
      {
        id: crypto.randomUUID(),
        label: '生成使用示例',
        prompt: '基于以下 API 文档，请为每个主要 API 编写实用的使用示例。包括基础用法、高级用法和常见场景示例。示例代码应该可以直接运行。\n\nAPI 文档：\n{{prev}}',
      },
    ],
  },
]

// ==================== Store ====================

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      workflows: PRESET_WORKFLOWS.map((w) => ({
        ...w,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })),
      execution: null,

      addWorkflow: (workflow) => {
        const newWorkflow: Workflow = {
          ...workflow,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({
          workflows: [newWorkflow, ...state.workflows],
        }))
        return newWorkflow
      },

      updateWorkflow: (id, updates) => {
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === id ? { ...w, ...updates, updatedAt: Date.now() } : w
          ),
        }))
      },

      removeWorkflow: (id) => {
        set((state) => ({
          workflows: state.workflows.filter((w) => w.id !== id),
        }))
      },

      startExecution: (workflow) => {
        set({
          execution: {
            workflowId: workflow.id,
            workflowName: workflow.name,
            currentStepIndex: 0,
            totalSteps: workflow.steps.length,
            status: 'running',
            prevOutput: '',
          },
        })
      },

      advanceStep: (prevOutput) => {
        const { execution, workflows } = get()
        if (!execution || execution.status !== 'running') return null

        const workflow = workflows.find((w) => w.id === execution.workflowId)
        if (!workflow) return null

        const nextIndex = execution.currentStepIndex + 1
        if (nextIndex >= workflow.steps.length) {
          // 所有步骤已完成
          set({
            execution: { ...execution, status: 'completed', prevOutput },
          })
          return null
        }

        // 推进到下一步
        set({
          execution: {
            ...execution,
            currentStepIndex: nextIndex,
            prevOutput,
          },
        })

        // 返回下一步（已替换 {{prev}}）
        const nextStep = workflow.steps[nextIndex]
        return {
          ...nextStep,
          prompt: nextStep.prompt.replace(/\{\{prev\}\}/g, prevOutput),
        }
      },

      stopExecution: () => {
        set({ execution: null })
      },

      completeExecution: () => {
        const { execution } = get()
        if (execution) {
          set({
            execution: { ...execution, status: 'completed' },
          })
          // 2 秒后自动清除完成状态
          setTimeout(() => {
            const current = get().execution
            if (current && current.status === 'completed') {
              set({ execution: null })
            }
          }, 3000)
        }
      },

      setExecutionError: () => {
        const { execution } = get()
        if (execution) {
          set({
            execution: { ...execution, status: 'error' },
          })
        }
      },
    }),
    {
      name: 'claude-code-chat-workflows',
      partialize: (state) => ({
        workflows: state.workflows,
        // execution 不持久化 — 页面刷新后执行状态消失
      }),
    }
  )
)
