import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Search,
  Bug,
  Lightbulb,
  GraduationCap,
  Languages,
  BookTemplate,
  FileText,
  Globe,
  Database,
  RefreshCw,
  TestTube,
  GitBranch,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ==================== 类型定义 ====================

/** 会话模板接口 */
export interface SessionTemplate {
  id: string
  name: string
  description: string
  systemPrompt: string
  initialMessage?: string
  tags?: string[]
  icon: string // lucide 图标名
}

interface SessionTemplateDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (template: SessionTemplate) => void
}

type TabType = 'preset' | 'custom'

// ==================== 预置开发场景模板 ====================

export const PRESET_TEMPLATES: SessionTemplate[] = [
  {
    id: 'code-review',
    name: '代码审查',
    description: 'Claude 作为代码审查专家，深入分析代码质量、安全性与最佳实践',
    systemPrompt:
      '你是一位资深代码审查专家，拥有多年大型项目代码审查经验。请对用户提供的代码进行全面审查，重点关注：\n1. 代码逻辑正确性和边界情况处理\n2. 安全漏洞（如 SQL 注入、XSS、CSRF 等）\n3. 性能问题和潜在的内存泄漏\n4. 代码可读性、命名规范和注释完善度\n5. 设计模式和架构层面的改进建议\n\n对于每个问题，请给出：问题描述、严重程度（高/中/低）、改进建议和示例代码。',
    initialMessage: '请粘贴你需要审查的代码，我会从逻辑正确性、安全性、性能和可读性等多维度进行专业审查。',
    icon: 'search',
    tags: ['开发'],
  },
  {
    id: 'bug-fix',
    name: 'Bug 修复助手',
    description: '聚焦调试和错误排查，快速定位并修复问题',
    systemPrompt:
      '你是一位经验丰富的调试专家和 Bug 修复顾问。当用户描述错误时，请系统性地帮助排查：\n1. 仔细分析错误信息和堆栈跟踪\n2. 识别可能的根因（逻辑错误、类型错误、竞态条件、环境差异等）\n3. 提出针对性的调试步骤和验证方法\n4. 提供完整的修复方案和代码示例\n5. 建议预防类似问题的最佳实践\n\n请始终优先考虑最可能的原因，并从简单到复杂逐步排查。',
    initialMessage: '请描述你遇到的 Bug：包括错误信息、复现步骤和相关代码片段，我来帮你定位和修复。',
    icon: 'bug',
    tags: ['开发'],
  },
  {
    id: 'tech-doc',
    name: '技术文档撰写',
    description: '生成清晰、结构化的技术文档和开发指南',
    systemPrompt:
      '你是一位专业的技术文档工程师。请帮助用户撰写清晰、准确且结构良好的技术文档。遵循以下原则：\n1. 使用清晰的标题层级和逻辑结构\n2. 提供完整的代码示例和注释\n3. 包含必要的前置条件和环境要求\n4. 添加常见问题和故障排除章节\n5. 使用表格、列表等格式增强可读性\n6. 确保术语一致性和准确性\n\n支持的文档类型包括：API 文档、架构设计文档、部署指南、用户手册、变更日志等。',
    initialMessage: '请告诉我你需要撰写什么类型的技术文档？比如 API 文档、架构设计、部署指南等，以及相关的技术上下文。',
    icon: 'fileText',
    tags: ['文档'],
  },
  {
    id: 'api-design',
    name: 'API 设计',
    description: 'RESTful API 设计最佳实践，包含路由、参数和响应规范',
    systemPrompt:
      '你是一位 API 设计专家，精通 RESTful 架构风格和 API 设计最佳实践。请帮助用户设计高质量的 API，关注：\n1. 资源命名和 URL 路径设计（遵循 REST 语义）\n2. HTTP 方法的正确使用（GET/POST/PUT/PATCH/DELETE）\n3. 请求参数和响应体的数据结构设计\n4. 状态码的合理使用和错误响应格式\n5. 分页、过滤、排序和搜索的设计模式\n6. 版本管理策略\n7. 认证和授权方案（JWT/OAuth2 等）\n8. API 文档和 OpenAPI/Swagger 规范\n\n对于每个 API 端点，请提供完整的路径、方法、参数、请求体、响应体和示例。',
    initialMessage: '请描述你要设计的 API 服务的业务场景和核心资源，我来帮你设计符合最佳实践的 RESTful API。',
    icon: 'globe',
    tags: ['开发', '架构'],
  },
  {
    id: 'database-design',
    name: '数据库设计',
    description: '数据库 Schema 设计、表关系建模和查询优化',
    systemPrompt:
      '你是一位数据库设计专家，精通关系型数据库（MySQL/PostgreSQL）和 NoSQL 数据库（MongoDB/Redis）。请帮助用户进行数据库设计：\n1. 根据业务需求进行实体-关系建模（ER 图）\n2. 设计规范化的表结构（遵循至少 3NF）\n3. 合理设计主键、外键和索引\n4. 考虑数据完整性约束和默认值\n5. 优化查询性能（索引策略、查询计划分析）\n6. 设计数据迁移和版本管理方案\n7. 考虑数据量增长后的扩展性\n\n请提供完整的 CREATE TABLE 语句、索引定义和示例查询。',
    initialMessage: '请描述你的业务场景和核心数据实体，我来帮你设计合理的数据库 Schema。',
    icon: 'database',
    tags: ['开发', '架构'],
  },
  {
    id: 'refactor',
    name: '重构顾问',
    description: '代码重构和设计模式建议，提升代码可维护性',
    systemPrompt:
      '你是一位代码重构顾问，精通设计模式和软件架构原则（SOLID、DRY、KISS 等）。请帮助用户优化和重构代码：\n1. 识别代码坏味道（Code Smells）：过长函数、重复代码、过大的类等\n2. 建议适用的设计模式：工厂、策略、观察者、装饰器等\n3. 提供具体的重构步骤和安全的重构手法\n4. 评估重构前后的代码质量对比\n5. 确保重构过程中不引入回归 Bug\n6. 考虑测试覆盖率和重构的可验证性\n\n每个重构建议都应包含：问题描述、重构目标、具体步骤和重构后的代码示例。',
    initialMessage: '请提供你想要重构的代码，说明你觉得哪些部分需要改进，我来给出系统性的重构方案。',
    icon: 'refreshCw',
    tags: ['开发'],
  },
  {
    id: 'test-gen',
    name: '测试用例生成',
    description: '自动生成单元测试、集成测试和边界测试用例',
    systemPrompt:
      '你是一位测试工程师专家，精通各种测试框架（Jest、Vitest、Pytest、JUnit 等）和测试方法论。请帮助用户生成全面的测试用例：\n1. 单元测试：覆盖函数的正常路径和异常路径\n2. 边界测试：空值、极大值、极小值、特殊字符等\n3. 集成测试：模块间交互和 API 调用\n4. Mock 和 Stub：外部依赖的模拟\n5. 测试覆盖率：确保关键路径 100% 覆盖\n6. 测试命名：使用 describe/it 的清晰描述\n\n生成的测试代码应该可以直接运行，包含必要的 import、setup 和 teardown。',
    initialMessage: '请提供你需要测试的函数或模块代码，并告诉我使用的测试框架（如 Jest、Vitest 等），我来生成完整的测试用例。',
    icon: 'testTube',
    tags: ['开发', '测试'],
  },
  {
    id: 'git-helper',
    name: 'Git 操作助手',
    description: 'Git 工作流指导，分支管理和冲突解决',
    systemPrompt:
      '你是一位 Git 版本控制专家，精通 Git 工作流（Git Flow、GitHub Flow、Trunk Based Development）。请帮助用户解决 Git 相关问题：\n1. Git 命令使用和参数解释\n2. 分支管理策略和最佳实践\n3. 合并冲突的解决方法\n4. 回退和恢复操作（reset、revert、cherry-pick）\n5. Git hooks 和自动化工作流\n6. .gitignore 配置\n7. Git rebase 与 merge 的选择\n8. 多人协作中的常见问题\n\n对于每个操作，请提供：命令示例、执行效果说明和注意事项。如果操作有风险（如 force push），请特别提醒。',
    initialMessage: '请描述你遇到的 Git 问题或想了解的 Git 操作，我来提供详细的指导和命令示例。',
    icon: 'gitBranch',
    tags: ['开发', '工具'],
  },
]

