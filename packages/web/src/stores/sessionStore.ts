import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  syncSessionsToBackend,
  loadSessionsFromBackend,
  deleteSessionFromBackend,
} from '../services/sessionSync'

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
  tokenUsage?: TokenUsage
  /** 用户对助手消息的反馈：点赞/踩/无 */
  feedback?: 'up' | 'down' | null
  /** 消息是否被收藏 */
  bookmarked?: boolean
  /** Emoji 反应：emoji 字符 → 计数 */
  reactions?: Record<string, number>
  /** 消息是否被固定/置顶 */
  pinned?: boolean
  /** 消息版本历史：编辑或重新生成时，旧内容保存到此数组 */
  versions?: { content: string; timestamp: number }[]
  /** 用户消息附带的图片（base64 data URLs） */
  images?: Array<{ base64: string; name: string }>
}

export interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  workingDirectory?: string
  pinned?: boolean
  /** 会话自定义系统提示词 */
  systemPrompt?: string
  /** 会话彩色标签，用于分类和组织对话 */
  tags?: string[]
  /** 会话是否已归档 */
  archived?: boolean
  /** 自定义排序序号，用于拖拽排序 */
  sortOrder?: number
  /** 颜色标签，用于视觉分类（存储颜色名称如 red/blue 等） */
  colorLabel?: string
  /** 上下文摘要：用户手动添加的关键要点列表 */
  contextNotes?: string[]
  /** 未读消息计数（默认 0） */
  unreadCount?: number
  /** CLI 会话 ID（由 Claude CLI 分配，用于 --session-id 继续对话） */
  cliSessionId?: string
  /** CLI 推理深度 (low/medium/high/max) */
  effort?: 'low' | 'medium' | 'high' | 'max'
  /** CLI 硬预算限制（美元） */
  maxBudgetUsd?: number
  /** CLI 备选模型（主模型过载时自动降级） */
  fallbackModel?: string
  /** CLI 允许的工具列表 */
  allowedTools?: string[]
  /** CLI 禁止的工具列表 */
  disallowedTools?: string[]
  /** 会话自动摘要 */
  summary?: string
  /** 关键话题标签 */
  keyTopics?: string[]
  /** 父会话 ID（从哪个会话 fork 的） */
  parentSessionId?: string
  /** 从第几条消息 fork 的 */
  forkFromMessageIndex?: number
}

