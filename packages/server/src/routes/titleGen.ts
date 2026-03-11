import { Router, type Router as RouterType } from 'express'
import { spawn } from 'child_process'

const router: RouterType = Router()

// 生成会话标题的 API
router.post('/generate', async (req, res) => {
  try {
    const { messages } = req.body
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages is required' })
      return
    }

    // 取前 3 条消息构建上下文
    const context = messages.slice(0, 3).map((m: any) =>
      `${m.role === 'user' ? '用户' : '助手'}: ${m.content.slice(0, 200)}`
    ).join('\n')

    const prompt = `根据以下对话内容，生成一个简洁的中文标题（10-20字，不要引号，不要标点）：\n\n${context}\n\n标题：`

    // 使用 claude CLI 的 --print 模式生成标题
    const env = { ...process.env }
    delete (env as any).CLAUDECODE

    const title = await new Promise<string>((resolve, reject) => {
      const proc = spawn('claude', [
        '--print',
        '--output-format', 'text',
      ], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      // 通过 stdin 传入 prompt（避免 Windows 命令行参数长度限制）
      proc.stdin?.write(prompt)
      proc.stdin?.end()

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

      // 15 秒超时
      const timer = setTimeout(() => {
        proc.kill('SIGTERM')
        reject(new Error('Title generation timed out'))
      }, 15000)

      proc.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0 && stdout.trim()) {
          resolve(stdout.trim())
        } else {
          reject(new Error(stderr || `CLI exited with code ${code}`))
        }
      })

      proc.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })

    const cleanTitle = title.replace(/^["'""\s]+|["'""\s]+$/g, '').slice(0, 30)
    res.json({ title: cleanTitle })
  } catch (err: any) {
    console.error('Title generation failed:', err.message)
    // 失败不阻塞，返回空
    res.json({ title: '' })
  }
})

export default router
