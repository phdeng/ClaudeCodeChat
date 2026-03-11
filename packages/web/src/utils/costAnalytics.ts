/**
 * Token 成本分析工具函数
 * 从 sessionStore 的 sessions 聚合计算 token 消耗和成本
 */
import type { Session } from '../stores/sessionStore'

/** 模型单价表 (USD per 1M tokens) */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  sonnet: { input: 3, output: 15 },
  opus: { input: 15, output: 75 },
  haiku: { input: 0.8, output: 4 },
}

/** 默认使用 Sonnet 价格 */
const DEFAULT_PRICING = MODEL_PRICING.sonnet

/**
 * 根据模型名称匹配价格
 */
function getPricing(model: string | undefined) {
  if (!model) return DEFAULT_PRICING
  const lower = model.toLowerCase()
  if (lower.includes('opus')) return MODEL_PRICING.opus
  if (lower.includes('haiku')) return MODEL_PRICING.haiku
  if (lower.includes('sonnet')) return MODEL_PRICING.sonnet
  return DEFAULT_PRICING
}

/**
 * 计算成本 (USD)
 */
function calcCost(inputTokens: number, outputTokens: number, pricing: { input: number; output: number }): number {
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}

/** 概览统计 */
export interface OverviewStats {
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCostUsd: number
  totalSessions: number
  avgTokensPerSession: number
}

/** 每日用量 */
export interface DailyUsage {
  date: string // YYYY-MM-DD
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

/** 模型使用分布 */
export interface ModelUsage {
  model: string
  messageCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
}

/** 项目用量 */
export interface ProjectUsage {
  project: string
  displayName: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
  sessionCount: number
}

/**
 * 计算概览统计数据
 */
export function computeOverview(sessions: Session[]): OverviewStats {
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCostUsd = 0

  for (const session of sessions) {
    const pricing = getPricing(session.workingDirectory ? undefined : undefined)
    for (const msg of session.messages) {
      if (msg.role === 'assistant' && msg.tokenUsage) {
        totalInputTokens += msg.tokenUsage.inputTokens
        totalOutputTokens += msg.tokenUsage.outputTokens
        totalCostUsd += calcCost(msg.tokenUsage.inputTokens, msg.tokenUsage.outputTokens, pricing)
      }
    }
  }

  const totalTokens = totalInputTokens + totalOutputTokens
  const totalSessions = sessions.length
  const avgTokensPerSession = totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0

  return { totalInputTokens, totalOutputTokens, totalTokens, totalCostUsd, totalSessions, avgTokensPerSession }
}

/**
 * 计算最近 N 天的每日 token 用量
 */
export function computeDailyUsage(sessions: Session[], days: number = 14): DailyUsage[] {
  const now = new Date()
  const dateMap = new Map<string, { inputTokens: number; outputTokens: number }>()

  // 初始化最近 N 天的日期
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dateMap.set(key, { inputTokens: 0, outputTokens: 0 })
  }

  // 聚合消息
  for (const session of sessions) {
    for (const msg of session.messages) {
      if (msg.role === 'assistant' && msg.tokenUsage) {
        const dateKey = new Date(msg.timestamp).toISOString().slice(0, 10)
        const entry = dateMap.get(dateKey)
        if (entry) {
          entry.inputTokens += msg.tokenUsage.inputTokens
          entry.outputTokens += msg.tokenUsage.outputTokens
        }
      }
    }
  }

  return Array.from(dateMap.entries()).map(([date, usage]) => ({
    date,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.inputTokens + usage.outputTokens,
  }))
}

/**
 * 计算模型使用分布
 */
export function computeModelUsage(sessions: Session[]): ModelUsage[] {
  const modelMap = new Map<string, { messageCount: number; inputTokens: number; outputTokens: number }>()

  for (const session of sessions) {
    for (const msg of session.messages) {
      if (msg.role === 'assistant' && msg.tokenUsage) {
        // 尝试从 selectedModel 获取模型名称
        const model = (session as unknown as Record<string, unknown>).selectedModel as string
          || 'unknown'
        const existing = modelMap.get(model) || { messageCount: 0, inputTokens: 0, outputTokens: 0 }
        existing.messageCount += 1
        existing.inputTokens += msg.tokenUsage.inputTokens
        existing.outputTokens += msg.tokenUsage.outputTokens
        modelMap.set(model, existing)
      }
    }
  }

  return Array.from(modelMap.entries())
    .map(([model, data]) => {
      const pricing = getPricing(model)
      return {
        model: model || 'default',
        messageCount: data.messageCount,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.inputTokens + data.outputTokens,
        costUsd: calcCost(data.inputTokens, data.outputTokens, pricing),
      }
    })
    .sort((a, b) => b.totalTokens - a.totalTokens)
}

/**
 * 计算项目 Top N 用量
 */
export function computeProjectUsage(sessions: Session[], topN: number = 5): ProjectUsage[] {
  const projectMap = new Map<string, { inputTokens: number; outputTokens: number; sessionCount: number }>()

  for (const session of sessions) {
    const project = session.workingDirectory || 'unknown'
    const existing = projectMap.get(project) || { inputTokens: 0, outputTokens: 0, sessionCount: 0 }
    existing.sessionCount += 1

    for (const msg of session.messages) {
      if (msg.role === 'assistant' && msg.tokenUsage) {
        existing.inputTokens += msg.tokenUsage.inputTokens
        existing.outputTokens += msg.tokenUsage.outputTokens
      }
    }

    projectMap.set(project, existing)
  }

  return Array.from(projectMap.entries())
    .map(([project, data]) => {
      const displayName = project === 'unknown'
        ? 'unknown'
        : project.replace(/\\/g, '/').split('/').filter(Boolean).pop() || project
      return {
        project,
        displayName,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.inputTokens + data.outputTokens,
        costUsd: calcCost(data.inputTokens, data.outputTokens, DEFAULT_PRICING),
        sessionCount: data.sessionCount,
      }
    })
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, topN)
}

/**
 * 格式化 token 数量 (K / M)
 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

/**
 * 格式化 USD
 */
export function formatUsd(n: number): string {
  if (n < 0.01 && n > 0) return '<$0.01'
  return '$' + n.toFixed(2)
}
