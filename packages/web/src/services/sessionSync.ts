import type { Session } from '../stores/sessionStore'
import { useSessionStore } from '../stores/sessionStore'

/**
 * 会话同步服务
 * 负责前端 Zustand store 与后端持久化 API 之间的数据同步
 */

/** 后端返回的会话列表项（不含消息） */
interface SessionListItem {
  id: string
  title: string
  createdAt: number
  pinned?: boolean
  tags?: string[]
  messageCount: number
}

/**
 * 批量同步前端所有会话到后端
 * 使用 /api/chat-sessions/sync 端点整体替换后端存储
 */
export async function syncSessionsToBackend(sessions: Session[]): Promise<void> {
  // 同步时去掉 isStreaming 等前端运行时状态，只保留持久化字段
  const cleaned = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    messages: s.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      tokenUsage: m.tokenUsage,
      feedback: m.feedback,
      bookmarked: m.bookmarked,
      reactions: m.reactions,
      pinned: m.pinned,
    })),
    createdAt: s.createdAt,
    workingDirectory: s.workingDirectory,
    pinned: s.pinned,
    systemPrompt: s.systemPrompt,
    tags: s.tags,
    archived: s.archived,
    sortOrder: s.sortOrder,
    colorLabel: s.colorLabel,
  }))

  const res = await fetch('/api/chat-sessions/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessions: cleaned }),
  })

  if (!res.ok) {
    throw new Error(`同步失败: ${res.status} ${res.statusText}`)
  }
}

/**
 * 从后端加载所有会话的完整数据
 * 先获取列表，再并发加载包含消息的完整会话（限制最多 5 个同时请求）
 */
export async function loadSessionsFromBackend(): Promise<Session[]> {
  // 获取会话列表
  const listRes = await fetch('/api/chat-sessions')
  if (!listRes.ok) return []

  const listData = await listRes.json() as { sessions: SessionListItem[] }
  const items = listData.sessions || []
  if (items.length === 0) return []

  // 并发加载完整会话数据（含消息内容），限制并发数为 5
  const CONCURRENCY_LIMIT = 5
  const fullSessions: Session[] = []

  for (let i = 0; i < items.length; i += CONCURRENCY_LIMIT) {
    const batch = items.slice(i, i + CONCURRENCY_LIMIT)
    const results = await Promise.all(
      batch.map(async (item) => {
        try {
          const detailRes = await fetch(`/api/chat-sessions/${item.id}`)
          if (detailRes.ok) {
            return await detailRes.json() as Session
          }
        } catch {
          console.warn(`加载会话 ${item.id} 失败，已跳过`)
        }
        return null
      })
    )
    for (const session of results) {
      if (session) {
        fullSessions.push(session)
      }
    }
  }

  return fullSessions
}

/**
 * 保存单个会话到后端
 */
export async function saveSessionToBackend(session: Session): Promise<void> {
  const cleaned = {
    id: session.id,
    title: session.title,
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      tokenUsage: m.tokenUsage,
      feedback: m.feedback,
      bookmarked: m.bookmarked,
      reactions: m.reactions,
      pinned: m.pinned,
    })),
    createdAt: session.createdAt,
    workingDirectory: session.workingDirectory,
    pinned: session.pinned,
    systemPrompt: session.systemPrompt,
    tags: session.tags,
    archived: session.archived,
    sortOrder: session.sortOrder,
    colorLabel: session.colorLabel,
  }

  const res = await fetch('/api/chat-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleaned),
  })

  if (!res.ok) {
    throw new Error(`保存会话失败: ${res.status} ${res.statusText}`)
  }
}

/**
 * 从后端删除指定会话
 */
export async function deleteSessionFromBackend(id: string): Promise<void> {
  const res = await fetch(`/api/chat-sessions/${id}`, { method: 'DELETE' })
  // 404 表示后端本来就没有该会话，不算错误
  if (!res.ok && res.status !== 404) {
    throw new Error(`删除会话失败: ${res.status} ${res.statusText}`)
  }
}

// ==================== 自动同步机制 ====================

let syncTimer: ReturnType<typeof setTimeout> | null = null
let unsubscribe: (() => void) | null = null

/**
 * 初始化自动同步
 * 监听 Zustand store 的 sessions 变化，防抖 5 秒后自动同步到后端
 * 应在应用启动时调用一次
 */
export function initAutoSync(): void {
  // 防止重复初始化
  if (unsubscribe) return

  unsubscribe = useSessionStore.subscribe((state, prevState) => {
    // 只在 sessions 引用变化时触发（Zustand immutable update）
    if (state.sessions !== prevState.sessions) {
      if (syncTimer) clearTimeout(syncTimer)
      syncTimer = setTimeout(() => {
        state.syncToBackend()
      }, 5000)
    }
  })
}

/**
 * 销毁自动同步（一般不需要调用，仅供测试使用）
 */
export function destroyAutoSync(): void {
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
}
