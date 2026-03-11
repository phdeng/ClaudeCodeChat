import { Router, type Router as RouterType } from 'express'
import * as fs from 'fs/promises'
import { createReadStream } from 'fs'
import * as path from 'path'
import { homedir } from 'os'
import { createInterface } from 'readline'

const router: RouterType = Router()

// ~/.claude/projects 基础路径
const PROJECTS_BASE = path.join(homedir(), '.claude', 'projects')

// ============ 类型定义 ============

/** 解析后的会话事件 */
export interface SessionEvent {
  uuid: string
  type: string // user, assistant, tool_use, tool_result, system, progress, thinking
  timestamp: string
  content: string // 提取的文本内容
  role?: string // user 或 assistant
  model?: string // assistant 消息的模型
  toolName?: string // tool_use 事件的工具名
  toolInput?: any // tool_use 事件的输入（简化后）
  agentId?: string // agent_progress 事件的代理 ID
  agentType?: string // agent_progress 事件的代理类型
  usage?: { input_tokens: number; output_tokens: number }
  isSidechain?: boolean
}

/** sessions-index.json 中的条目 */
interface SessionIndexEntry {
  sessionId: string
  fullPath?: string
  fileMtime?: number
  firstPrompt?: string
  summary?: string
  messageCount?: number
  created?: string
  modified?: string
  gitBranch?: string
  projectPath?: string
  isSidechain?: boolean
}

/** sessions-index.json 文件结构 */
interface SessionsIndex {
  version?: number
  entries?: SessionIndexEntry[]
  originalPath?: string
}

// ============ 工具函数 ============

/**
 * 安全读取 JSON 文件，文件不存在时返回 null
 */
async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

/**
 * 检查文件或目录是否存在
 */
async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/**
 * 逐行读取 JSONL 文件并解析事件，支持分页和类型过滤
 */
async function parseJsonlEvents(
  filePath: string,
  options: { limit: number; offset: number; types?: string[] }
): Promise<{ totalEvents: number; events: SessionEvent[] }> {
  const fileExists = await exists(filePath)
  if (!fileExists) {
    return { totalEvents: 0, events: [] }
  }

  // 需要跳过的事件类型
  const SKIP_TYPES = new Set([
    'file-history-snapshot',
    'direct',
    'create',
    'queue-operation',
  ])

  const events: SessionEvent[] = []
  let totalEvents = 0
  let collected = 0

  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: createReadStream(filePath, 'utf-8'),
      crlfDelay: Infinity,
    })

    rl.on('line', (line: string) => {
      if (line.trim() === '') return

      let obj: any
      try {
        obj = JSON.parse(line)
      } catch {
        return
      }

      const eventType = obj.type as string
      if (!eventType || SKIP_TYPES.has(eventType)) return

      // 解析事件
      const parsed = extractEvent(obj)
      if (!parsed) return

      // 类型过滤
      if (options.types && options.types.length > 0) {
        if (!options.types.includes(parsed.type)) return
      }

      totalEvents++

      // 分页：跳过 offset 之前的事件
      if (totalEvents <= options.offset) return

      // 收集到 limit 为止
      if (collected < options.limit) {
        events.push(parsed)
        collected++
      }
    })

    rl.on('close', () => {
      resolve({ totalEvents, events })
    })

    rl.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * 从原始 JSONL 对象中提取 SessionEvent
 * 一个 assistant 消息可能包含多个内容块（text + tool_use），会拆成多个事件
 * 但为简化，我们将 assistant 消息合并为一个事件，tool_use 嵌入在 content 中
 */