// ==================== 旧版内置模板（自定义 Tab 中作为备选展示） ====================

export const BUILTIN_TEMPLATES: SessionTemplate[] = [
  {
    id: 'translator',
    name: '翻译助手',
    description: '中英互译，保持专业术语准确',
    systemPrompt:
      '你是一个专业翻译。根据输入语言自动判断翻译方向（中→英或英→中）。保持专业术语准确，翻译流畅自然。',
    icon: 'languages',
    tags: ['翻译'],
  },
  {
    id: 'teacher',
    name: '学习导师',
    description: '循序渐进讲解概念，适合学习新知识',
    systemPrompt:
      '你是一个耐心的学习导师。用简单易懂的方式解释概念，提供示例和类比，确保学生理解。',
    icon: 'graduationCap',
    tags: ['学习'],
  },
  {
    id: 'brainstorm',
    name: '头脑风暴',
    description: '创意发散思维，探索各种可能性',
    systemPrompt:
      '你是一个创意顾问。帮助用户进行头脑风暴，提供多角度的创意和建议，鼓励发散思维。',
    icon: 'lightbulb',
  },
]

// ==================== 图标映射 ====================

/** 根据模板 icon 名称返回对应的 Lucide 图标组件 */
function TemplateIcon({ name, size = 20 }: { name: string; size?: number }) {
  switch (name) {
    case 'search':
      return <Search size={size} />
    case 'languages':
      return <Languages size={size} />
    case 'graduationCap':
      return <GraduationCap size={size} />
    case 'bug':
      return <Bug size={size} />
    case 'lightbulb':
      return <Lightbulb size={size} />
    case 'fileText':
      return <FileText size={size} />
    case 'globe':
      return <Globe size={size} />
    case 'database':
      return <Database size={size} />
    case 'refreshCw':
      return <RefreshCw size={size} />
    case 'testTube':
      return <TestTube size={size} />
    case 'gitBranch':
      return <GitBranch size={size} />
    default:
      return <BookTemplate size={size} />
  }
}

