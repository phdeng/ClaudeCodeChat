import express from 'express'
import { createServer } from 'http'
import { ClaudeCodeManager, type TokenUsage } from './services/claudeCode.js'
import configRouter from './routes/config.js'
import filesystemRouter from './routes/filesystem.js'
import sessionsRouter from './routes/sessions.js'
import chatSessionsRouter from './routes/chatSessions.js'
import titleGenRouter from './routes/titleGen.js'
import translateRouter from './routes/translate.js'

const app = express()
const server = createServer(app)

// ===== SSE 客户端管理 =====

interface SSEClient {
  res: express.Response
  /** 该客户端订阅的 session 集合 */
  subscribedSessions: Set<string>
  /** 心跳定时器 */
  heartbeatTimer: ReturnType<typeof setInterval>
}

/** SSE 客户端连接池：clientId → SSEClient */
const sseClients = new Map<string, SSEClient>()

/** 向指定 session 的所有订阅客户端广播 SSE 事件 */
function broadcastToSession(sessionId: string, event: string, data: object) {
  for (const [, client] of sseClients) {
    if (client.subscribedSessions.has(sessionId) && !client.res.writableEnded) {
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }
  }
}

// ===== 全局流缓冲：CLI 进程独立于连接生命周期 =====

interface StreamBuffer {
  manager: ClaudeCodeManager
  /** 所有输出 chunk（有序） */
  chunks: string[]
  /** 状态：streaming/done/error */
  status: 'streaming' | 'done' | 'error'
  /** 完成时的 token 用量 */
  usage?: TokenUsage
  /** 错误信息 */
  errorMsg?: string
  /** CLI session ID（用于 init 事件） */
  cliSessionId?: string
  /** 最后活跃时间 */
  lastActivity: number
}

/** 全局缓冲区：sessionId → StreamBuffer */
const streamBuffers = new Map<string, StreamBuffer>()

/** 清理已完成的缓冲区（5 分钟后） */
setInterval(() => {
  const now = Date.now()
  for (const [id, buf] of streamBuffers) {
    if (buf.status !== 'streaming' && now - buf.lastActivity > 5 * 60 * 1000) {
      streamBuffers.delete(id)
    }
  }
}, 60000)

/** 启动 CLI 流式进程并缓冲输出 */
function startStream(sessionId: string, data: any): StreamBuffer {
  // 如果已有活跃流，先停止
  const existing = streamBuffers.get(sessionId)
  if (existing && existing.status === 'streaming') {
    existing.manager.stop()
    existing.manager.removeAllListeners()
  }

  const manager = new ClaudeCodeManager(
    sessionId, data.model, data.permissionMode,
    data.workingDirectory, data.systemPrompt, data.cliSessionId
  )

  const buffer: StreamBuffer = {
    manager,
    chunks: [],
    status: 'streaming',
    lastActivity: Date.now(),
  }

  streamBuffers.set(sessionId, buffer)

  // CLI session ID 事件
  manager.on('init', (cliSessionId: string) => {
    buffer.cliSessionId = cliSessionId
    broadcastToSession(sessionId, 'init', { sessionId, cliSessionId })
  })

  // 流式数据事件 — 缓冲 + 实时推送
  manager.on('data', (content: string) => {
    buffer.chunks.push(content)
    buffer.lastActivity = Date.now()
    broadcastToSession(sessionId, 'stream', { sessionId, content })
  })

  // 完成事件
  manager.on('done', (usage: TokenUsage) => {
    buffer.status = 'done'
    buffer.usage = usage
    buffer.lastActivity = Date.now()
    broadcastToSession(sessionId, 'done', { sessionId, usage })
  })

  // 错误事件
  manager.on('error', (error: string) => {
    buffer.status = 'error'
    buffer.errorMsg = error
    buffer.lastActivity = Date.now()
    broadcastToSession(sessionId, 'error', { sessionId, message: error })
  })

  // 异步发送消息
  manager.send(data.message, data.images).catch((err) => {
    buffer.status = 'error'
    buffer.errorMsg = err.message
    buffer.lastActivity = Date.now()
    broadcastToSession(sessionId, 'error', { sessionId, message: err.message })
  })

  return buffer
}

// ===== Express 路由 =====