function extractEvent(obj: any): SessionEvent | null {
  const type = obj.type as string
  const uuid = obj.uuid || ''
  const timestamp = obj.timestamp || ''
  const isSidechain = obj.isSidechain || false

  switch (type) {
    case 'user': {
      const msg = obj.message || {}
      // 跳过 isMeta 标记的元数据消息
      if (obj.isMeta) return null

      let content = ''
      if (typeof msg.content === 'string') {
        content = msg.content
      } else if (Array.isArray(msg.content)) {
        // 可能包含 text 块或 tool_result 块
        const textBlocks = msg.content.filter((c: any) => c.type === 'text')
        const toolResultBlocks = msg.content.filter((c: any) => c.type === 'tool_result')

        if (textBlocks.length > 0) {
          content = textBlocks.map((c: any) => c.text || '').join('\n')
        }

        // 如果用户消息只包含 tool_result，将其作为 tool_result 类型返回
        if (!content && toolResultBlocks.length > 0) {
          const result = toolResultBlocks[0]
          let resultContent = ''
          if (typeof result.content === 'string') {
            resultContent = result.content
          } else if (Array.isArray(result.content)) {
            // 提取 text 块内容
            resultContent = result.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text || '')
              .join('\n')
            if (!resultContent) {
              resultContent = JSON.stringify(result.content)
            }
          } else {
            resultContent = JSON.stringify(result.content || '')
          }
          return {
            uuid,
            type: 'tool_result',
            timestamp,
            content: truncate(resultContent, 500),
            isSidechain,
          }
        }
      }

      // 跳过空内容（如本地命令产生的消息）
      if (!content.trim()) return null

      // 跳过包含 local-command 或 command-message 标签的消息
      if (
        content.includes('<local-command-caveat>') ||
        content.includes('<local-command-stdout>') ||
        content.includes('<command-message>') ||
        content.includes('<command-name>')
      ) {
        return null
      }

      return {
        uuid,
        type: 'user',
        timestamp,
        content,
        role: 'user',
        isSidechain,
      }
    }

    case 'assistant': {
      const msg = obj.message || {}
      const content = msg.content || []
      const model = msg.model || undefined
      const usage = msg.usage
        ? {
            input_tokens: (msg.usage.input_tokens || 0) + (msg.usage.cache_read_input_tokens || 0) + (msg.usage.cache_creation_input_tokens || 0),
            output_tokens: msg.usage.output_tokens || 0,
          }
        : undefined

      if (!Array.isArray(content)) return null

      // 提取文本内容
      const textParts: string[] = []
      const toolUses: { name: string; input: any }[] = []

      for (const block of content) {
        if (block.type === 'text' && block.text) {
          textParts.push(block.text)
        } else if (block.type === 'tool_use') {
          toolUses.push({
            name: block.name || '',
            input: abbreviateInput(block.input),
          })
        }
      }

      // 如果只有 tool_use 没有 text，生成 tool_use 描述作为内容
      let textContent = textParts.join('\n')
      let toolName: string | undefined
      let toolInput: any | undefined

      if (toolUses.length > 0) {
        toolName = toolUses[0].name
        toolInput = toolUses[0].input
        if (!textContent) {
          // 没有文本内容时，用工具调用信息作为事件
          return {
            uuid,
            type: 'tool_use',
            timestamp,
            content: `${toolName}`,
            role: 'assistant',
            model,
            toolName,
            toolInput,
            usage,
            isSidechain,
          }
        }
      }

      if (!textContent.trim() && toolUses.length === 0) return null

      return {
        uuid,
        type: 'assistant',
        timestamp,
        content: textContent,
        role: 'assistant',
        model,
        toolName,
        toolInput,
        usage,
        isSidechain,
      }
    }

    case 'tool_use': {
      // 顶级 tool_use 事件（较少见）
      return {
        uuid,
        type: 'tool_use',
        timestamp,
        content: `${obj.name || 'unknown'}`,
        toolName: obj.name,
        toolInput: abbreviateInput(obj.input),
        isSidechain,
      }
    }

    case 'tool_result': {
      // 顶级 tool_result 事件（较少见）
      const resultContent = typeof obj.content === 'string'
        ? obj.content
        : JSON.stringify(obj.content || '')
      return {
        uuid,
        type: 'tool_result',
        timestamp,
        content: truncate(resultContent, 500),
        isSidechain,
      }
    }

    case 'progress': {
      const data = obj.data || {}
      const dataType = data.type || ''

      if (dataType === 'agent_progress') {
        // 子代理进度事件 — 跳过无实质内容的心跳进度
        const agentMsg = data.message || {}
        const agentContent = typeof agentMsg.message?.content === 'string'
          ? agentMsg.message.content
          : ''
        // 跳过空内容（只是心跳/进度指示器）
        if (!agentContent.trim()) return null
        return {
          uuid,
          type: 'progress',
          timestamp,
          content: agentContent,
          agentId: obj.agentId || data.agentId,
          agentType: data.agentType,
          isSidechain,
        }
      }

      if (dataType === 'hook_progress') {
        return {
          uuid,
          type: 'progress',
          timestamp,
          content: `Hook: ${data.hookName || data.hookEvent || ''}`,
          isSidechain,
        }
      }

      if (dataType === 'mcp_progress') {
        return {
          uuid,
          type: 'progress',
          timestamp,
          content: `MCP: ${data.serverName || ''} - ${data.toolName || ''} (${data.status || ''})`,
          isSidechain,
        }
      }

      if (dataType === 'waiting_for_task') {
        return {
          uuid,
          type: 'progress',
          timestamp,
          content: `等待任务: ${data.taskDescription || ''}`,
          isSidechain,
        }
      }

      // 其他进度事件，如果有 message 字段则使用
      if (data.message && typeof data.message === 'string') {
        return {
          uuid,
          type: 'progress',
          timestamp,
          content: data.message,
          isSidechain,
        }
      }

      // 没有有效 message 的进度事件，跳过
      return null
    }

    case 'system': {
      const subtype = obj.subtype || ''
      // 跳过 turn_duration 等无内容的系统事件
      if (subtype === 'turn_duration') return null

      const content = obj.content || ''
      if (!content) return null

      return {
        uuid,
        type: 'system',
        timestamp,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        isSidechain,
      }
    }

    case 'thinking': {
      const thinking = obj.thinking || ''
      if (!thinking) return null
      return {
        uuid,
        type: 'thinking',
        timestamp,
        content: truncate(thinking, 500),
        isSidechain,
      }
    }

    default:
      return null
  }
}