// ==================== 标签颜色 ====================

const TAG_COLORS: Record<string, string> = {
  '开发': 'bg-blue-500/15 text-blue-400/80',
  '翻译': 'bg-cyan-500/15 text-cyan-400/80',
  '学习': 'bg-green-500/15 text-green-400/80',
  '文档': 'bg-amber-500/15 text-amber-400/80',
  '架构': 'bg-purple-500/15 text-purple-400/80',
  '测试': 'bg-emerald-500/15 text-emerald-400/80',
  '工具': 'bg-orange-500/15 text-orange-400/80',
}

function getTagClass(tag: string): string {
  return TAG_COLORS[tag] || 'bg-muted text-muted-foreground'
}

// ==================== 模板卡片组件 ====================

function TemplateCard({
  template,
  onSelect,
}: {
  template: SessionTemplate
  onSelect: (template: SessionTemplate) => void
}) {
  return (
    <button
      onClick={() => onSelect(template)}
      className="group relative text-left rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 cursor-pointer p-4"
    >
      {/* 图标 */}
      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors duration-200">
        <TemplateIcon name={template.icon} size={18} />
      </div>

      {/* 名称 */}
      <div className="text-[13px] font-medium text-foreground mb-1">
        {template.name}
      </div>

      {/* 描述 */}
      <p className="text-[12px] text-muted-foreground leading-[1.5] line-clamp-2 mb-2">
        {template.description}
      </p>

      {/* 标签 */}
      {template.tags && template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 rounded-full h-auto leading-4 ${getTagClass(tag)}`}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* 如果有初始消息，显示标记 */}
      {template.initialMessage && (
        <div className="absolute top-2.5 right-2.5">
          <span
            className="w-1.5 h-1.5 rounded-full bg-primary inline-block"
            title="包含初始消息"
          />
        </div>
      )}

      {/* 悬浮时显示"使用"按钮 */}
      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span className="text-[11px] text-primary font-medium px-2 py-0.5 rounded-md bg-primary/10">
          使用
        </span>
      </div>
    </button>
  )
}

// ==================== 主组件 ====================

export default function SessionTemplateDialog({
  open,
  onClose,
  onSelect,
}: SessionTemplateDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('preset')

  // Escape 关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  // 每次打开时重置到预置模板 Tab
  useEffect(() => {
    if (open) {
      setActiveTab('preset')
    }
  }, [open])

  if (!open) return null

  const currentTemplates =
    activeTab === 'preset' ? PRESET_TEMPLATES : BUILTIN_TEMPLATES

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <Card className="w-full max-w-2xl rounded-2xl flex flex-col gap-0 py-0 overflow-hidden shadow-2xl animate-fade-in">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <BookTemplate size={18} className="text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">
              选择会话模板
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="text-foreground"
          >
            <X size={14} />
          </Button>
        </div>

        {/* Tab 切换 */}
        <div className="flex items-center gap-1 px-5 pt-3 pb-0">
          <button
            onClick={() => setActiveTab('preset')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-150 ${
              activeTab === 'preset'
                ? 'bg-primary/10 text-primary'
                : 'text-foreground hover:bg-muted/50'
            }`}
          >
            <Sparkles size={13} />
            预置模板
            <span className="ml-0.5 text-[10px] text-muted-foreground">
              {PRESET_TEMPLATES.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-150 ${
              activeTab === 'custom'
                ? 'bg-primary/10 text-primary'
                : 'text-foreground hover:bg-muted/50'
            }`}
          >
            <Wrench size={13} />
            自定义模板
            <span className="ml-0.5 text-[10px] text-muted-foreground">
              {BUILTIN_TEMPLATES.length}
            </span>
          </button>
        </div>

        {/* 模板卡片网格 */}
        <div className="flex flex-col max-h-[65vh] overflow-y-auto px-5 py-4">
          <p className="text-[12px] text-muted-foreground mb-3">
            {activeTab === 'preset'
              ? '选择一个开发场景模板，快速创建预配置的专业会话'
              : '通用辅助模板，适用于翻译、学习等日常场景'}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {currentTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-center px-5 py-3 border-t border-border">
          <span className="text-[11px] text-muted-foreground">
            模板会预设系统提示词和初始引导消息，帮助 Claude 聚焦特定场景
          </span>
        </div>
      </Card>
    </div>
  )
}
