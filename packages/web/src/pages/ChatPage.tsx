import { useEffect, useRef, useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MessageList from '../components/MessageList'
import ChatInput from '../components/ChatInput'
import SmartSuggestions from '../components/SmartSuggestions'
import CodeSnippetsDialog from '../components/CodeSnippetsDialog'
import AgentTeamsPanel from '../components/AgentTeamsPanel'
import TimelineView from '../components/TimelineView'
import MessageSearchBar from '../components/MessageSearchBar'
import SystemPromptDialog from '../components/SystemPromptDialog'
import PromptLibraryDialog from '../components/PromptLibraryDialog'
import BookmarksDialog from '../components/BookmarksDialog'
import ChatExportPreview from '../components/ChatExportPreview'
import ModelComparePanel from '../components/ModelComparePanel'
import DiffView from '../components/DiffView'
import FloatingToolbar from '../components/FloatingToolbar'
import PinnedMessages from '../components/PinnedMessages'
import CategoryManager from '../components/CategoryManager'
import SessionStatsPopover from '../components/SessionStatsPopover'
import SessionTemplateDialog from '../components/SessionTemplateDialog'
import type { SessionTemplate } from '../components/SessionTemplateDialog'
import type { AgentState } from '../components/AgentTeamsPanel'
import CostPanel from '../components/CostPanel'
import WorkflowPanel from '../components/WorkflowPanel'
import WorkflowExecutionBar from '../components/WorkflowExecutionBar'
import { useWorkflowStore, type Workflow } from '../stores/workflowStore'
import { exportChatAsImage } from '../utils/exportImage'
import ProjectDashboard from '../components/ProjectDashboard'
import GitPanel from '../components/GitPanel'
import GlobalSearchPanel from '../components/GlobalSearchPanel'
import { WifiOff, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
// Tooltip imports removed — toolbar consolidated into input area
import { toast } from 'sonner'
import { useSessionStore, type Message } from '../stores/sessionStore'
import { useSessionTabsStore } from '../stores/sessionTabsStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useFileExplorerStore } from '../stores/fileExplorerStore'
import { useTranslation } from '../i18n'
import { playNotificationSound } from '../utils/notificationSound'
import ContextPanel from '../components/ContextPanel'
import FilePreviewDialog from '../components/FilePreviewDialog'
import SensitiveWarningDialog from '../components/SensitiveWarningDialog'
import BudgetAlert from '../components/BudgetAlert'
import { detectSensitive, maskSensitive } from '../utils/sensitiveDetector'
import type { SensitiveMatch } from '../utils/sensitiveDetector'
import { useContextStore } from '../stores/contextStore'

// 异步调用后端 API 生成智能会话标题
const generateTitle = async (sid: string, messages: Message[]) => {
  try {
    const res = await fetch('/api/title/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map(m => ({
          role: m.role,
          content: m.content.slice(0, 200),  // 只发送前 200 字符
        }))
      })
    })
    const data = await res.json()
    if (data.title) {
      useSessionStore.getState().updateSessionTitle(sid, data.title)
    }
  } catch {
    // 标题生成失败不影响使用
  }
}

// FEATURE_CARDS 已移至 MessageList.tsx 的欢迎页中（在可滚动区域内）

