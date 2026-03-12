import { spawn, ChildProcess, execSync } from 'child_process'
import { EventEmitter } from 'events'
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs'
import { tmpdir, platform } from 'os'
import { join } from 'path'
import { getSettings } from './configManager.js'

const isWindows = platform() === 'win32'

/** 图片附件信息 */
interface ImageAttachment {
  /** base64 编码的图片数据（含 data:image/... 前缀） */
  base64: string
  /** 文件名 */
  name: string
}

function cleanEnv(): Record<string, string | undefined> {
  const env = { ...process.env }
  delete env.CLAUDECODE
  return env
}

/**
 * 构建最终的环境变量：基础环境 + 用户在设置中配置的自定义环境变量
 * 自定义变量会覆盖同名的系统环境变量
 */
async function buildEnv(): Promise<Record<string, string | undefined>> {
  const env = cleanEnv()
  try {
    const settings = await getSettings()
    if (settings.env && typeof settings.env === 'object') {
      for (const [key, value] of Object.entries(settings.env)) {
        if (typeof value === 'string') {
          env[key] = value
        }
      }
    }
  } catch {
    // 读取配置失败时使用默认环境变量
  }
  return env
}

// Maps frontend session IDs to Claude CLI session IDs
const cliSessionMap = new Map<string, string>()

/**
 * 批量删除指定的 sessionId 映射（用于 WebSocket 关闭时清理）
 */