/**
 * 截断字符串到指定长度
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.substring(0, maxLen) + '...'
}

/**
 * 简化工具输入，避免返回大量数据
 */
function abbreviateInput(input: any): any {
  if (!input || typeof input !== 'object') return input

  const result: any = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.length > 200) {
      result[key] = value.substring(0, 200) + '...'
    } else {
      result[key] = value
    }
  }
  return result
}

// ============ API 路由 ============

/**
 * POST /api/sessions/summarize
 * 使用 Claude CLI 生成会话摘要
 */
router.post('/summarize', async (req, res) => {
  const { messages } = req.body
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' })
  }

  // 构建对话摘要 prompt
  const conversationText = messages
    .slice(0, 20) // 最多取前 20 条避免超长
    .map((m: { role: string; content: string }) =>
      `${m.role === 'user' ? '用户' : 'Claude'}: ${m.content.slice(0, 200)}`)
    .join('\n')

  const prompt = `请用 2-3 句话概括以下对话的主要内容和结论，用中文：\n\n${conversationText}`

  try {
    const { spawn } = await import('child_process')
    const env = { ...process.env }
    delete (env as any).CLAUDECODE

    const proc = spawn('claude', ['--print', '-p', prompt], { env, shell: true })
    let output = ''
    let error = ''

    proc.stdout.on('data', (data: Buffer) => { output += data.toString() })
    proc.stderr.on('data', (data: Buffer) => { error += data.toString() })

    proc.on('close', (code: number | null) => {
      if (code === 0 && output.trim()) {
        res.json({ summary: output.trim() })
      } else {
        res.status(500).json({ error: error || 'Summary generation failed' })
      }
    })
  } catch {
    res.status(500).json({ error: 'Summary generation failed' })
  }
})

/**
 * GET /api/sessions/projects
 * 列出 ~/.claude/projects/ 下的所有项目目录
 */
