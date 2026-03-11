import { Router, type Router as RouterType } from 'express'
import { spawn } from 'child_process'

const router: RouterType = Router()

// 翻译消息内容的 API
router.post('/translate', async (req, res) => {
  const { text, targetLang } = req.body
  if (!text || !targetLang) {
    res.status(400).json({ error: 'text and targetLang required' })
    return
  }

  const prompt = `Translate the following text to ${targetLang}. Only output the translation, nothing else:\n\n${text}`

  try {
    const env = { ...process.env }
    delete (env as any).CLAUDECODE

    const proc = spawn('claude', ['--print'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // 通过 stdin 传入 prompt（避免 shell 注入风险和 Windows 引号问题）
    proc.stdin?.write(prompt)
    proc.stdin?.end()

    let output = ''
    let error = ''

    proc.stdout.on('data', (data: Buffer) => { output += data.toString() })
    proc.stderr.on('data', (data: Buffer) => { error += data.toString() })

    proc.on('close', (code) => {
      if (code === 0 && output.trim()) {
        res.json({ translation: output.trim() })
      } else {
        res.status(500).json({ error: error || 'Translation failed' })
      }
    })

    proc.on('error', () => {
      res.status(500).json({ error: 'Translation failed' })
    })
  } catch (err) {
    res.status(500).json({ error: 'Translation failed' })
  }
})

export default router