interface SessionState {
  sessions: Session[]
  activeSessionId: string | null
  selectedModel: string
  /** 权限模式：default/plan/auto */
  permissionMode: string
  connectionStatus: 'connected' | 'connecting' | 'disconnected'
  /** 草稿映射：会话 ID → 草稿内容 */
  drafts: Record<string, string>
  /** 当前项目筛选路径（运行时状态，不持久化） */
  projectFilter: string | null
  /** 网络延迟（毫秒），null 表示未测量 */
  networkLatency: number | null
  /** 当前重连次数 */
  reconnectCount: number
  /** 最后断开连接的时间戳 */
  lastDisconnectedAt: number | null
  /** 后端版本号 */
  backendVersion: string | null
  /** 标记是否有中断的流式消息需要恢复 */
  interruptedStreamingSessionId: string | null
  interruptedStreamingMsgId: string | null
  /** 正在流式传输的会话 ID 集合（运行时状态，不持久化） */
  streamingSessions: Set<string>
  /** 打开的标签页 sessionId 列表（运行时状态，不持久化） */
  openTabs: string[]
  /** 添加标签页 */
  addTab: (sessionId: string) => void
  /** 关闭标签页 */
  removeTab: (sessionId: string) => void
  /** 拖拽排序标签页 */
  reorderTabs: (from: number, to: number) => void
  /** 已关闭的智能提示类型集合（持久化到 localStorage） */
  dismissedHints: string[]
  /** 关闭某个类型的智能提示 */
  dismissHint: (hintType: string) => void
  /** 检查某个提示是否已被关闭 */
  isHintDismissed: (hintType: string) => boolean
  createSession: () => Session
  deleteSession: (id: string) => void
  setActiveSession: (id: string) => void
  addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => string
  updateMessage: (sessionId: string, messageId: string, content: string) => void
  setMessageStreaming: (sessionId: string, messageId: string, isStreaming: boolean) => void
  updateSessionTitle: (sessionId: string, title: string) => void
  setSelectedModel: (model: string) => void
  /** 设置权限模式 */
  setPermissionMode: (mode: string) => void
  setSessionWorkingDirectory: (sessionId: string, dir: string) => void
  setCliSessionId: (sessionId: string, cliSessionId: string) => void
  setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected') => void
  updateMessageTokenUsage: (sessionId: string, messageId: string, tokenUsage: TokenUsage) => void
  togglePinSession: (sessionId: string) => void
  editMessage: (sessionId: string, messageId: string, newContent: string) => void
  deleteMessagesAfter: (sessionId: string, messageId: string) => void
  /** 设置消息反馈（点赞/踩），传 null 取消反馈 */
  setMessageFeedback: (sessionId: string, messageId: string, feedback: 'up' | 'down' | null) => void
  /** 设置会话的自定义系统提示词 */
  setSessionSystemPrompt: (sessionId: string, prompt: string) => void
  /** 导入会话：添加到列表开头并设为当前会话 */
  importSession: (session: Session) => void
  /** 为会话添加标签 */
  addSessionTag: (sessionId: string, tag: string) => void
  /** 移除会话标签 */
  removeSessionTag: (sessionId: string, tag: string) => void
  /** 切换会话归档状态 */
  toggleArchiveSession: (sessionId: string) => void
  /** 切换消息固定/置顶状态 */
  togglePinMessage: (sessionId: string, messageId: string) => void
  /** 切换消息收藏状态 */
  toggleMessageBookmark: (sessionId: string, messageId: string) => void
  /** 切换消息 emoji 反应：存在则递减（到 0 删除），不存在则设为 1 */
  toggleReaction: (sessionId: string, messageId: string, emoji: string) => void
  /** 获取所有已收藏的消息（按时间倒序） */
  getAllBookmarkedMessages: () => Array<{ sessionId: string; sessionTitle: string; message: Message }>
  /** 从指定消息处分叉会话，复制消息历史到新会话 */
  forkSession: (sessionId: string, upToMessageId: string) => Session | null
  /** 拖拽重排会话顺序（基于 sessions 数组索引） */
  reorderSessions: (fromIndex: number, toIndex: number) => void
  /** 拖拽重排消息顺序（基于指定会话的 messages 数组索引） */
  reorderMessages: (sessionId: string, fromIndex: number, toIndex: number) => void
  /** 恢复消息到指定版本（将当前内容存入 versions，然后用目标版本内容替换） */
  restoreMessageVersion: (sessionId: string, messageId: string, versionIndex: number) => void
  /** 将所有会话同步到后端 */
  syncToBackend: () => Promise<void>
  /** 从后端加载会话数据 */
  loadFromBackend: () => Promise<void>
  /** 最后一次成功同步的时间戳 */
  lastSyncTime: number | null
  /** 是否正在同步中 */
  isSyncing: boolean
  /** 保存草稿（空内容会删除草稿） */
  setDraft: (sessionId: string, content: string) => void
  /** 获取指定会话的草稿内容 */
  getDraft: (sessionId: string) => string
  /** 清除指定会话的草稿 */
  clearDraft: (sessionId: string) => void
  /** 设置会话颜色标签，传 null 取消颜色标签 */
  setSessionColorLabel: (sessionId: string, color: string | null) => void
  /** 添加上下文要点到指定会话 */
  addContextNote: (sessionId: string, note: string) => void
  /** 删除指定会话的某条上下文要点（按索引） */
  removeContextNote: (sessionId: string, index: number) => void
  /** 更新指定会话的某条上下文要点（按索引） */
  updateContextNote: (sessionId: string, index: number, note: string) => void
  /** 将指定会话的未读计数清零 */
  markSessionRead: (sessionId: string) => void
  /** 将指定会话的未读计数 +1 */
  incrementUnread: (sessionId: string) => void
  /** 设置项目筛选路径，传 null 显示全部项目 */
  setProjectFilter: (path: string | null) => void
  /** 设置网络延迟 */
  setNetworkLatency: (latency: number | null) => void
  /** 设置重连次数 */
  setReconnectCount: (count: number) => void
  /** 设置最后断开时间 */
  setLastDisconnectedAt: (timestamp: number | null) => void
  /** 设置后端版本号 */
  setBackendVersion: (version: string | null) => void
  /** 设置中断的流式消息信息 */
  setInterruptedStreaming: (sessionId: string | null, msgId: string | null) => void
  /** 添加一个正在流式传输的会话 */
  addStreamingSession: (sessionId: string) => void
  /** 移除一个正在流式传输的会话 */
  removeStreamingSession: (sessionId: string) => void
  /** 设置会话推理深度 */
  setSessionEffort: (sessionId: string, effort: Session['effort']) => void
  /** 设置会话硬预算限制（美元） */
  setSessionMaxBudget: (sessionId: string, maxBudgetUsd: number) => void
  /** 设置会话备选模型 */
  setSessionFallbackModel: (sessionId: string, model: string) => void
  /** 设置会话允许的工具列表 */
  setSessionAllowedTools: (sessionId: string, tools: string[]) => void
  /** 设置会话禁止的工具列表 */
  setSessionDisallowedTools: (sessionId: string, tools: string[]) => void
  /** 设置会话自动摘要 */
  setSessionSummary: (sessionId: string, summary: string, keyTopics?: string[]) => void
}