router.get('/projects', async (_req, res) => {
  try {
    const baseExists = await exists(PROJECTS_BASE)
    if (!baseExists) {
      return res.json({ projects: [] })
    }

    const entries = await fs.readdir(PROJECTS_BASE, { withFileTypes: true })
    const projects: {
      name: string
      path: string
      projectPath: string | null
      sessionCount: number
    }[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const dirPath = path.join(PROJECTS_BASE, entry.name)

      // 统计 .jsonl 文件数量
      let sessionCount = 0
      try {
        const files = await fs.readdir(dirPath)
        sessionCount = files.filter(
          (f) => f.endsWith('.jsonl') && !f.includes('/')
        ).length
      } catch {
        continue
      }

      // 尝试从 sessions-index.json 获取原始项目路径
      let projectPath: string | null = null
      const indexData = await readJsonFile<SessionsIndex>(
        path.join(dirPath, 'sessions-index.json')
      )
      if (indexData?.originalPath) {
        projectPath = indexData.originalPath
      } else if (indexData?.entries && indexData.entries.length > 0) {
        // 从第一个条目获取 projectPath
        projectPath = indexData.entries[0].projectPath || null
      }

      projects.push({
        name: entry.name,
        path: dirPath,
        projectPath,
        sessionCount,
      })
    }

    // 按会话数量降序排列（最多的排前面）
    projects.sort((a, b) => b.sessionCount - a.sessionCount || a.name.localeCompare(b.name))

    res.json({ projects })
  } catch (err) {
    console.error('获取项目列表失败:', err)
    res.status(500).json({ error: '获取项目列表失败' })
  }
})

/**
 * GET /api/sessions/:projectDir
 * 列出指定项目目录下的所有会话
 */
router.get('/:projectDir', async (req, res) => {
  try {
    const projectDir = decodeURIComponent(req.params.projectDir)
    const dirPath = path.join(PROJECTS_BASE, projectDir)

    const dirExists = await exists(dirPath)
    if (!dirExists) {
      return res.status(404).json({ error: '项目目录不存在' })
    }

    // 尝试读取 sessions-index.json
    const indexData = await readJsonFile<SessionsIndex>(
      path.join(dirPath, 'sessions-index.json')
    )

    type SessionItem = {
      sessionId: string
      summary: string | null
      firstPrompt: string | null
      messageCount: number | null
      created: string | null
      modified: string | null
      gitBranch: string | null
    }

    // 从索引构建 map
    const indexMap = new Map<string, SessionItem>()
    if (indexData?.entries) {
      for (const entry of indexData.entries) {
        indexMap.set(entry.sessionId, {
          sessionId: entry.sessionId,
          summary: entry.summary || null,
          firstPrompt: entry.firstPrompt || null,
          messageCount: entry.messageCount ?? null,
          created: entry.created || null,
          modified: entry.modified || null,
          gitBranch: entry.gitBranch || null,
        })
      }
    }

    // 扫描实际的 .jsonl 文件，合并索引数据
    const files = await fs.readdir(dirPath)
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'))

    const sessions: SessionItem[] = []
    const seenIds = new Set<string>()

    for (const file of jsonlFiles) {
      const sessionId = file.replace('.jsonl', '')
      seenIds.add(sessionId)

      // 优先使用索引中的元数据
      const indexed = indexMap.get(sessionId)
      if (indexed) {
        sessions.push(indexed)
        continue
      }

      // 没有索引数据，从文件读取基本信息
      const filePath = path.join(dirPath, file)
      let modified: string | null = null
      let created: string | null = null
      try {
        const stat = await fs.stat(filePath)
        modified = stat.mtime.toISOString()
        created = stat.birthtime.toISOString()
      } catch {
        // 忽略
      }

      let firstPrompt: string | null = null
      try {
        const firstUserEvent = await getFirstUserMessage(filePath)
        if (firstUserEvent) {
          firstPrompt = truncate(firstUserEvent, 100)
        }
      } catch {
        // 忽略
      }

      sessions.push({
        sessionId,
        summary: null,
        firstPrompt,
        messageCount: null,
        created,
        modified,
        gitBranch: null,
      })
    }

    // 按 modified 日期降序排列（最新优先）
    sessions.sort((a, b) => {
      const dateA = a.modified ? new Date(a.modified).getTime() : 0
      const dateB = b.modified ? new Date(b.modified).getTime() : 0
      return dateB - dateA
    })

    res.json({ sessions })
  } catch (err) {
    console.error('获取会话列表失败:', err)
    res.status(500).json({ error: '获取会话列表失败' })
  }
})

