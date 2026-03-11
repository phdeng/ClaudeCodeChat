import type { Session, Message } from '../stores/sessionStore'

/** 导入结果接口 */
export interface ImportResult {
  success: boolean
  session?: Session  // 导入的会话
  error?: string     // 错误信息
}

/**
 * 将时间戳格式化为可读日期字符串
 */
function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

/**
 * 将角色标识转换为中文显示名
 */
function roleName(role: 'user' | 'assistant'): string {
  return role === 'user' ? '用户' : 'Assistant'
}

/**
 * 导出对话会话为 Markdown 格式
 */
export function exportToMarkdown(session: Session): string {
  const lines: string[] = []

  lines.push(`# ${session.title}`)
  lines.push('')
  lines.push(`_日期: ${formatDate(session.createdAt)}_`)
  if (session.workingDirectory) {
    lines.push(`_工作目录: ${session.workingDirectory}_`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const msg of session.messages) {
    const time = formatDate(msg.timestamp)
    lines.push(`**${roleName(msg.role)}** _(${time})_`)
    lines.push('')
    // 保留 assistant 消息中的原始 markdown 格式
    lines.push(msg.content)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * 导出对话会话为 JSON 格式
 */
export function exportToJson(session: Session): string {
  const exportData = {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    createdAtFormatted: formatDate(session.createdAt),
    workingDirectory: session.workingDirectory ?? null,
    messageCount: session.messages.length,
    messages: session.messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      timestampFormatted: formatDate(msg.timestamp),
      tokenUsage: msg.tokenUsage ?? null,
    })),
  }
  return JSON.stringify(exportData, null, 2)
}

/**
 * 从 JSON 字符串解析并创建会话
 * 验证必要字段，为导入的会话和消息生成新 ID 避免冲突
 */
export function importSessionFromJson(jsonString: string): ImportResult {
  try {
    const data = JSON.parse(jsonString)

    // 验证必要字段
    if (!data || typeof data !== 'object') {
      return { success: false, error: '无效的 JSON 格式' }
    }
    if (!data.title || typeof data.title !== 'string') {
      return { success: false, error: '缺少会话标题（title）字段' }
    }
    if (!Array.isArray(data.messages)) {
      return { success: false, error: '缺少消息列表（messages）字段' }
    }

    // 为导入的会话生成新 ID（避免冲突）
    const newSessionId = crypto.randomUUID()

    // 为所有消息生成新 ID 并验证格式
    const messages: Message[] = data.messages.map((msg: Record<string, unknown>) => {
      if (!msg.role || !msg.content) {
        throw new Error('消息缺少 role 或 content 字段')
      }
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        throw new Error(`无效的消息角色：${msg.role}`)
      }
      return {
        id: crypto.randomUUID(),
        role: msg.role as 'user' | 'assistant',
        content: String(msg.content),
        timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
        tokenUsage: msg.tokenUsage && typeof msg.tokenUsage === 'object'
          ? msg.tokenUsage as Message['tokenUsage']
          : undefined,
      }
    })

    const session: Session = {
      id: newSessionId,
      title: data.title,
      messages,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      workingDirectory: typeof data.workingDirectory === 'string' ? data.workingDirectory : undefined,
    }

    return { success: true, session }
  } catch (err) {
    const message = err instanceof Error ? err.message : '解析 JSON 时发生未知错误'
    return { success: false, error: message }
  }
}

/**
 * 生成安全的文件名（移除非法字符）
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'export'
}

/**
 * 触发浏览器下载文件
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = sanitizeFilename(filename)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 导出会话为 Markdown 文件并下载
 */
export function exportSessionAsMarkdown(session: Session): void {
  const content = exportToMarkdown(session)
  const filename = `${session.title}.md`
  downloadFile(content, filename, 'text/markdown;charset=utf-8')
}

/**
 * 导出会话为 JSON 文件并下载
 */
export function exportSessionAsJson(session: Session): void {
  const content = exportToJson(session)
  const filename = `${session.title}.json`
  downloadFile(content, filename, 'application/json;charset=utf-8')
}

/**
 * HTML 特殊字符转义
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 导出会话为自包含的 HTML 文件并下载
 * 生成暗色主题、消息气泡样式的独立 HTML，可直接在浏览器中查看
 */
export function exportSessionAsHtml(session: Session): void {
  const messagesHtml = session.messages
    .map((m) => {
      const time = formatDate(m.timestamp)
      const content = escapeHtml(m.content).replace(/\n/g, '<br>')
      if (m.role === 'user') {
        return `    <div class="msg msg-user"><div><div class="bubble"><p>${content}</p></div><div class="time">${time}</div></div></div>`
      } else {
        return `    <div class="msg msg-assistant"><div class="avatar">AI</div><div class="content"><p>${content}</p><div class="time">${time}</div></div></div>`
      }
    })
    .join('\n')

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(session.title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 24px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 18px; color: #a3a3a3; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #262626; }
    .msg { margin-bottom: 20px; }
    .msg-user { display: flex; justify-content: flex-end; }
    .msg-user .bubble { background: rgba(147,51,234,0.15); border: 1px solid #262626; border-radius: 16px 16px 4px 16px; padding: 10px 16px; max-width: 80%; }
    .msg-assistant { display: flex; gap: 12px; }
    .msg-assistant .avatar { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #d97706, #f59e0b); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; color: white; }
    .msg-assistant .content { flex: 1; }
    .time { font-size: 10px; color: #525252; margin-top: 4px; }
    pre { background: #171717; border: 1px solid #262626; border-radius: 8px; padding: 12px; overflow-x: auto; margin: 8px 0; }
    code { font-family: 'Fira Code', monospace; font-size: 13px; }
    p { line-height: 1.7; font-size: 13.5px; margin: 4px 0; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #262626; font-size: 11px; color: #525252; text-align: center; }
  </style>
</head>
<body>
  <h1>${escapeHtml(session.title)}</h1>
${messagesHtml}
  <div class="footer">导出自 Claude Code Chat &middot; ${new Date().toLocaleDateString('zh-CN')}</div>
</body>
</html>`

  downloadFile(html, `${session.title}.html`, 'text/html;charset=utf-8')
}