const generateId = () => crypto.randomUUID()

export const useSessionStore = create<SessionState>()(persist((set, get) => ({
  sessions: [],
  activeSessionId: null,
  selectedModel: '',
  permissionMode: 'default',
  connectionStatus: 'disconnected',
  drafts: {},
  projectFilter: null,
  networkLatency: null,
  reconnectCount: 0,
  lastDisconnectedAt: null,
  backendVersion: null,
  interruptedStreamingSessionId: null,
  interruptedStreamingMsgId: null,
  streamingSessions: new Set<string>(),
  openTabs: [],
  dismissedHints: [],
  lastSyncTime: null,
  isSyncing: false,

  addTab: (sessionId) => {
    set((state) => {
      if (state.openTabs.includes(sessionId)) return state
      // 最多 8 个标签页，超出时移除最早的（非当前激活的）
      let tabs = [...state.openTabs, sessionId]
      if (tabs.length > 8) {
        // 移除第一个非激活标签
        const removeIdx = tabs.findIndex(id => id !== state.activeSessionId && id !== sessionId)
        if (removeIdx !== -1) {
          tabs.splice(removeIdx, 1)
        } else {
          tabs = tabs.slice(-8)
        }
      }
      return { openTabs: tabs }
    })
  },

  removeTab: (sessionId) => {
    set((state) => {
      const tabs = state.openTabs.filter(id => id !== sessionId)
      // 如果关闭的是当前激活标签，切换到相邻标签
      if (state.activeSessionId === sessionId) {
        const oldIndex = state.openTabs.indexOf(sessionId)
        const nextActiveId = tabs[Math.min(oldIndex, tabs.length - 1)] || null
        return { openTabs: tabs, activeSessionId: nextActiveId }
      }
      return { openTabs: tabs }
    })
  },

  reorderTabs: (from, to) => {
    set((state) => {
      const tabs = [...state.openTabs]
      const [moved] = tabs.splice(from, 1)
      tabs.splice(to, 0, moved)
      return { openTabs: tabs }
    })
  },

  dismissHint: (hintType) => {
    set((state) => {
      if (state.dismissedHints.includes(hintType)) return state
      return { dismissedHints: [...state.dismissedHints, hintType] }
    })
  },

  isHintDismissed: (hintType) => {
    return get().dismissedHints.includes(hintType)
  },

  createSession: () => {
    const session: Session = {
      id: generateId(),
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
    }
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeSessionId: session.id,
      openTabs: state.openTabs.includes(session.id) ? state.openTabs : [...state.openTabs, session.id].slice(-8),
    }))
    return session
  },

  deleteSession: (id) => {
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
      openTabs: state.openTabs.filter((tabId) => tabId !== id),
    }))
    // 同时通知后端删除（静默处理失败）
    deleteSessionFromBackend(id).catch((err) => {
      console.warn('后端删除会话失败（不影响前端）:', err)
    })
  },

  setActiveSession: (id) => {
    set((state) => {
      const openTabs = state.openTabs.includes(id) ? state.openTabs : [...state.openTabs, id].slice(-8)
      return { activeSessionId: id, openTabs }
    })
  },

  addMessage: (sessionId, message) => {
    const id = generateId()
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, { ...message, id, timestamp: Date.now() }] }
          : s,
      ),
    }))
    return id
  },

  updateMessage: (sessionId, messageId, content) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) => (m.id === messageId ? { ...m, content } : m)),
            }
          : s,
      ),
    }))
  },

  setMessageStreaming: (sessionId, messageId, isStreaming) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) => (m.id === messageId ? { ...m, isStreaming } : m)),
            }
          : s,
      ),
    }))
  },

  updateSessionTitle: (sessionId, title) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, title } : s)),
    }))
  },

  setSessionWorkingDirectory: (sessionId, dir) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, workingDirectory: dir } : s)),
    }))
  },

  setCliSessionId: (sessionId, cliSessionId) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, cliSessionId } : s)),
    }))
  },

  setSelectedModel: (model) => {
    set({ selectedModel: model })
  },

  setPermissionMode: (mode) => {
    set({ permissionMode: mode })
  },

  setConnectionStatus: (status) => {
    set({ connectionStatus: status })
  },

  togglePinSession: (sessionId) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, pinned: !s.pinned } : s
      ),
    }))
  },

  toggleArchiveSession: (sessionId) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, archived: !s.archived } : s
      ),
    }))
  },

  updateMessageTokenUsage: (sessionId, messageId, tokenUsage) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) => (m.id === messageId ? { ...m, tokenUsage } : m)),
            }
          : s,
      ),
    }))
  },

  editMessage: (sessionId, messageId, newContent) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s
        const msgIndex = s.messages.findIndex((m) => m.id === messageId)
        if (msgIndex === -1) return s
        const oldMsg = s.messages[msgIndex]
        const updatedMessages = s.messages.slice(0, msgIndex + 1)
        // 将编辑前的内容保存到版本历史
        const oldVersions = oldMsg.versions || []
        const versions = [...oldVersions, { content: oldMsg.content, timestamp: Date.now() }]
        updatedMessages[msgIndex] = { ...oldMsg, content: newContent, versions }
        return { ...s, messages: updatedMessages }
      }),
    }))
  },

  deleteMessagesAfter: (sessionId, messageId) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s
        const msgIndex = s.messages.findIndex((m) => m.id === messageId)
        if (msgIndex === -1) return s
        return { ...s, messages: s.messages.slice(0, msgIndex) }
      }),
    }))
  },

  setMessageFeedback: (sessionId, messageId, feedback) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId ? { ...m, feedback } : m
              ),
            }
          : s,
      ),
    }))
  },

  setSessionSystemPrompt: (sessionId, prompt) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, systemPrompt: prompt } : s
      ),
    }))
  },

  importSession: (session) => {
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeSessionId: session.id,
    }))
  },

  addSessionTag: (sessionId, tag) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s
        const currentTags = s.tags || []
        // 避免重复添加
        if (currentTags.includes(tag)) return s
        return { ...s, tags: [...currentTags, tag] }
      }),
    }))
  },

  removeSessionTag: (sessionId, tag) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s
        const currentTags = s.tags || []
        return { ...s, tags: currentTags.filter((t) => t !== tag) }
      }),
    }))
  },

  toggleMessageBookmark: (sessionId, messageId) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId ? { ...m, bookmarked: !m.bookmarked } : m
              ),
            }
          : s,
      ),
    }))
  },

  toggleReaction: (sessionId, messageId, emoji) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s
        return {
          ...s,
          messages: s.messages.map((m) => {
            if (m.id !== messageId) return m
            const reactions = { ...(m.reactions || {}) }
            if (reactions[emoji] && reactions[emoji] > 0) {
              reactions[emoji] -= 1
              if (reactions[emoji] <= 0) delete reactions[emoji]
            } else {
              reactions[emoji] = 1
            }
            return { ...m, reactions: Object.keys(reactions).length > 0 ? reactions : undefined }
          }),
        }
      }),
    }))
  },

  getAllBookmarkedMessages: () => {
    const { sessions } = get()
    const result: Array<{ sessionId: string; sessionTitle: string; message: Message }> = []
    for (const session of sessions) {
      for (const message of session.messages) {
        if (message.bookmarked) {
          result.push({ sessionId: session.id, sessionTitle: session.title, message })
        }
      }
    }
    // 按时间倒序
    result.sort((a, b) => b.message.timestamp - a.message.timestamp)
    return result
  },

  forkSession: (sessionId, upToMessageId) => {
    const state = get()
    const sourceSession = state.sessions.find(s => s.id === sessionId)
    if (!sourceSession) return null

    const msgIndex = sourceSession.messages.findIndex(m => m.id === upToMessageId)
    if (msgIndex === -1) return null

    // 复制到目标消息为止的所有消息，生成新 ID 并清除流式/反馈/收藏状态
    const copiedMessages = sourceSession.messages.slice(0, msgIndex + 1).map(m => ({
      ...m,
      id: crypto.randomUUID(),
      isStreaming: false,
      feedback: undefined,
      bookmarked: undefined,
    }))

    const newSession: Session = {
      id: crypto.randomUUID(),
      title: `${sourceSession.title} (分叉)`,
      messages: copiedMessages,
      createdAt: Date.now(),
      workingDirectory: sourceSession.workingDirectory,
      systemPrompt: sourceSession.systemPrompt,
      tags: sourceSession.tags ? [...sourceSession.tags] : undefined,
      colorLabel: sourceSession.colorLabel,
      contextNotes: sourceSession.contextNotes ? [...sourceSession.contextNotes] : undefined,
      parentSessionId: sessionId,
      forkFromMessageIndex: msgIndex,
    }

    set((state) => ({
      sessions: [newSession, ...state.sessions],
      activeSessionId: newSession.id,
    }))

    return newSession
  },

  reorderSessions: (fromIndex, toIndex) => {
    set((state) => {
      const sessions = [...state.sessions]
      const [moved] = sessions.splice(fromIndex, 1)
      sessions.splice(toIndex, 0, moved)
      return { sessions }
    })
  },

  reorderMessages: (sessionId, fromIndex, toIndex) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s
        const messages = [...s.messages]
        const [moved] = messages.splice(fromIndex, 1)
        messages.splice(toIndex, 0, moved)
        return { ...s, messages }
      }),
    }))
  },

  restoreMessageVersion: (sessionId, messageId, versionIndex) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s
        return {
          ...s,
          messages: s.messages.map((m) => {
            if (m.id !== messageId) return m
            const versions = m.versions || []
            if (versionIndex < 0 || versionIndex >= versions.length) return m
            const targetVersion = versions[versionIndex]
            // 将当前内容存入 versions，然后替换为目标版本
            const newVersions = [...versions, { content: m.content, timestamp: Date.now() }]
            return { ...m, content: targetVersion.content, versions: newVersions }
          }),
        }
      }),
    }))
  },

  setSessionColorLabel: (sessionId, color) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, colorLabel: color ?? undefined }
          : s
      ),
    }))
  },

  addContextNote: (sessionId, note) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s
        const notes = s.contextNotes || []
        return { ...s, contextNotes: [...notes, note] }
      }),
    }))
  },

  removeContextNote: (sessionId, index) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s
        const notes = [...(s.contextNotes || [])]
        notes.splice(index, 1)
        return { ...s, contextNotes: notes.length > 0 ? notes : undefined }
      }),
    }))
  },

  updateContextNote: (sessionId, index, note) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s
        const notes = [...(s.contextNotes || [])]
        if (index >= 0 && index < notes.length) {
          notes[index] = note
        }
        return { ...s, contextNotes: notes }
      }),
    }))
  },

  markSessionRead: (sessionId) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, unreadCount: 0 } : s
      ),
    }))
  },

  incrementUnread: (sessionId) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, unreadCount: (s.unreadCount || 0) + 1 } : s
      ),
    }))
  },

  togglePinMessage: (sessionId, messageId) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s
        const msg = s.messages.find(m => m.id === messageId)
        if (!msg) return s
        // 如果要置顶，检查是否已达上限（5条）
        if (!msg.pinned) {
          const pinnedCount = s.messages.filter(m => m.pinned).length
          if (pinnedCount >= 5) return s // 最多5条置顶
        }
        return {
          ...s,
          messages: s.messages.map(m =>
            m.id === messageId ? { ...m, pinned: !m.pinned } : m
          ),
        }
      }),
    }))
  },

  setProjectFilter: (path) => {
    set({ projectFilter: path })
  },

  setNetworkLatency: (latency) => {
    set({ networkLatency: latency })
  },

  setReconnectCount: (count) => {
    set({ reconnectCount: count })
  },

  setLastDisconnectedAt: (timestamp) => {
    set({ lastDisconnectedAt: timestamp })
  },

  setBackendVersion: (version) => {
    set({ backendVersion: version })
  },

  setInterruptedStreaming: (sessionId, msgId) => {
    set({ interruptedStreamingSessionId: sessionId, interruptedStreamingMsgId: msgId })
  },

  addStreamingSession: (sessionId) => {
    set((state) => {
      const next = new Set(state.streamingSessions)
      next.add(sessionId)
      return { streamingSessions: next }
    })
  },

  removeStreamingSession: (sessionId) => {
    set((state) => {
      const next = new Set(state.streamingSessions)
      next.delete(sessionId)
      return { streamingSessions: next }
    })
  },

  setSessionEffort: (sessionId, effort) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, effort } : s
      ),
    }))
  },

  setSessionMaxBudget: (sessionId, maxBudgetUsd) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, maxBudgetUsd: maxBudgetUsd > 0 ? maxBudgetUsd : undefined }
          : s
      ),
    }))
  },

  setSessionFallbackModel: (sessionId, model) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, fallbackModel: model || undefined }
          : s
      ),
    }))
  },

  setSessionAllowedTools: (sessionId, tools) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, allowedTools: tools.length > 0 ? tools : undefined }
          : s
      ),
    }))
  },

  setSessionDisallowedTools: (sessionId, tools) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, disallowedTools: tools.length > 0 ? tools : undefined }
          : s
      ),
    }))
  },

  setSessionSummary: (sessionId, summary, keyTopics) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, summary: summary || undefined, keyTopics: keyTopics && keyTopics.length > 0 ? keyTopics : s.keyTopics }
          : s
      ),
    }))
  },

  syncToBackend: async () => {
    const { sessions, isSyncing } = get()
    // 避免重复同步
    if (isSyncing) return
    set({ isSyncing: true })
    try {
      await syncSessionsToBackend(sessions)
      set({ lastSyncTime: Date.now(), isSyncing: false })
    } catch (err) {
      console.error('同步到后端失败:', err)
      set({ isSyncing: false })
    }
  },

  loadFromBackend: async () => {
    set({ isSyncing: true })
    try {
      const remoteSessions = await loadSessionsFromBackend()
      if (remoteSessions.length > 0) {
        // 合并策略：以本地数据为基准，仅添加本地不存在的后端会话，不覆盖本地已有会话
        const localSessions = get().sessions
        const merged = [...localSessions]
        for (const remoteSess of remoteSessions) {
          if (!merged.find(s => s.id === remoteSess.id)) {
            merged.push(remoteSess)
          }
        }
        set({ sessions: merged, lastSyncTime: Date.now(), isSyncing: false })
      } else {
        set({ isSyncing: false })
      }
    } catch (err) {
      console.error('从后端加载会话失败:', err)
      set({ isSyncing: false })
    }
  },

  setDraft: (sessionId, content) => {
    const trimmed = content.trim()
    set((state) => {
      const drafts = { ...state.drafts }
      if (trimmed) {
        drafts[sessionId] = content
      } else {
        delete drafts[sessionId]
      }
      return { drafts }
    })
  },

  getDraft: (sessionId) => {
    return get().drafts[sessionId] || ''
  },

  clearDraft: (sessionId) => {
    set((state) => {
      const drafts = { ...state.drafts }
      delete drafts[sessionId]
      return { drafts }
    })
  },
}), {
  name: 'claude-code-chat-sessions',
  partialize: (state) => ({
    sessions: state.sessions,
    activeSessionId: state.activeSessionId,
    selectedModel: state.selectedModel,
    permissionMode: state.permissionMode,
    drafts: state.drafts,
    dismissedHints: state.dismissedHints,
  }),
}))