/**
 * GET /api/sessions/:projectDir/:sessionId
 * 获取解析后的会话内容
 */
router.get('/:projectDir/:sessionId', async (req, res) => {
  try {
    const projectDir = decodeURIComponent(req.params.projectDir)
    const sessionId = req.params.sessionId

    // 优先尝试本地路径，再检查 sessions-index.json 中的 fullPath
    let filePath = path.join(PROJECTS_BASE, projectDir, `${sessionId}.jsonl`)

    if (!(await exists(filePath))) {
      // 尝试从索引获取 fullPath
      const indexData = await readJsonFile<SessionsIndex>(
        path.join(PROJECTS_BASE, projectDir, 'sessions-index.json')
      )
      const entry = indexData?.entries?.find((e) => e.sessionId === sessionId)
      if (entry?.fullPath && (await exists(entry.fullPath))) {
        filePath = entry.fullPath
      }
    }

    const fileExists = await exists(filePath)
    if (!fileExists) {
      return res.status(404).json({ error: '会话文件不存在' })
    }

    const limit = parseInt(req.query.limit as string) || 200
    const offset = parseInt(req.query.offset as string) || 0
    const types = req.query.types
      ? (req.query.types as string).split(',').map((t) => t.trim())
      : undefined

    const { totalEvents, events } = await parseJsonlEvents(filePath, {
      limit,
      offset,
      types,
    })

    res.json({ sessionId, totalEvents, events })
  } catch (err) {
    console.error('获取会话内容失败:', err)
    res.status(500).json({ error: '获取会话内容失败' })
  }
})

/**
 * GET /api/sessions/:projectDir/:sessionId/agents
 * 列出会话的所有子代理
 */
router.get('/:projectDir/:sessionId/agents', async (req, res) => {
  try {
    const projectDir = decodeURIComponent(req.params.projectDir)
    const sessionId = req.params.sessionId

    // 尝试多个可能的子代理目录位置
    let agentsDir = path.join(PROJECTS_BASE, projectDir, sessionId, 'subagents')

    if (!(await exists(agentsDir))) {
      // 尝试从 fullPath 推断子代理目录
      const indexData = await readJsonFile<SessionsIndex>(
        path.join(PROJECTS_BASE, projectDir, 'sessions-index.json')
      )
      const entry = indexData?.entries?.find((e) => e.sessionId === sessionId)
      if (entry?.fullPath) {
        const sessionDir = path.dirname(entry.fullPath)
        const altDir = path.join(sessionDir, sessionId, 'subagents')
        if (await exists(altDir)) {
          agentsDir = altDir
        }
      }
    }

    const dirExists = await exists(agentsDir)
    if (!dirExists) {
      return res.json({ agents: [] })
    }

    const files = await fs.readdir(agentsDir)
    const jsonlFiles = files.filter(
      (f) => f.startsWith('agent-') && f.endsWith('.jsonl')
    )

    const agents: {
      agentId: string
      agentType: string | null
      eventCount: number
      fileSize: number
    }[] = []

    for (const file of jsonlFiles) {
      // 从文件名提取 agentId: agent-{agentId}.jsonl
      const agentId = file.replace(/^agent-/, '').replace(/\.jsonl$/, '')
      const agentFilePath = path.join(agentsDir, file)

      // 尝试读取 .meta.json 获取 agentType
      let agentType: string | null = null
      const metaPath = path.join(agentsDir, `agent-${agentId}.meta.json`)
      const meta = await readJsonFile<{ agentType?: string }>(metaPath)
      if (meta?.agentType) {
        agentType = meta.agentType
      }

      // 获取文件大小和行数
      let eventCount = 0
      let fileSize = 0
      try {
        const stat = await fs.stat(agentFilePath)
        fileSize = stat.size

        // 统计行数作为事件数的近似值
        eventCount = await countLines(agentFilePath)
      } catch {
        // 忽略
      }

      agents.push({ agentId, agentType, eventCount, fileSize })
    }

    // 按 agentId 排序
    agents.sort((a, b) => a.agentId.localeCompare(b.agentId))

    res.json({ agents })
  } catch (err) {
    console.error('获取子代理列表失败:', err)
    res.status(500).json({ error: '获取子代理列表失败' })
  }
})

