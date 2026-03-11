import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// 数据存储目录和文件路径
const DATA_DIR = path.join(os.homedir(), '.claude-code-chat')
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json')

// 单条消息最大数量限制（超过则截断历史）
const MAX_MESSAGES_PER_SESSION = 500

/** 存储的消息结构 */
export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  tokenUsage?: { inputTokens: number; outputTokens: number }
  feedback?: 'up' | 'down' | null
  bookmarked?: boolean
  reactions?: Record<string, number>
  pinned?: boolean
}

/** 存储的会话结构 */
export interface StoredSession {
  id: string
  title: string
  messages: StoredMessage[]
  createdAt: number
  workingDirectory?: string
  pinned?: boolean
  systemPrompt?: string
  tags?: string[]
  archived?: boolean
  sortOrder?: number
  colorLabel?: string
}

/** 会话列表项（不含完整消息，减少传输量） */
export interface SessionListItem {
  id: string
  title: string
  createdAt: number
  pinned?: boolean
  tags?: string[]
  messageCount: number
}

/**
 * 基于 JSON 文件的会话持久化存储服务
 *
 * 特点：
 * - 使用内存缓存避免频繁磁盘读取
 * - 写入操作使用简单互斥锁避免并发冲突
 * - 自动截断超过上限的消息历史
 */
export class SessionStorage {
  /** 内存缓存 */
  private cache: StoredSession[] | null = null
  /** 写锁：防止并发写入冲突 */
  private writeLock: Promise<void> = Promise.resolve()

  /**
   * 确保数据目录存在
   */
  async ensureDir(): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }

  /**
   * 加载所有会话数据（优先使用缓存）
   */
  async loadAll(): Promise<StoredSession[]> {
    if (this.cache) return this.cache
    try {
      await this.ensureDir()
      const data = await fs.readFile(SESSIONS_FILE, 'utf-8')
      this.cache = JSON.parse(data)
      return this.cache!
    } catch {
      // 文件不存在或解析失败，返回空数组
      this.cache = []
      return []
    }
  }

  /**
   * 保存所有会话数据到磁盘（带写锁）
   */
  async saveAll(sessions: StoredSession[]): Promise<void> {
    // 使用写锁确保串行写入
    this.writeLock = this.writeLock.then(async () => {
      this.cache = sessions
      await this.ensureDir()
      // 先写入临时文件再重命名，避免写入中断导致数据损坏
      const tmpFile = SESSIONS_FILE + '.tmp'
      await fs.writeFile(tmpFile, JSON.stringify(sessions, null, 2), 'utf-8')
      await fs.rename(tmpFile, SESSIONS_FILE)
    }).catch((err) => {
      console.error('保存会话数据失败:', err)
    })
    await this.writeLock
  }

  /**
   * 获取所有会话的列表信息（不含消息内容）
   */
  async listSessions(): Promise<SessionListItem[]> {
    const sessions = await this.loadAll()
    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      pinned: s.pinned,
      tags: s.tags,
      messageCount: s.messages.length,
    }))
  }

  /**
   * 获取单个会话的完整数据
   */
  async getSession(id: string): Promise<StoredSession | undefined> {
    const sessions = await this.loadAll()
    return sessions.find((s) => s.id === id)
  }

  /**
   * 创建或更新会话（upsert 语义）
   * - 如果会话已存在则更新
   * - 如果不存在则插入到列表开头
   * - 自动截断超过上限的消息
   */
  async upsertSession(session: StoredSession): Promise<void> {
    // 截断超过上限的消息历史（保留最新的）
    if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
      session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION)
    }

    const sessions = await this.loadAll()
    const index = sessions.findIndex((s) => s.id === session.id)
    if (index >= 0) {
      sessions[index] = session
    } else {
      sessions.unshift(session)
    }
    await this.saveAll(sessions)
  }

  /**
   * 删除指定会话
   */
  async deleteSession(id: string): Promise<boolean> {
    const sessions = await this.loadAll()
    const filtered = sessions.filter((s) => s.id !== id)
    if (filtered.length === sessions.length) {
      return false // 未找到该会话
    }
    await this.saveAll(filtered)
    return true
  }

  /**
   * 批量同步会话数据（前端发送全部会话，后端整体替换）
   * 自动截断每个会话超过上限的消息
   */
  async syncAll(sessions: StoredSession[]): Promise<void> {
    // 截断每个会话的消息
    for (const session of sessions) {
      if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
        session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION)
      }
    }
    await this.saveAll(sessions)
  }

  /**
   * 清除内存缓存，强制下次从磁盘读取
   */
  invalidateCache(): void {
    this.cache = null
  }
}

/** 全局单例 */
export const sessionStorage = new SessionStorage()