app.use(express.json({ limit: '50mb' }))
app.use('/api/config', configRouter)
app.use('/api/filesystem', filesystemRouter)
app.use('/api/sessions', sessionsRouter)
app.use('/api/chat-sessions', chatSessionsRouter)
app.use('/api/title', titleGenRouter)
app.use('/api/translate', translateRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/version', (_req, res) => {
  res.json({ version: '1.3.0' })
})

app.get('/api/claude-code/status', async (_req, res) => {
  const available = await ClaudeCodeManager.isAvailable()
  res.json({ available })
})

// ===== SSE 连接端点 =====

app.get('/api/chat/stream', (req, res) => {
  const clientId = req.query.clientId as string
  if (!clientId) {
    res.status(400).json({ error: 'clientId required' })
    return
  }

  // 设置 SSE 响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',  // Nginx 不缓冲
  })
  res.flushHeaders()

  // 发送初始连接确认
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: Date.now() })}\n\n`)

  // 如果该 clientId 已有旧连接，关闭旧的，保留订阅
  const oldClient = sseClients.get(clientId)
  const preservedSessions = oldClient?.subscribedSessions || new Set<string>()
  if (oldClient) {
    clearInterval(oldClient.heartbeatTimer)
    if (!oldClient.res.writableEnded) {
      oldClient.res.end()
    }
  }

  // 心跳：每 15 秒发送 SSE 注释保持连接活跃
  const heartbeatTimer = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`)
    } else {
      clearInterval(heartbeatTimer)
    }
  }, 15000)

  // 注册新连接
  sseClients.set(clientId, {
    res,
    subscribedSessions: preservedSessions,
    heartbeatTimer,
  })

  // 连接关闭清理
  req.on('close', () => {
    clearInterval(heartbeatTimer)
    const client = sseClients.get(clientId)
    if (client && client.res === res) {
      // 连接关闭，但保留订阅信息便于重连
      // 用 Set 备份订阅信息，延迟 5 分钟清理
      sseClients.delete(clientId)
    }
  })
})

// ===== 发送消息端点 =====

app.post('/api/chat/send', (req, res) => {
  const { clientId, sessionId, message, images, model, workingDirectory, systemPrompt, permissionMode, cliSessionId } = req.body

  if (!sessionId || !message) {
    res.status(400).json({ error: 'sessionId and message required' })
    return
  }

  // 订阅该客户端到 session
  if (clientId) {
    const client = sseClients.get(clientId)
    if (client) {
      client.subscribedSessions.add(sessionId)
    }
  }

  // 启动 CLI 流
  startStream(sessionId, { message, images, model, workingDirectory, systemPrompt, permissionMode, cliSessionId })

  res.json({ ok: true })
})

// ===== 停止流端点 =====

app.post('/api/chat/stop', (req, res) => {
  const { sessionId } = req.body
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId required' })
    return
  }

  const buffer = streamBuffers.get(sessionId)
  if (buffer && buffer.status === 'streaming') {
    buffer.manager.stop()
    buffer.manager.removeAllListeners()
    buffer.status = 'done'
    buffer.lastActivity = Date.now()
    broadcastToSession(sessionId, 'done', { sessionId, usage: buffer.usage })
  }

  res.json({ ok: true })
})

// ===== 恢复流端点（页面刷新/断线重连） =====

app.post('/api/chat/resume', (req, res) => {
  const { clientId, sessionId, offset } = req.body
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId required' })
    return
  }

  // 重新订阅
  if (clientId) {
    const client = sseClients.get(clientId)
    if (client) {
      client.subscribedSessions.add(sessionId)
    }
  }

  const buffer = streamBuffers.get(sessionId)
  if (!buffer) {
    res.json({ status: 'expired' })
    return
  }

  // 返回当前状态 + 缺失的 chunks
  const effectiveOffset = typeof offset === 'number' ? offset : 0
  const missedChunks = buffer.chunks.slice(effectiveOffset)

  res.json({
    status: buffer.status,
    cliSessionId: buffer.cliSessionId,
    chunks: missedChunks,
    totalChunks: buffer.chunks.length,
    usage: buffer.usage,
    errorMsg: buffer.errorMsg,
  })
})

// ===== 延迟测量端点 =====

app.get('/api/chat/ping', (_req, res) => {
  res.json({ timestamp: Date.now() })
})

// ===== 启动服务器 =====

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