/**
 * GET /api/sessions/:projectDir/:sessionId/agents/:agentId
 * 获取解析后的子代理转录内容
 */
router.get('/:projectDir/:sessionId/agents/:agentId', async (req, res) => {
  try {
    const projectDir = decodeURIComponent(req.params.projectDir)
    const sessionId = req.params.sessionId
    const agentId = req.params.agentId
    const filePath = path.join(
      PROJECTS_BASE,
      projectDir,
      sessionId,
      'subagents',
      `agent-${agentId}.jsonl`
    )

    const fileExists = await exists(filePath)
    if (!fileExists) {
      return res.status(404).json({ error: '子代理文件不存在' })
    }

    // 尝试读取 agentType
    let agentType: string | null = null
    const metaPath = path.join(
      PROJECTS_BASE,
      projectDir,
      sessionId,
      'subagents',
      `agent-${agentId}.meta.json`
    )
    const meta = await readJsonFile<{ agentType?: string }>(metaPath)
    if (meta?.agentType) {
      agentType = meta.agentType
    }

    const limit = parseInt(req.query.limit as string) || 200
    const offset = parseInt(req.query.offset as string) || 0
    const types = req.query.types
      ? (req.query.types as string).split(',').map((t) => t.trim())
      : undefined

    const { totalEvents, events } = await parseJsonlEvents(filePath, {
      limit,
      offset,
      types,
    })

    res.json({ agentId, agentType, totalEvents, events })
  } catch (err) {
    console.error('获取子代理内容失败:', err)
    res.status(500).json({ error: '获取子代理内容失败' })
  }
})

// ============ 辅助函数 ============

/**
 * 统计文件行数（高效方式）
 */
async function countLines(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0
    const rl = createInterface({
      input: createReadStream(filePath, 'utf-8'),
      crlfDelay: Infinity,
    })
    rl.on('line', () => {
      count++
    })
    rl.on('close', () => resolve(count))
    rl.on('error', reject)
  })
}

/**
 * 从 JSONL 文件中读取第一条非元数据的 user 消息内容
 */
async function getFirstUserMessage(filePath: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: createReadStream(filePath, 'utf-8'),
      crlfDelay: Infinity,
    })

    rl.on('line', (line: string) => {
      if (line.trim() === '') return
      try {
        const obj = JSON.parse(line)
        if (obj.type !== 'user') return
        if (obj.isMeta) return

        const msg = obj.message || {}
        let content = ''
        if (typeof msg.content === 'string') {
          content = msg.content
        } else if (Array.isArray(msg.content)) {
          const textBlocks = msg.content.filter((c: any) => c.type === 'text')
          if (textBlocks.length > 0) {
            content = textBlocks[0].text || ''
          }
        }

        // 跳过本地命令消息
        if (
          content.includes('<local-command-caveat>') ||
          content.includes('<local-command-stdout>') ||
          content.includes('<command-name>') ||
          content.includes('<command-message>')
        ) {
          return
        }

        if (content.trim()) {
          rl.close()
          resolve(content.trim())
        }
      } catch {
        // 忽略解析错误
      }
    })

    rl.on('close', () => {
      resolve(null)
    })

    rl.on('error', reject)
  })
}

export default router
