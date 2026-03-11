/**
 * 消息分享链接生成工具
 * 将消息内容生成为自包含的 HTML data URL，可直接在浏览器中打开
 */

/** 分享消息的参数接口 */
interface ShareMessageParams {
  /** 消息角色 */
  role: 'user' | 'assistant'
  /** 消息内容（Markdown 格式） */
  content: string
  /** 消息时间戳 */
  timestamp: number
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
    .replace(/'/g, '&#39;')
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
  const second = String(d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

/**
 * 简易 Markdown → HTML 转换（不引入外部依赖）
 * 支持：标题、粗体、斜体、行内代码、代码块、链接、列表、引用、水平线
 */
function markdownToHtml(md: string): string {
  let html = escapeHtml(md)

  // 代码块（```lang\n...\n```）— 需要在其他转换之前处理
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const langLabel = lang ? `<div class="code-lang">${lang}</div>` : ''
    return `${langLabel}<pre><code>${code}</code></pre>`
  })

  // 行内代码（`code`）
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // 标题（# ~ ######）
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')

  // 粗体（**text**）
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // 斜体（*text*）
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // 链接（[text](url)）
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  // 引用（> text）
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>')

  // 无序列表（- item）
  html = html.replace(/^-\s+(.+)$/gm, '<li>$1</li>')

  // 有序列表（1. item）
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')

  // 水平线（---）
  html = html.replace(/^---$/gm, '<hr>')

  // 换行：连续两个换行 → 段落分隔，单个换行 → <br>
  html = html.replace(/\n\n/g, '</p><p>')
  html = html.replace(/\n/g, '<br>')

  // 包裹在段落中
  html = `<p>${html}</p>`

  // 清理空段落
  html = html.replace(/<p>\s*<\/p>/g, '')

  return html
}

/**
 * 生成分享用的自包含 HTML 页面内容
 */
function generateShareHtml(params: ShareMessageParams): string {
  const { role, content, timestamp } = params
  const formattedDate = formatDate(timestamp)
  const roleName = role === 'user' ? '用户' : 'Claude'
  const roleAvatar = role === 'user' ? 'U' : 'C'
  const avatarGradient = role === 'user'
    ? 'linear-gradient(135deg, #3b82f6, #60a5fa)'
    : 'linear-gradient(135deg, #7c3aed, #a855f7)'
  const contentHtml = markdownToHtml(content)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(roleName)}的消息分享 - Claude Code Chat</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    background: #0a0a0a;
    color: #e5e5e5;
    display: flex;
    justify-content: center;
    padding: 40px 20px;
    min-height: 100vh;
  }
  .container { max-width: 720px; width: 100%; }
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid #333;
  }
  .avatar {
    width: 36px; height: 36px;
    border-radius: 10px;
    background: ${avatarGradient};
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 15px;
    flex-shrink: 0;
  }
  .header-info { display: flex; flex-direction: column; gap: 2px; }
  .role-name { font-weight: 600; font-size: 14px; color: #f5f5f5; }
  .meta { font-size: 12px; color: #888; }
  .content {
    font-size: 14px;
    line-height: 1.8;
    word-break: break-word;
  }
  .content p { margin: 8px 0; }
  .content h1 { font-size: 1.5em; margin: 16px 0 8px; color: #f5f5f5; }
  .content h2 { font-size: 1.3em; margin: 14px 0 6px; color: #f5f5f5; }
  .content h3 { font-size: 1.15em; margin: 12px 0 4px; color: #f5f5f5; }
  .content h4, .content h5, .content h6 { font-size: 1em; margin: 10px 0 4px; color: #d4d4d4; }
  .content strong { color: #f5f5f5; }
  .content a { color: #818cf8; text-decoration: underline; }
  .content a:hover { color: #a5b4fc; }
  .content blockquote {
    border-left: 3px solid #7c3aed;
    padding: 4px 12px;
    margin: 8px 0;
    color: #a3a3a3;
    background: rgba(124, 58, 237, 0.05);
    border-radius: 0 6px 6px 0;
  }
  .content li {
    margin-left: 20px;
    margin-bottom: 4px;
  }
  .content hr {
    border: none;
    border-top: 1px solid #333;
    margin: 16px 0;
  }
  .content .inline-code {
    background: #1a1a2e;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
    font-size: 13px;
    color: #c4b5fd;
  }
  .content pre {
    background: #111118;
    border: 1px solid #262626;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 12px 0;
  }
  .content pre code {
    background: none;
    padding: 0;
    font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
    font-size: 13px;
    color: #d4d4d4;
  }
  .code-lang {
    font-size: 11px;
    color: #666;
    margin-bottom: -8px;
    margin-top: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .watermark {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #262626;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 11px;
    color: #525252;
  }
  .watermark-dot {
    width: 4px; height: 4px;
    border-radius: 50%;
    background: #525252;
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="avatar">${roleAvatar}</div>
    <div class="header-info">
      <div class="role-name">${escapeHtml(roleName)}</div>
      <div class="meta">${formattedDate}</div>
    </div>
  </div>
  <div class="content">${contentHtml}</div>
  <div class="watermark">
    <span>Claude Code Chat</span>
    <span class="watermark-dot"></span>
    <span>分享于 ${formatDate(Date.now())}</span>
  </div>
</div>
</body>
</html>`
}

/**
 * 生成消息分享的 data URL
 * 将消息内容编码为自包含的 HTML data URL，可直接在浏览器中打开
 *
 * @param params - 分享消息参数（角色、内容、时间戳）
 * @returns data URL 字符串
 */
export function generateShareDataUrl(params: ShareMessageParams): string {
  const html = generateShareHtml(params)
  // 使用 encodeURIComponent 将 HTML 编码为 data URL
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

/**
 * 生成分享链接并复制到剪贴板
 *
 * @param params - 分享消息参数
 * @returns Promise<boolean> 是否复制成功
 */
export async function copyShareLink(params: ShareMessageParams): Promise<boolean> {
  const dataUrl = generateShareDataUrl(params)
  try {
    await navigator.clipboard.writeText(dataUrl)
    return true
  } catch {
    return false
  }
}
