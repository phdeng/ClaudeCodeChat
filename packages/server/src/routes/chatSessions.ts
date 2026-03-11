import { Router, type Router as RouterType } from 'express'
import { sessionStorage, type StoredSession } from '../services/sessionStorage.js'

const router: RouterType = Router()

/**
 * GET /api/chat-sessions
 * 获取所有会话列表（不含消息内容，减少传输量）
 * 返回: { sessions: SessionListItem[] }
 */
router.get('/', async (_req, res) => {
  try {
    const sessions = await sessionStorage.listSessions()
    res.json({ sessions })
  } catch (err) {
    console.error('获取会话列表失败:', err)
    res.status(500).json({ error: '获取会话列表失败' })
  }
})

/**
 * POST /api/chat-sessions/sync
 * 批量同步所有会话数据（前端发送全部会话，后端整体替换存储）
 * Body: { sessions: StoredSession[] }
 * 返回: { success: true, count: number }
 *
 * 注意：此路由必须在 /:id 参数路由之前定义，防止 Express 将 /sync 当作 :id 匹配
 */
router.post('/sync', async (req, res) => {
  try {
    const { sessions } = req.body as { sessions: StoredSession[] }
    if (!Array.isArray(sessions)) {
      return res.status(400).json({ error: '无效的会话数据，需要 sessions 数组' })
    }

    await sessionStorage.syncAll(sessions)
    res.json({ success: true, count: sessions.length })
  } catch (err) {
    console.error('批量同步会话失败:', err)
    res.status(500).json({ error: '批量同步会话失败' })
  }
})

/**
 * GET /api/chat-sessions/:id
 * 获取单个会话的完整数据（含消息内容）
 * 返回: StoredSession | 404
 */
router.get('/:id', async (req, res) => {
  try {
    const session = await sessionStorage.getSession(req.params.id)
    if (!session) {
      return res.status(404).json({ error: '会话不存在' })
    }
    res.json(session)
  } catch (err) {
    console.error('获取会话详情失败:', err)
    res.status(500).json({ error: '获取会话详情失败' })
  }
})

/**
 * POST /api/chat-sessions
 * 创建或更新会话（upsert 语义）
 * Body: StoredSession
 * 返回: { success: true, id: string }
 */
router.post('/', async (req, res) => {
  try {
    const session = req.body as StoredSession
    if (!session || !session.id) {
      return res.status(400).json({ error: '缺少会话 ID' })
    }
    // 确保必要字段存在
    if (!session.title) {
      session.title = '新对话'
    }
    if (!session.messages) {
      session.messages = []
    }
    if (!session.createdAt) {
      session.createdAt = Date.now()
    }

    await sessionStorage.upsertSession(session)
    res.json({ success: true, id: session.id })
  } catch (err) {
    console.error('创建/更新会话失败:', err)
    res.status(500).json({ error: '创建/更新会话失败' })
  }
})

/**
 * PUT /api/chat-sessions/:id
 * 更新指定会话
 * Body: StoredSession（id 从 URL 参数取）
 * 返回: { success: true, id: string }
 */
router.put('/:id', async (req, res) => {
  try {
    const session = req.body as StoredSession
    if (!session) {
      return res.status(400).json({ error: '缺少会话数据' })
    }
    // 使用 URL 参数中的 id
    session.id = req.params.id
    if (!session.title) {
      session.title = '新对话'
    }
    if (!session.messages) {
      session.messages = []
    }
    if (!session.createdAt) {
      session.createdAt = Date.now()
    }

    await sessionStorage.upsertSession(session)
    res.json({ success: true, id: session.id })
  } catch (err) {
    console.error('更新会话失败:', err)
    res.status(500).json({ error: '更新会话失败' })
  }
})

/**
 * DELETE /api/chat-sessions/:id
 * 删除指定会话
 * 返回: { success: true } | 404
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await sessionStorage.deleteSession(req.params.id)
    if (!deleted) {
      return res.status(404).json({ error: '会话不存在' })
    }
    res.json({ success: true })
  } catch (err) {
    console.error('删除会话失败:', err)
    res.status(500).json({ error: '删除会话失败' })
  }
})

export default router