export function cleanupSessionMappings(sessionIds: string[]): void {
  for (const id of sessionIds) {
    cliSessionMap.delete(id)
  }
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export class ClaudeCodeManager extends EventEmitter {
  private process: ChildProcess | null = null
  private sessionId: string
  private model?: string
  private permissionMode?: string
  // 工作目录，用于指定 Claude CLI 的执行目录
  private workingDirectory?: string
  // 自定义系统提示词
  private systemPrompt?: string
  // 前端传来的 CLI session ID（备份，用于 WS 重连后恢复对话）
  private cliSessionIdFromClient?: string
  private gotAssistantMessage = false
  private hasError = false
  private tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 }
  // 跟踪 thinking 流的状态：是否正在流式输出 thinking 内容
  private inThinkingStream = false
  // 标记是否已通过 stream_event 接收过数据（用于避免 assistant 事件重复发送）
  private receivedStreamEvents = false
  // 已发送过的 tool_use ID 集合，避免 --include-partial-messages 模式下重复发送
  private emittedToolUseIds = new Set<string>()

  constructor(sessionId: string, model?: string, permissionMode?: string, workingDirectory?: string, systemPrompt?: string, cliSessionId?: string) {
    super()
    this.sessionId = sessionId
    this.model = model
    this.permissionMode = permissionMode
    this.workingDirectory = workingDirectory
    this.systemPrompt = systemPrompt
    this.cliSessionIdFromClient = cliSessionId
  }

  static async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('claude', ['--version'], { shell: true, env: cleanEnv() })
      proc.on('close', (code) => resolve(code === 0))
      proc.on('error', () => resolve(false))
    })
  }

  /**
   * 将 base64 图片数据保存到临时目录，返回文件路径列表
   * 用于将图片传递给 Claude CLI（通过文件路径引用）
   */
  private saveImagesToTemp(images: ImageAttachment[]): string[] {
    const tempDir = join(tmpdir(), 'claudecodechat-images')
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true })
    }

    const savedPaths: string[] = []
    for (const img of images) {
      // 解析 base64 数据（去掉 data:image/png;base64, 前缀）
      const matches = img.base64.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!matches) continue

      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
      const data = matches[2]
      const fileName = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const filePath = join(tempDir, fileName)

      writeFileSync(filePath, Buffer.from(data, 'base64'))
      savedPaths.push(filePath)
    }

    return savedPaths
  }

  /**
   * 清理临时图片文件
   */
  private cleanupTempImages(paths: string[]): void {
    for (const p of paths) {
      try {
        if (existsSync(p)) {
          unlinkSync(p)
        }
      } catch {
        // 忽略清理失败
      }
    }
  }

  async send(message: string, images?: ImageAttachment[], options?: {
    /** 推理努力程度 */
    effort?: 'low' | 'medium' | 'high' | 'max'
    /** 最大预算（美元） */
    maxBudgetUsd?: number
    /** 备用模型 */
    fallbackModel?: string
    /** 允许使用的工具列表 */
    allowedTools?: string[]
    /** 禁止使用的工具列表 */
    disallowedTools?: string[]
    /** 从 PR 加载上下文 */
    fromPr?: string
  }): Promise<void> {
    // 预先构建环境变量（包含用户自定义环境变量）
    const env = await buildEnv()

    // 处理图片附件：保存为临时文件
    let tempImagePaths: string[] = []
    let finalMessage = message
    if (images && images.length > 0) {
      tempImagePaths = this.saveImagesToTemp(images)
      if (tempImagePaths.length > 0) {
        // Windows 反斜杠路径会导致 CLI 无法识别 @文件引用，统一转为正斜杠
        const imageRefs = tempImagePaths.map(p => `@${p.replace(/\\/g, '/')}`).join(' ')
        finalMessage = `${imageRefs} ${message}`
        console.log('[image] 图片引用:', imageRefs)
      }
    }

    // 内部启动 CLI 进程的方法，支持 retry
    const startCLI = (useSessionId: boolean): Promise<void> => {
      return new Promise((resolve, reject) => {
        try {
          this.gotAssistantMessage = false
          this.hasError = false
          this.inThinkingStream = false
          this.receivedStreamEvents = false
          this.emittedToolUseIds.clear()
          this.tokenUsage = { inputTokens: 0, outputTokens: 0 }

          const args = [
            '--print',
            '--verbose',
            '--output-format', 'stream-json',
            '--include-partial-messages',
          ]

          if (this.model) {
            args.push('--model', this.model)
          }

          if (this.permissionMode) {
            args.push('--permission-mode', this.permissionMode)
          }

          if (this.systemPrompt) {
            args.push('--system-prompt', this.systemPrompt)
          }

          // 可选 CLI 参数
          if (options?.effort) {
            args.push('--effort', options.effort)
          }
          if (options?.maxBudgetUsd && options.maxBudgetUsd > 0) {
            args.push('--max-budget-usd', String(options.maxBudgetUsd))
          }
          if (options?.fallbackModel) {
            args.push('--fallback-model', options.fallbackModel)
          }
          if (options?.allowedTools?.length) {
            args.push('--allowedTools', options.allowedTools.join(','))
          }
          if (options?.disallowedTools?.length) {
            args.push('--disallowedTools', options.disallowedTools.join(','))
          }
          if (options?.fromPr) {
            args.push('--from-pr', options.fromPr)
          }

          // 使用 --resume 恢复已有会话（保持多轮对话上下文）
          // 注意：--session-id 用于创建新会话时指定 ID，已有会话必须用 --resume
          if (useSessionId) {
            const cliSessionId = cliSessionMap.get(this.sessionId) || this.cliSessionIdFromClient
            if (cliSessionId) {
              args.push('--resume', cliSessionId)
            }
          }

          this.process = spawn('claude', args, {
            shell: true,
            env,
            stdio: ['pipe', 'pipe', 'pipe'],
            ...(this.workingDirectory ? { cwd: this.workingDirectory } : {}),
          })

          this.process.stdin?.write(finalMessage)
          this.process.stdin?.end()

          let buffer = ''

          this.process.stdout?.on('data', (chunk: Buffer) => {
            buffer += chunk.toString()
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              this.processLine(line)
            }
          })

          let stderrOutput = ''
          this.process.stderr?.on('data', (chunk: Buffer) => {
            const text = chunk.toString().trim()
            if (text) {
              console.error('[claude stderr]', text)
              stderrOutput += text + '\n'
            }
          })

          this.process.on('close', (code) => {
            if (buffer.trim()) {
              this.processLine(buffer)
            }
            if (this.inThinkingStream) {
              this.inThinkingStream = false
              this.emit('data', '</thinking>\n\n')
            }

            // 检测 "already in use" 错误 → 清除映射后自动重试（不带 session ID）
            if (code !== 0 && stderrOutput.includes('already in use') && useSessionId) {
              console.log(`[retry] Session ID already in use for ${this.sessionId}, retrying without session ID`)
              cliSessionMap.delete(this.sessionId)
              this.cliSessionIdFromClient = undefined
              this.process = null
              // 重试：不带 session ID
              startCLI(false).then(resolve).catch(reject)
              return
            }

            if (code !== 0 && !this.gotAssistantMessage) {
              this.hasError = true
              const detail = stderrOutput.trim()
              const msg = detail
                ? `CLI exited with code ${code}: ${detail}`
                : `CLI exited with code ${code}`
              this.emit('error', msg)
            }
            if (!this.hasError) {
              this.emit('done', this.tokenUsage)
            }
            this.process = null
            if (tempImagePaths.length > 0) {
              this.cleanupTempImages(tempImagePaths)
            }
            resolve()
          })

          this.process.on('error', (err) => {
            this.emit('error', err.message)
            this.process = null
            reject(err)
          })
        } catch (err) {
          this.emit('error', (err as Error).message)
          reject(err)
        }
      })
    }

    // 首次尝试带 session ID（保持多轮对话上下文）
    return startCLI(true)
  }

  private processLine(line: string): void {
    if (!line.trim()) return
    try {
      const event = JSON.parse(line)

      if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
        cliSessionMap.set(this.sessionId, event.session_id)
        // 将 CLI session ID 传给前端存储，以便 WS 重连后仍能继续对话
        this.emit('init', event.session_id)
        return
      }

      // 处理流式 delta 事件（通过 --include-partial-messages 启用）
      // 这些事件包含 thinking 和 text 的增量内容，实现实时流式显示
      if (event.type === 'stream_event' && event.event?.delta) {
        this.receivedStreamEvents = true
        const delta = event.event.delta
        if (delta.type === 'thinking_delta' && delta.thinking) {
          // thinking 增量：首次收到时发送开始标签
          if (!this.inThinkingStream) {
            this.inThinkingStream = true
            this.emit('data', '<thinking>')
          }
          this.emit('data', delta.thinking)
        } else if (delta.type === 'text_delta' && delta.text) {
          // text 增量：如果之前正在 thinking 流中，先关闭 thinking 标签
          if (this.inThinkingStream) {
            this.inThinkingStream = false
            this.emit('data', '</thinking>\n\n')
          }
          this.gotAssistantMessage = true
          this.emit('data', delta.text)
        }
        return
      }

      // 处理 content_block_stop 事件，关闭未结束的 thinking 标签
      if (event.type === 'stream_event' && event.event?.type === 'content_block_stop') {
        this.receivedStreamEvents = true
        if (this.inThinkingStream) {
          this.inThinkingStream = false
          this.emit('data', '</thinking>\n\n')
        }
        return
      }

      // 跳过其他 stream_event 类型（如 content_block_start、message_start 等）
      if (event.type === 'stream_event') {
        this.receivedStreamEvents = true
        return
      }

      // 处理 progress 事件：CLI 在执行代理/钩子/MCP 操作时会发送进度事件
      if (event.type === 'progress') {
        const progressType = event.data?.type || event.subtype || 'unknown'
        const progressName = event.data?.hookName || event.data?.agentSlug || event.data?.mcpServer || event.data?.name || ''
        this.emit('data', `\n<progress type="${progressType}" name="${progressName}">${JSON.stringify(event.data || {})}</progress>\n`)
        return
      }

      // 处理工具调用事件：tool_use 包含在 assistant 消息的 content blocks 中
      // 注意：--include-partial-messages 模式下 assistant 事件会多次发送累积内容
      // 需要通过 emittedToolUseIds 去重，避免同一个 tool_use 被多次发送到前端
      if (event.type === 'assistant' && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'tool_use' && block.id && !this.emittedToolUseIds.has(block.id)) {
            this.emittedToolUseIds.add(block.id)
            // 如果正在 thinking 流中，先关闭
            if (this.inThinkingStream) {
              this.inThinkingStream = false
              this.emit('data', '</thinking>\n\n')
            }
            const toolInput = JSON.stringify(block.input || {})
            // 截断过长的输入参数（保留前 1000 字符）
            const truncatedInput = toolInput.length > 1000
              ? toolInput.substring(0, 1000) + '...'
              : toolInput
            this.emit('data', `\n<tool-use id="${block.id}" name="${block.name}">${truncatedInput}</tool-use>\n`)
          }
        }
      }

      // 处理工具结果事件
      if (event.type === 'tool_result') {
        let resultText = ''
        if (Array.isArray(event.content)) {
          resultText = event.content.map((c: { text?: string }) => c.text || '').join('')
        } else if (typeof event.content === 'string') {
          resultText = event.content
        }
        // 截断过长的结果（保留前 500 字符）
        const truncated = resultText.length > 500
          ? resultText.substring(0, 500) + '...'
          : resultText
        const toolUseId = event.tool_use_id || ''
        this.emit('data', `\n<tool-result id="${toolUseId}">${truncated}</tool-result>\n`)
        return
      }

      // 回退处理：assistant 事件
      // 当已通过 stream_event 接收数据时，跳过 assistant 事件避免重复
      // assistant 事件在 --include-partial-messages 模式下包含完整的累积内容
      if (event.type === 'assistant') {
        if (this.receivedStreamEvents) {
          // 已通过 stream_event 处理，忽略累积的 assistant 事件
          // 但仍需标记 gotAssistantMessage（仅当 text 非空时）
          if (event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'text' && block.text) {
                this.gotAssistantMessage = true
              }
            }
          }
        } else if (event.message?.content) {
          // 没有 stream_event（旧版 CLI 不支持），使用 assistant 事件的内容
          for (const block of event.message.content) {
            if (block.type === 'thinking' && block.thinking) {
              this.emit('data', `<thinking>${block.thinking}</thinking>\n\n`)
            }
            if (block.type === 'text' && block.text) {
              this.gotAssistantMessage = true
              this.emit('data', block.text)
            }
          }
        }
      } else if (event.type === 'result') {
        // 确保 thinking 标签已关闭
        if (this.inThinkingStream) {
          this.inThinkingStream = false
          this.emit('data', '</thinking>\n\n')
        }
        if (!this.gotAssistantMessage && event.result) {
          this.emit('data', event.result)
        }
        // 从 result 事件中提取 token 用量
        if (event.usage) {
          this.tokenUsage = {
            inputTokens: event.usage.input_tokens || 0,
            outputTokens: event.usage.output_tokens || 0,
          }
        }
      }
    } catch {
      this.emit('data', line)
    }
  }

  /** 检查 CLI 进程是否仍在运行 */
  isProcessAlive(): boolean {
    return this.process !== null && !this.process.killed
  }

  stop(): void {
    if (this.process) {
      const pid = this.process.pid
      if (isWindows && pid) {
        // Bug #6 修复：Windows 上 shell:true 启动的进程，SIGTERM 无法传递给子进程树
        // 使用 taskkill /T /F 强制终止整个进程树
        try {
          execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
        } catch {
          // taskkill 失败时回退到 SIGKILL
          try {
            process.kill(pid, 'SIGKILL')
          } catch {
            // 进程可能已退出，忽略错误
          }
        }
      } else {
        this.process.kill('SIGTERM')
      }
      this.process = null
    }
  }
}