export default function ChatPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { sessions, activeSessionId, setActiveSession, createSession, addMessage, updateMessage, setMessageStreaming, updateSessionTitle, connectionStatus, setConnectionStatus, editMessage, deleteMessagesAfter, setSessionSystemPrompt, forkSession, setNetworkLatency, setReconnectCount, setLastDisconnectedAt, setBackendVersion, addStreamingSession, removeStreamingSession, projectFilter, selectedModel, togglePinMessage, markSessionRead, incrementUnread } = useSessionStore()
  // SSE 客户端 ID（持久化到 sessionStorage，页面刷新后保持不变）
  const clientIdRef = useRef<string>(
    sessionStorage.getItem('sse-client-id') || (() => {
      const id = crypto.randomUUID()
      sessionStorage.setItem('sse-client-id', id)
      return id
    })()
  )
  const eventSourceRef = useRef<EventSource | null>(null)
  // 多会话并行：每个 sessionId 对应自己的 streamingMsgId
  const streamingMsgIdsRef = useRef<Map<string, string>>(new Map())
  const currentSessionIdRef = useRef<string | null>(null)
  const reconnectCountRef = useRef(0)
  // 跟踪每个 session 已接收的 chunk 数量（用于断线重连时 resume 回放）
  const chunkOffsetsRef = useRef<Map<string, number>>(new Map())
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [agentsMap, setAgentsMap] = useState<Map<string, AgentState>>(new Map())
  const [showCost, setShowCost] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [showPromptLib, setShowPromptLib] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showExportPreview, setShowExportPreview] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null)
  const [showSnippets, setShowSnippets] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [showWorkflow, setShowWorkflow] = useState(false)
  const [showGitPanel, setShowGitPanel] = useState(false)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  // 引用回复状态
  const [quotedMessage, setQuotedMessage] = useState<{ role: string; content: string } | null>(null)
  // Diff 对比视图状态
  const [diffState, setDiffState] = useState<{ original: string; modified: string } | null>(null)
  // 任务进度指示列表
  const [activeProgress, setActiveProgress] = useState<Array<{ type: string; name: string }>>([])
  // 上下文管理面板
  const [showContext, setShowContext] = useState(false)
  // 文件预览
  const [previewFile, setPreviewFile] = useState<string | null>(null)
  // 敏感信息检测对话框
  const [sensitiveDialog, setSensitiveDialog] = useState<{
    open: boolean
    matches: SensitiveMatch[]
    originalText: string
  } | null>(null)

  // 成本预算设置（从 localStorage 读取）
  const [budgetSettings, setBudgetSettings] = useState<{ budgetTokensK: number; warningThreshold: number }>({ budgetTokensK: 0, warningThreshold: 80 })
  useEffect(() => {
    try {
      const saved = localStorage.getItem('budget-settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        setBudgetSettings({
          budgetTokensK: parsed.budgetTokensK || 0,
          warningThreshold: parsed.warningThreshold || 80,
        })
      }
    } catch { /* 忽略 */ }
    // 监听 storage 变化（设置页修改后同步）
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'budget-settings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          setBudgetSettings({
            budgetTokensK: parsed.budgetTokensK || 0,
            warningThreshold: parsed.warningThreshold || 80,
          })
        } catch { /* 忽略 */ }
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // 用于记录重新生成前的旧 assistant 回复内容
  const regenerateOldContentRef = useRef<string | null>(null)

  const { t } = useTranslation()
  const session = sessions.find((s) => s.id === (sessionId || activeSessionId))

  currentSessionIdRef.current = sessionId || activeSessionId || null

  const { openTab: openSessionTab, setActiveTab, updateTabTitle } = useSessionTabsStore()

  useEffect(() => {
    if (sessionId) {
      setActiveSession(sessionId)
      // 进入会话时，将该会话的未读计数清零
      markSessionRead(sessionId)
      // 同步标签页：打开并激活
      const s = sessions.find((sess) => sess.id === sessionId)
      if (s) {
        openSessionTab(sessionId, s.title)
      }
    }
  }, [sessionId, setActiveSession, markSessionRead, sessions, openSessionTab])

  // 当会话标题变化时，同步更新标签页标题
  useEffect(() => {
    if (session) {
      updateTabTitle(session.id, session.title)
    }
  }, [session?.id, session?.title, updateTabTitle])

  useEffect(() => {
    // 启动时获取后端版本号
    fetch('/api/version')
      .then(res => res.json())
      .then(data => { if (data.version) setBackendVersion(data.version) })
      .catch(() => {})

    // 建立 SSE 连接
    connectSSE()

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
      eventSourceRef.current?.close()
    }
  }, [])

  // URL 哈希锚点处理：页面加载或 hash 变化时，自动滚动到对应消息并高亮
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash
      if (hash.startsWith('#msg-')) {
        const msgId = hash.slice(5) // 去掉 '#msg-'
        if (msgId) {
          setHighlightedMsgId(msgId)
          // 延迟一帧等待 DOM 渲染完成后滚动
          requestAnimationFrame(() => {
            const el = document.getElementById(`msg-${msgId}`)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          })
          // 3 秒后清除高亮
          setTimeout(() => setHighlightedMsgId(null), 3000)
        }
      }
    }

    // 页面加载时处理已有的 hash
    handleHash()

    // 监听 hash 变化
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [session?.messages])

  // Ctrl+F 搜索 / Ctrl+Shift+S 代码片段
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        setShowSnippets(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 网络状态检测：上线自动重连，离线提示
  useEffect(() => {
    const handleOnline = () => {
      toast.success('网络已恢复')
      reconnectCountRef.current = 0
      connectSSE()
    }

    const handleOffline = () => {
      toast.error('网络已断开')
      setConnectionStatus('disconnected')
    }

    // 监听手动重连事件（从 ChatLayout 连接状态按钮触发）
    const handleManualReconnect = () => {
      reconnectCountRef.current = 0
      setReconnectCount(0)
      connectSSE()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('manual-reconnect', handleManualReconnect)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('manual-reconnect', handleManualReconnect)
    }
  }, [])

  // 监听来自 ChatLayout 的快捷键自定义事件
  useEffect(() => {
    const handlers: Record<string, () => void> = {
      'shortcut:export': () => setShowExportPreview(true),
      'shortcut:compare': () => setShowCompare(true),
      'shortcut:bookmarks': () => setShowBookmarks(true),
      'shortcut:timeline': () => setShowTimeline(true),
      'shortcut:categories': () => setShowCategories(true),
      'shortcut:templates': () => setShowTemplates(true),
      'shortcut:workflow': () => setShowWorkflow(true),
    }

    // 功能发现卡片点击事件
    const handleFeatureCard = (e: Event) => {
      const action = (e as CustomEvent).detail?.action
      switch (action) {
        case 'search': setShowSearch(true); break
        case 'pin-hint': toast('在消息上右键点击即可置顶消息'); break
        case 'snippets': setShowSnippets(true); break
        case 'theme': navigate('/settings'); break
        case 'stats': setShowStats(true); break
        case 'exportimage': toast('发送消息后，输入 /exportimage 即可导出长图'); break
      }
    }

    Object.entries(handlers).forEach(([event, handler]) => {
      window.addEventListener(event, handler)
    })
    window.addEventListener('feature-card:action', handleFeatureCard)

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        window.removeEventListener(event, handler)
      })
      window.removeEventListener('feature-card:action', handleFeatureCard)
    }
  }, [])

  /** 恢复所有正在流式传输的会话（SSE 连接建立后调用） */
  async function resumeStreamingSessions() {
    // 检查内存中跟踪的流式会话
    for (const [sid] of streamingMsgIdsRef.current) {
      const offset = chunkOffsetsRef.current.get(sid) || 0
      try {
        const resp = await fetch('/api/chat/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: clientIdRef.current,
            sessionId: sid,
            offset,
          }),
        })
        const result = await resp.json()
        handleResumeResult(sid, result)
      } catch {
        // resume 失败不影响新消息发送
      }
    }

    // 页面刷新后：检查 store 中 isStreaming 但不在 streamingMsgIdsRef 中的消息
    const store = useSessionStore.getState()
    for (const session of store.sessions) {
      const streamingMsg = session.messages.find(m => m.isStreaming)
      if (streamingMsg && !streamingMsgIdsRef.current.has(session.id)) {
        // 页面刷新后发现的残留流式消息
        streamingMsgIdsRef.current.set(session.id, streamingMsg.id)
        store.addStreamingSession(session.id)
        try {
          const resp = await fetch('/api/chat/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: clientIdRef.current,
              sessionId: session.id,
              offset: 0, // 从头回放
            }),
          })
          const result = await resp.json()
          handleResumeResult(session.id, result)
        } catch {
          // 如果恢复失败，标记消息为非流式
          store.setMessageStreaming(session.id, streamingMsg.id, false)
          streamingMsgIdsRef.current.delete(session.id)
          store.removeStreamingSession(session.id)
        }
      }
    }
  }

  /** 处理 resume 响应 */
  function handleResumeResult(sid: string, result: any) {
    const store = useSessionStore.getState()
    const msgId = streamingMsgIdsRef.current.get(sid)
    if (!msgId) return

    if (result.status === 'expired') {
      store.setMessageStreaming(sid, msgId, false)
      streamingMsgIdsRef.current.delete(sid)
      chunkOffsetsRef.current.delete(sid)
      store.removeStreamingSession(sid)
      toast.error('对话已中断，CLI 进程已退出，请重新发送')
      return
    }

    // 存储 CLI session ID
    if (result.cliSessionId) {
      store.setCliSessionId(sid, result.cliSessionId)
    }

    // 合并缺失的 chunks
    if (result.chunks && result.chunks.length > 0) {
      const currentSession = store.sessions.find(s => s.id === sid)
      const currentMsg = currentSession?.messages.find(m => m.id === msgId)
      const existing = currentMsg?.content || ''

      let missedContent = ''
      for (const chunk of result.chunks) {
        const cleaned = chunk.replace(/<progress\s+type="[^"]*"\s+name="[^"]*">[^<]*<\/progress>/g, '')
        missedContent += cleaned
      }

      if (missedContent) {
        const newContent = existing === '' ? missedContent.replace(/^\n+/, '') : existing + missedContent
        store.updateMessage(sid, msgId, newContent)
      }
    }

    // 更新 offset
    if (typeof result.totalChunks === 'number') {
      chunkOffsetsRef.current.set(sid, result.totalChunks)
    }

    // 如果流已完成/错误，立即处理
    if (result.status === 'done') {
      store.setMessageStreaming(sid, msgId, false)
      if (result.usage && (result.usage.inputTokens || result.usage.outputTokens)) {
        store.updateMessageTokenUsage(sid, msgId, {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
        })
      }
      streamingMsgIdsRef.current.delete(sid)
      chunkOffsetsRef.current.delete(sid)
      store.removeStreamingSession(sid)
      toast.success('流式传输已恢复（已完成）')
    } else if (result.status === 'error') {
      const friendlyMsg = result.errorMsg || '未知错误'
      store.updateMessage(sid, msgId, `⚠️ ${friendlyMsg}`)
      store.setMessageStreaming(sid, msgId, false)
      streamingMsgIdsRef.current.delete(sid)
      chunkOffsetsRef.current.delete(sid)
      store.removeStreamingSession(sid)
    } else {
      toast.success('流式传输已恢复')
    }
  }

  /** 处理 SSE 事件（stream/init/done/error 等） */
  function handleSSEEvent(eventType: string, data: any) {
    // 处理 init 消息 — 存储 CLI session ID 以便继续对话
    if (eventType === 'init' && data.cliSessionId && data.sessionId) {
      useSessionStore.getState().setCliSessionId(data.sessionId, data.cliSessionId)
      return
    }

    // Agent events
    if (eventType === 'agent_start') {
      const { agentId, agentType, prompt } = data
      if (agentId) {
        setAgentsMap((prev) => {
          const next = new Map(prev)
          next.set(agentId, {
            agentId,
            agentType: agentType || 'general-purpose',
            prompt: prompt || '',
            content: '',
            status: 'running',
          })
          return next
        })
      }
      return
    }
    if (eventType === 'agent_progress') {
      const { agentId, content } = data
      if (agentId) {
        setAgentsMap((prev) => {
          const next = new Map(prev)
          const existing = next.get(agentId)
          if (existing) {
            next.set(agentId, {
              ...existing,
              content: existing.content + (content || ''),
            })
          }
          return next
        })
      }
      return
    }
    if (eventType === 'agent_done') {
      const { agentId } = data
      if (agentId) {
        setAgentsMap((prev) => {
          const next = new Map(prev)
          const existing = next.get(agentId)
          if (existing) {
            next.set(agentId, { ...existing, status: 'done' })
          }
          return next
        })
      }
      return
    }

    // 多会话并行：从消息中获取 sessionId
    const sid = data.sessionId || currentSessionIdRef.current
    const streamingMsgId = sid ? streamingMsgIdsRef.current.get(sid) : null

    if (!sid || !streamingMsgId) return

    switch (eventType) {
      case 'stream': {
        // 递增 chunk offset（用于断线重连后 resume 回放定位）
        chunkOffsetsRef.current.set(sid, (chunkOffsetsRef.current.get(sid) || 0) + 1)

        const store = useSessionStore.getState()
        const currentSession = store.sessions.find(s => s.id === sid)
        const currentMsg = currentSession?.messages.find(m => m.id === streamingMsgId)
        const existing = currentMsg?.content || ''

        // 仅对当前活跃会话更新进度指示
        if (sid === currentSessionIdRef.current) {
          const progressRegex = /<progress\s+type="([^"]*)"\s+name="([^"]*)">[^<]*<\/progress>/g
          let progressMatch: RegExpExecArray | null
          const newProgressItems: Array<{ type: string; name: string }> = []
          while ((progressMatch = progressRegex.exec(data.content)) !== null) {
            newProgressItems.push({ type: progressMatch[1], name: progressMatch[2] })
          }
          if (newProgressItems.length > 0) {
            setActiveProgress(prev => {
              const merged = [...prev]
              for (const item of newProgressItems) {
                const exists = merged.some(p => p.type === item.type && p.name === item.name)
                if (!exists) {
                  merged.push(item)
                }
              }
              return merged
            })
          }
        }

        const cleanedContent = data.content.replace(/<progress\s+type="[^"]*"\s+name="[^"]*">[^<]*<\/progress>/g, '')
        const chunk = existing === '' ? cleanedContent.replace(/^\n+/, '') : cleanedContent
        if (chunk) {
          store.updateMessage(sid, streamingMsgId, existing + chunk)
        }
        break
      }
      case 'done': {
        const store = useSessionStore.getState()
        const doneSession = store.sessions.find(s => s.id === sid)
        const doneMsg = doneSession?.messages.find(m => m.id === streamingMsgId)
        if (doneMsg && !doneMsg.content.trim()) {
          store.updateMessage(sid, streamingMsgId, '⚠️ 未收到有效回复，请重试')
        }
        store.setMessageStreaming(sid, streamingMsgId, false)
        if (data.usage && (data.usage.inputTokens || data.usage.outputTokens)) {
          store.updateMessageTokenUsage(sid, streamingMsgId, {
            inputTokens: data.usage.inputTokens || 0,
            outputTokens: data.usage.outputTokens || 0,
          })
        }
        const currentSession = store.sessions.find(s => s.id === sid)
        if (currentSession && currentSession.messages.length <= 3) {
          generateTitle(sid, currentSession.messages)
        }
        if (regenerateOldContentRef.current && sid === currentSessionIdRef.current) {
          const newMsg = currentSession?.messages.find(m => m.id === streamingMsgId)
          if (newMsg && newMsg.content.trim()) {
            setDiffState({
              original: regenerateOldContentRef.current,
              modified: newMsg.content,
            })
          }
          regenerateOldContentRef.current = null
        }
        if (sid !== currentSessionIdRef.current) {
          store.incrementUnread(sid)
        }
        if (useSettingsStore.getState().soundEnabled) {
          playNotificationSound()
        }
        if (sid === currentSessionIdRef.current) {
          setActiveProgress([])
        }
        streamingMsgIdsRef.current.delete(sid)
        chunkOffsetsRef.current.delete(sid)
        store.removeStreamingSession(sid)

        // ===== 工作流自动推进 =====
        {
          const wfStore = useWorkflowStore.getState()
          const exec = wfStore.execution
          if (exec && exec.status === 'running' && sid === currentSessionIdRef.current) {
            // 获取刚完成的 AI 回复内容
            const latestSession = store.sessions.find(s => s.id === sid)
            const latestMsg = latestSession?.messages.find(m => m.id === streamingMsgId)
            const aiOutput = latestMsg?.content || ''

            // 尝试推进到下一步
            const nextStep = wfStore.advanceStep(aiOutput)
            if (nextStep) {
              // 延迟 500ms 后自动发送下一步 prompt
              setTimeout(() => {
                handleSend(nextStep.prompt)
              }, 500)
            } else {
              // 所有步骤已完成
              wfStore.completeExecution()
              toast.success(t('workflow.allCompleted'))
            }
          }
        }

        // ===== 自动生成对话摘要（消息数 >= 4 时触发，不阻塞主流程） =====
        {
          const summarySession = useSessionStore.getState().sessions.find(s => s.id === sid)
          if (summarySession && summarySession.messages.length >= 4) {
            // 异步调用，不 await，不阻塞
            fetch('/api/chat/summarize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: summarySession.messages.slice(-10).map(m => ({
                  role: m.role,
                  content: m.content.slice(0, 300),  // 截断内容节省 token
                })),
                workingDirectory: summarySession.workingDirectory,
              }),
            })
              .then(r => r.json())
              .then(data => {
                if (data.summary) {
                  useSessionStore.getState().setSessionSummary(sid, data.summary, data.keyTopics)
                }
              })
              .catch(() => {}) // 静默失败
          }
        }

        break
      }
      case 'error': {
        const store = useSessionStore.getState()
        let friendlyMessage = data.message || '未知错误'

        if (friendlyMessage.includes('ENOENT') || friendlyMessage.includes('not found')) {
          friendlyMessage = '找不到 Claude CLI，请确保已安装并在 PATH 中'
        } else if (friendlyMessage.includes('timeout')) {
          friendlyMessage = '请求超时，请稍后重试'
        } else if (friendlyMessage.includes('rate limit') || friendlyMessage.includes('429')) {
          friendlyMessage = 'API 请求频率限制，请稍后重试'
        } else if (friendlyMessage.includes('ECONNREFUSED')) {
          friendlyMessage = '无法连接到后端服务，请检查服务是否运行'
        }

        store.updateMessage(sid, streamingMsgId, `⚠️ ${friendlyMessage}`)
        store.setMessageStreaming(sid, streamingMsgId, false)
        if (sid === currentSessionIdRef.current) {
          setActiveProgress([])
        }
        streamingMsgIdsRef.current.delete(sid)
        chunkOffsetsRef.current.delete(sid)
        store.removeStreamingSession(sid)

        // 工作流执行中遇到错误，标记错误并停止
        {
          const wfStore = useWorkflowStore.getState()
          if (wfStore.execution && wfStore.execution.status === 'running') {
            wfStore.setExecutionError()
          }
        }

        break
      }
    }
  }

  /** 建立 SSE 连接（HTTP/2 原生支持，自动重连） */
  function connectSSE() {
    // 关闭旧连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setConnectionStatus('connecting')

    const es = new EventSource(`/api/chat/stream?clientId=${clientIdRef.current}`)
    eventSourceRef.current = es

    // 连接建立事件（包括自动重连后的重新建立）
    es.addEventListener('connected', () => {
      setConnectionStatus('connected')
      reconnectCountRef.current = 0
      setReconnectCount(0)

      // 启动延迟测量定时器（每 30 秒 HTTP ping）
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
      // 立刻测量一次延迟
      const measureLatency = async () => {
        try {
          const start = Date.now()
          await fetch('/api/chat/ping')
          setNetworkLatency(Date.now() - start)
        } catch { /* ignore */ }
      }
      measureLatency()
      pingIntervalRef.current = setInterval(measureLatency, 30000)

      // 恢复所有正在流式传输的会话
      resumeStreamingSessions()
    })

    // 心跳事件（服务端每 15 秒发送，保持连接活跃）
    es.addEventListener('heartbeat', () => {
      // 收到心跳说明连接正常，无需额外处理
    })

    // 注册 SSE 事件处理器
    const eventTypes = ['init', 'stream', 'done', 'error', 'agent_start', 'agent_progress', 'agent_done']
    for (const eventType of eventTypes) {
      es.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          handleSSEEvent(eventType, data)
        } catch (err) {
          console.warn(`[SSE] 解析 ${eventType} 事件失败:`, err)
        }
      })
    }

    // 错误处理
    es.onerror = () => {
      if (es.readyState === EventSource.CONNECTING) {
        // EventSource 正在自动重连
        setConnectionStatus('connecting')
        reconnectCountRef.current += 1
        setReconnectCount(reconnectCountRef.current)

        // 超过 15 次重连失败，主动关闭
        if (reconnectCountRef.current >= 15) {
          es.close()
          setConnectionStatus('disconnected')
          setLastDisconnectedAt(Date.now())
          setNetworkLatency(null)
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current)
            pingIntervalRef.current = null
          }
        }
      } else if (es.readyState === EventSource.CLOSED) {
        // 连接已永久关闭
        setConnectionStatus('disconnected')
        setLastDisconnectedAt(Date.now())
        setNetworkLatency(null)
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }
      }
    }
  }

  /** 通过 HTTP POST 发送聊天消息到后端 */
  async function sendChatMessage(sid: string, content: string, images?: Array<{ base64: string; name: string }>) {
    const store = useSessionStore.getState()
    const currentSessionData = store.sessions.find(s => s.id === sid)
    try {
      await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientIdRef.current,
          sessionId: sid,
          message: content,
          images: images || [],
          model: store.selectedModel || undefined,
          workingDirectory: currentSessionData?.workingDirectory || undefined,
          systemPrompt: currentSessionData?.systemPrompt || undefined,
          permissionMode: store.permissionMode !== 'default' ? store.permissionMode : undefined,
          cliSessionId: currentSessionData?.cliSessionId || undefined,
          effort: currentSessionData?.effort,
          maxBudgetUsd: currentSessionData?.maxBudgetUsd,
          fallbackModel: currentSessionData?.fallbackModel,
          allowedTools: currentSessionData?.allowedTools,
          disallowedTools: currentSessionData?.disallowedTools,
        }),
      })
    } catch (err) {
      // 发送失败时通知用户
      const msgId = streamingMsgIdsRef.current.get(sid)
      if (msgId) {
        store.updateMessage(sid, msgId, '⚠️ 发送失败，请检查网络连接后重试')
        store.setMessageStreaming(sid, msgId, false)
        streamingMsgIdsRef.current.delete(sid)
        store.removeStreamingSession(sid)
      }
    }
  }

  /** 实际执行发送逻辑（敏感信息检测通过后调用） */
  const doSend = (content: string, images?: Array<{ base64: string; name: string }>) => {
    let sid = sessionId || activeSessionId

    if (!sid) {
      const newSession = createSession()
      sid = newSession.id
      navigate(`/chat/${newSession.id}`)
    }

    currentSessionIdRef.current = sid

    // 附加上下文项（@路径格式）
    let finalMessage = content
    const contextItems = useContextStore.getState().getItems(sid || '')
    if (contextItems.length > 0) {
      const contextPrefix = contextItems
        .filter(item => item.type === 'file')
        .map(item => `@${item.path}`)
        .join(' ')
      if (contextPrefix) {
        finalMessage = `${contextPrefix} ${finalMessage}`
      }
    }

    addMessage(sid, { role: 'user', content, images: images && images.length > 0 ? images : undefined })

    const currentSession = useSessionStore.getState().sessions.find(s => s.id === sid)
    if (currentSession && currentSession.messages.length <= 1) {
      updateSessionTitle(sid, content.slice(0, 30) + (content.length > 30 ? '...' : ''))
    }

    const msgId = addMessage(sid, { role: 'assistant', content: '', isStreaming: true })
    streamingMsgIdsRef.current.set(sid, msgId)
    useSessionStore.getState().addStreamingSession(sid)

    // 确保 SSE 连接存在
    if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
      connectSSE()
    }

    sendChatMessage(sid, finalMessage, images)
  }

  const handleSend = (content: string, images?: Array<{ base64: string; name: string }>) => {
    // 敏感信息检测
    const detection = detectSensitive(content)
    if (detection.detected) {
      setSensitiveDialog({
        open: true,
        matches: detection.matches,
        originalText: content,
      })
      return  // 暂停发送，等待用户决策
    }

    doSend(content, images)
  }

  const handleStop = () => {
    const sid = sessionId || activeSessionId
    if (sid) {
      fetch('/api/chat/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      }).catch(() => {})
    }
    // 如果有工作流正在执行，同时停止
    const wfExec = useWorkflowStore.getState().execution
    if (wfExec && wfExec.status === 'running') {
      useWorkflowStore.getState().stopExecution()
      toast(t('workflow.stopConfirm'))
    }
  }

  const handleSuggestionClick = (text: string) => {
    handleSend(text)
  }

  const handleEditMessage = (messageId: string, newContent: string) => {
    const sid = sessionId || activeSessionId
    if (!sid) return
    // 记录编辑前的内容用于 diff 对比
    const currentSession = useSessionStore.getState().sessions.find(s => s.id === sid)
    const originalMsg = currentSession?.messages.find(m => m.id === messageId)
    if (originalMsg && originalMsg.content !== newContent) {
      setDiffState({ original: originalMsg.content, modified: newContent })
    }
    // 编辑消息并删除之后的所有消息
    editMessage(sid, messageId, newContent)
    toast('消息已编辑，正在重新生成...')
    // 创建 assistant 消息并通过 HTTP 发送
    const msgId = addMessage(sid, { role: 'assistant', content: '', isStreaming: true })
    streamingMsgIdsRef.current.set(sid, msgId)
    useSessionStore.getState().addStreamingSession(sid)
    currentSessionIdRef.current = sid

    sendChatMessage(sid, newContent)
  }

  const handleRegenerateMessage = (assistantMessageId: string) => {
    const sid = sessionId || activeSessionId
    if (!sid) return
    const currentSession = useSessionStore.getState().sessions.find(s => s.id === sid)
    if (!currentSession) return

    // 找到该 assistant 消息的索引
    const msgIndex = currentSession.messages.findIndex(m => m.id === assistantMessageId)
    if (msgIndex === -1) return

    // 保存旧的 assistant 回复内容用于 diff 对比
    const oldAssistantMsg = currentSession.messages[msgIndex]
    const oldAssistantContent = oldAssistantMsg.content
    if (oldAssistantContent.trim()) {
      regenerateOldContentRef.current = oldAssistantContent
    }

    // 保留旧消息的版本历史，并将旧内容加入版本
    const oldVersions = oldAssistantMsg.versions || []
    const versionsForNewMsg = oldAssistantContent.trim()
      ? [...oldVersions, { content: oldAssistantContent, timestamp: Date.now() }]
      : oldVersions.length > 0 ? [...oldVersions] : undefined

    // 找到上一条用户消息
    let userMessage: typeof currentSession.messages[0] | null = null
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (currentSession.messages[i].role === 'user') {
        userMessage = currentSession.messages[i]
        break
      }
    }
    if (!userMessage) return

    const userContent = userMessage.content

    // 删除 assistant 消息及之后的所有消息
    deleteMessagesAfter(sid, assistantMessageId)
    toast('正在重新生成回复...')

    // 重新发送用户消息，携带旧版本历史
    const msgId = addMessage(sid, { role: 'assistant', content: '', isStreaming: true, versions: versionsForNewMsg })
    streamingMsgIdsRef.current.set(sid, msgId)
    useSessionStore.getState().addStreamingSession(sid)
    currentSessionIdRef.current = sid

    sendChatMessage(sid, userContent)
  }

  // 处理引用回复：设置引用消息并聚焦输入框
  const handleQuoteMessage = useCallback((message: Message) => {
    setQuotedMessage({ role: message.role, content: message.content })
    setTimeout(() => document.querySelector('textarea')?.focus(), 100)
  }, [])

  // 处理从消息处分叉对话
  const handleForkFromMessage = useCallback((messageId: string) => {
    const sid = sessionId || activeSessionId
    if (!sid) return
    const newSession = forkSession(sid, messageId)
    if (newSession) {
      navigate(`/chat/${newSession.id}`)
      toast.success('对话已分叉')
    }
  }, [sessionId, activeSessionId, forkSession, navigate])

  // 处理会话模板选择：创建新会话并设置系统提示词 + 可选初始消息
  const handleTemplateSelect = useCallback((template: SessionTemplate) => {
    setShowTemplates(false)
    const newSession = createSession()
    // 设置模板的系统提示词
    setSessionSystemPrompt(newSession.id, template.systemPrompt)
    // 设置模板标签
    if (template.tags) {
      const store = useSessionStore.getState()
      template.tags.forEach((tag) => store.addSessionTag(newSession.id, tag))
    }
    // 用模板名称作为会话标题
    updateSessionTitle(newSession.id, template.name)
    navigate(`/chat/${newSession.id}`)
    // 如果模板有初始消息，自动发送
    if (template.initialMessage) {
      // 延迟一小段时间确保导航完成后再添加助手的初始消息
      setTimeout(() => {
        addMessage(newSession.id, {
          role: 'assistant',
          content: template.initialMessage!,
        })
      }, 100)
    }
    toast.success(`已从模板「${template.name}」创建新会话`)
  }, [createSession, setSessionSystemPrompt, updateSessionTitle, addMessage, navigate])

  /** 执行工作流：启动执行状态并发送第 1 步 prompt */
  const handleWorkflowExecute = useCallback((workflow: Workflow) => {
    const wfStore = useWorkflowStore.getState()
    wfStore.startExecution(workflow)

    // 发送第 1 步的 prompt（第 1 步不替换 {{prev}}，直接发送原文）
    const firstStep = workflow.steps[0]
    if (firstStep) {
      handleSend(firstStep.prompt)
    }
  }, [handleSend])

  // 处理斜杠命令
  const handleCommand = useCallback((command: string) => {
    switch (command) {
      case '/clear': {
        // 清空当前会话消息
        const sid = sessionId || activeSessionId
        if (sid) {
          const store = useSessionStore.getState()
          store.deleteSession(sid)
          const newSession = createSession()
          navigate(`/chat/${newSession.id}`)
          toast('对话已清空')
        }
        break
      }
      case '/new': {
        const newSession = createSession()
        navigate(`/chat/${newSession.id}`)
        toast('新对话已创建')
        break
      }
      case '/settings': {
        navigate('/settings')
        break
      }
      case '/sessions': {
        navigate('/sessions')
        break
      }
      case '/cost': {
        setShowCost(true)
        break
      }
      case '/system': {
        setShowSystemPrompt(true)
        break
      }
      case '/prompts': {
        setShowPromptLib(true)
        break
      }
      case '/bookmarks': {
        setShowBookmarks(true)
        break
      }
      case '/export': {
        const sid = sessionId || activeSessionId
        if (sid) {
          setShowExportPreview(true)
        } else {
          toast('没有可导出的对话')
        }
        break
      }
      case '/exportimage': {
        if (session && session.messages.length > 0) {
          exportChatAsImage(session.title, session.messages)
          toast.success('正在生成图片...')
        } else {
          toast('没有可导出的消息')
        }
        break
      }
      case '/snippets': {
        setShowSnippets(true)
        break
      }
      case '/compare': {
        setShowCompare(true)
        break
      }
      case '/timeline': {
        setShowTimeline(true)
        break
      }
      case '/categories': {
        setShowCategories(true)
        break
      }
      case '/stats': {
        setShowStats(true)
        break
      }
      case '/templates': {
        setShowTemplates(true)
        break
      }
      case '/workflow': {
        setShowWorkflow(true)
        break
      }
      case '/search': {
        setShowGlobalSearch(true)
        break
      }
      case '/context': {
        setShowContext(true)
        break
      }
      case '/clear-context': {
        // 清除当前会话所有消息（保留会话本身）
        const sid = sessionId || activeSessionId
        if (sid) {
          const store = useSessionStore.getState()
          const currentSession = store.sessions.find(s => s.id === sid)
          if (currentSession && currentSession.messages.length > 0) {
            // 删除所有消息：通过找到第一条消息并删除它之后的所有内容（包含自己）
            store.deleteMessagesAfter(sid, '__force_clear_all__')
            // deleteMessagesAfter 找不到消息时不会操作，所以用另一种方式：
            // 直接创建新会话替代
            store.deleteSession(sid)
            const newSession = createSession()
            navigate(`/chat/${newSession.id}`)
            toast('上下文已清除，新对话已创建')
          } else {
            toast('当前会话没有消息')
          }
        }
        break
      }
      case '/git': {
        setShowGitPanel(true)
        break
      }
      case '/files': {
        // 进入聚焦模式 + 打开文件浏览器
        const filesWorkDir = session?.workingDirectory
        if (!filesWorkDir) {
          toast.error('请先选择项目文件夹')
          break
        }
        // 设置文件浏览器路径为当前项目目录
        useFileExplorerStore.getState().setCurrentPath(filesWorkDir)
        useFileExplorerStore.getState().setShowFileExplorer(true)
        // 进入聚焦模式
        useSettingsStore.getState().setZenMode(true)
        break
      }
    }
  }, [sessionId, activeSessionId, createSession, navigate, session, addMessage, updateMessage])

  const isStreaming = session?.messages.some((m) => m.isStreaming) || false
  // 项目仪表盘模式：无活跃会话 + 有项目筛选时，显示项目概览而非聊天界面
  const showProjectDashboard = !sessionId && !activeSessionId && !!projectFilter

  return (
    <div className="flex flex-col h-full relative">
      {/* 消息搜索栏 */}
      {showSearch && (
        <MessageSearchBar
          messages={session?.messages || []}
          open={showSearch}
          onClose={() => { setShowSearch(false); setHighlightedMsgId(null); setSearchQuery('') }}
          onHighlight={setHighlightedMsgId}
          onSearchQueryChange={setSearchQuery}
        />
      )}

      {/* 连接状态提示 */}
      {connectionStatus === 'disconnected' && (
        <div className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20">
          <WifiOff size={14} className="text-destructive" />
          <span className="text-[12px] text-destructive">连接已断开</span>
          {useSessionStore.getState().lastDisconnectedAt && (
            <span className="text-[11px] text-destructive/70">
              ({new Date(useSessionStore.getState().lastDisconnectedAt!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
            </span>
          )}
          <Button variant="ghost" size="xs" onClick={() => {
            reconnectCountRef.current = 0
            setReconnectCount(0)
            connectSSE()
          }} className="text-[11px] text-destructive hover:text-destructive">
            重新连接
          </Button>
        </div>
      )}
      {connectionStatus === 'connecting' && (
        <div className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/20">
          <Loader2 size={14} className="text-warning animate-spin" />
          <span className="text-[12px] text-warning">正在重新连接...{useSessionStore.getState().reconnectCount > 0 && ` (${useSessionStore.getState().reconnectCount}/15)`}</span>
        </div>
      )}

      {/* 右侧悬浮工具栏（上下文摘要 + 快捷键速查） */}
      <FloatingToolbar session={session ?? null} selectMode={selectMode} onSelectModeChange={setSelectMode} />

      {/* 置顶消息区域 */}
      {session && session.messages.some(m => m.pinned) && (
        <PinnedMessages
          messages={session.messages}
          onUnpin={(msgId) => togglePinMessage(session.id, msgId)}
          onJumpToMessage={(msgId) => {
            setHighlightedMsgId(msgId)
            const el = document.getElementById(`msg-${msgId}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            setTimeout(() => setHighlightedMsgId(null), 2000)
          }}
        />
      )}

      {/* 工作流执行进度条 */}
      <WorkflowExecutionBar />

      {/* 项目仪表盘：当没有选中具体会话但有项目筛选路径时显示 */}
      {showProjectDashboard ? (
        <ProjectDashboard workingDirectory={projectFilter!} />
      ) : (
        <MessageList
          messages={session?.messages || []}
          highlightedMessageId={highlightedMsgId}
          searchQuery={showSearch ? searchQuery : undefined}
          activeProgress={activeProgress}
          selectMode={selectMode}
          onSelectModeChange={setSelectMode}
          onSuggestionClick={handleSuggestionClick}
          onEditMessage={handleEditMessage}
          onRegenerateMessage={handleRegenerateMessage}
          onForkFromMessage={handleForkFromMessage}
          onQuoteMessage={handleQuoteMessage}
        />
      )}

      {/* 打字指示器 */}
      {isStreaming && (
        <div className="flex-shrink-0 flex items-center px-4 py-2 max-w-[960px] mx-auto w-full">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border">
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-[11px] text-muted-foreground">Claude 正在输出...</span>
          </div>
        </div>
      )}

      <AgentTeamsPanel agents={agentsMap} />

      {/* 智能输入建议（项目仪表盘模式下隐藏） */}
      {!showProjectDashboard && <SmartSuggestions
        messages={session?.messages || []}
        isStreaming={isStreaming}
        onSuggestionClick={(text) => handleSend(text)}
      />}

      {/* 预算预警条 */}
      {budgetSettings.budgetTokensK > 0 && session && (() => {
        const sessionTokens = session.messages.reduce((sum, m) => {
          if (m.tokenUsage) {
            return sum + (m.tokenUsage.inputTokens || 0) + (m.tokenUsage.outputTokens || 0)
          }
          return sum
        }, 0)
        return (
          <BudgetAlert
            currentTokens={sessionTokens}
            budgetTokens={budgetSettings.budgetTokensK * 1000}
            warningThreshold={budgetSettings.warningThreshold / 100}
          />
        )
      })()}

      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={isStreaming}
        workingDirectory={session?.workingDirectory}
        onCommand={handleCommand}
        quotedMessage={quotedMessage}
        onClearQuote={() => setQuotedMessage(null)}
      />

      <CostPanel
        open={showCost}
        onClose={() => setShowCost(false)}
        session={session}
      />

      <SessionStatsPopover
        messages={session?.messages || []}
        open={showStats}
        onClose={() => setShowStats(false)}
        modelName={selectedModel}
      />

      <SystemPromptDialog
        open={showSystemPrompt}
        onClose={() => setShowSystemPrompt(false)}
        sessionId={session?.id || ''}
        currentPrompt={session?.systemPrompt || ''}
        onSave={(prompt) => {
          const sid = session?.id || sessionId || activeSessionId
          if (sid) {
            setSessionSystemPrompt(sid, prompt)
            toast(prompt ? '系统提示词已保存' : '系统提示词已清空')
          }
        }}
      />

      <PromptLibraryDialog
        open={showPromptLib}
        onClose={() => setShowPromptLib(false)}
        onUse={(content) => handleSend(content)}
      />

      <BookmarksDialog
        open={showBookmarks}
        onClose={() => setShowBookmarks(false)}
      />

      <CodeSnippetsDialog
        open={showSnippets}
        onClose={() => setShowSnippets(false)}
      />

      {/* 对话预览导出 */}
      {showExportPreview && session && (
        <ChatExportPreview
          open={showExportPreview}
          onClose={() => setShowExportPreview(false)}
          sessionId={session.id}
        />
      )}

      {/* 多模型对比面板 */}
      <ModelComparePanel
        open={showCompare}
        onClose={() => setShowCompare(false)}
        workingDirectory={session?.workingDirectory}
        systemPrompt={session?.systemPrompt}
      />

      {/* 时间线视图 */}
      {showTimeline && (
        <TimelineView
          messages={session?.messages || []}
          onClose={() => setShowTimeline(false)}
        />
      )}

      {/* 分类管理器 */}
      <CategoryManager
        open={showCategories}
        onClose={() => setShowCategories(false)}
      />

      {/* 会话模板选择 */}
      <SessionTemplateDialog
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={handleTemplateSelect}
      />

      {/* 工作流管理面板 */}
      <WorkflowPanel
        open={showWorkflow}
        onClose={() => setShowWorkflow(false)}
        onExecute={handleWorkflowExecute}
      />

      {/* Git 操作面板 */}
      <GitPanel
        workingDirectory={session?.workingDirectory}
        open={showGitPanel}
        onClose={() => setShowGitPanel(false)}
        onSendMessage={(msg) => {
          setShowGitPanel(false)
          // 延迟一下再发送，让面板关闭动画完成
          setTimeout(() => handleSend(msg), 300)
        }}
      />

      {/* Diff 对比视图 */}
      {diffState && (
        <DiffView
          originalText={diffState.original}
          modifiedText={diffState.modified}
          onClose={() => setDiffState(null)}
        />
      )}

      {/* 上下文管理面板 */}
      <ContextPanel
        sessionId={sessionId || activeSessionId || ''}
        workingDirectory={session?.workingDirectory}
        open={showContext}
        onClose={() => setShowContext(false)}
        onSendContext={() => {
          setShowContext(false)
          handleSend('/context')
        }}
      />

      {/* 全局搜索面板 */}
      <GlobalSearchPanel
        open={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        onNavigate={(targetSessionId, messageIndex) => {
          setShowGlobalSearch(false)
          // 切换到目标会话
          if (targetSessionId !== sessionId) {
            setActiveSession(targetSessionId)
            navigate(`/chat/${targetSessionId}`)
          }
          // 通过 highlightedMsgId 高亮目标消息
          if (messageIndex !== undefined) {
            const targetSession = sessions.find(s => s.id === targetSessionId)
            if (targetSession && targetSession.messages[messageIndex]) {
              setHighlightedMsgId(targetSession.messages[messageIndex].id)
            }
          }
        }}
      />

      {/* 文件预览 */}
      {previewFile && (
        <FilePreviewDialog
          open={!!previewFile}
          onClose={() => setPreviewFile(null)}
          filePath={previewFile}
          workingDirectory={session?.workingDirectory}
          onAddToContext={(item) => {
            useContextStore.getState().addItem(sessionId || activeSessionId || '', item)
          }}
        />
      )}

      {/* 敏感信息警告 */}
      {sensitiveDialog && (
        <SensitiveWarningDialog
          open={sensitiveDialog.open}
          matches={sensitiveDialog.matches}
          originalText={sensitiveDialog.originalText}
          onClose={() => setSensitiveDialog(null)}
          onSendOriginal={() => {
            const text = sensitiveDialog.originalText
            setSensitiveDialog(null)
            doSend(text)
          }}
          onSendMasked={(maskedText) => {
            setSensitiveDialog(null)
            doSend(maskedText)
          }}
        />
      )}
    </div>
  )
}
