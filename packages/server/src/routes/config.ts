import { Router, type Router as RouterType } from 'express'
import * as config from '../services/configManager.js'

const router: RouterType = Router()

// 辅助：从 query 解析 scope 和 workingDirectory，返回项目级 workingDirectory 或 undefined（全局）
function resolveWorkingDir(query: Record<string, any>): string | undefined {
  const scope = query.scope as string | undefined
  const workingDirectory = query.workingDirectory as string | undefined
  if (scope === 'project' && workingDirectory) {
    return workingDirectory
  }
  return undefined
}

// MCP Servers
router.get('/mcp-servers', async (req, res) => {
  const wd = resolveWorkingDir(req.query)
  const servers = await config.getMcpServers(wd)
  res.json(servers)
})

router.post('/mcp-servers', async (req, res) => {
  const { name, config: serverConfig, scope, workingDirectory } = req.body
  if (!name) return res.status(400).json({ error: 'Name is required' })
  const wd = scope === 'project' && workingDirectory ? workingDirectory : undefined
  await config.addMcpServer(name, serverConfig, wd)
  res.json({ ok: true })
})

router.put('/mcp-servers/:name', async (req, res) => {
  try {
    const { config: serverConfig, scope, workingDirectory } = req.body
    if (!serverConfig) return res.status(400).json({ error: 'Config is required' })
    const wd = scope === 'project' && workingDirectory ? workingDirectory : undefined
    await config.updateMcpServer(req.params.name, serverConfig, wd)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update MCP server' })
  }
})

router.delete('/mcp-servers/:name', async (req, res) => {
  const wd = resolveWorkingDir(req.query)
  await config.removeMcpServer(req.params.name, wd)
  res.json({ ok: true })
})

// Hooks
router.get('/hooks', async (req, res) => {
  const wd = resolveWorkingDir(req.query)
  const hooks = await config.getHooks(wd)
  res.json(hooks)
})

router.put('/hooks', async (req, res) => {
  const { hooks, scope, workingDirectory } = req.body
  // 兼容旧接口：如果 body 直接就是 hooks 数据（没有 hooks 字段），则整个 body 作为 hooks
  const hooksData = hooks !== undefined ? hooks : (() => {
    // 去掉 scope 和 workingDirectory 字段后的其余字段即为 hooks 数据
    const { scope: _s, workingDirectory: _w, ...rest } = req.body
    return rest
  })()
  const wd = scope === 'project' && workingDirectory ? workingDirectory : undefined
  await config.saveHooks(hooksData, wd)
  res.json({ ok: true })
})

// General settings
router.get('/settings', async (req, res) => {
  try {
    const wd = resolveWorkingDir(req.query)
    const settings = await config.getSettings(wd)
    res.json(settings)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/settings', async (req, res) => {
  try {
    const { scope, workingDirectory, ...settingsData } = req.body
    const wd = scope === 'project' && workingDirectory ? workingDirectory : undefined
    const merged = await config.updateSettings(settingsData, wd)
    res.json(merged)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Agents
router.get('/agents', async (req, res) => {
  try {
    const wd = resolveWorkingDir(req.query)
    const agents = await config.getAgents(wd)
    res.json(agents)
  } catch (err) {
    res.status(500).json({ error: 'Failed to list agents' })
  }
})

router.get('/agents/:name', async (req, res) => {
  try {
    const wd = resolveWorkingDir(req.query)
    const agent = await config.getAgent(req.params.name, wd)
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' })
    }
    res.json(agent)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get agent' })
  }
})

router.post('/agents', async (req, res) => {
  try {
    const { name, frontmatter, body, scope, workingDirectory } = req.body
    if (!name) {
      return res.status(400).json({ error: 'Name is required' })
    }
    const wd = scope === 'project' && workingDirectory ? workingDirectory : undefined
    // 检查是否已存在
    const existing = await config.getAgent(name, wd)
    if (existing) {
      return res.status(409).json({ error: 'Agent already exists' })
    }
    await config.saveAgent(name, frontmatter || {}, body || '', wd)
    res.status(201).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create agent' })
  }
})

router.put('/agents/:name', async (req, res) => {
  try {
    const { frontmatter, body, scope, workingDirectory } = req.body
    const wd = scope === 'project' && workingDirectory ? workingDirectory : undefined
    const existing = await config.getAgent(req.params.name, wd)
    if (!existing) {
      return res.status(404).json({ error: 'Agent not found' })
    }
    await config.saveAgent(req.params.name, frontmatter || existing.frontmatter, body ?? existing.body, wd)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update agent' })
  }
})

router.delete('/agents/:name', async (req, res) => {
  try {
    const wd = resolveWorkingDir(req.query)
    const deleted = await config.deleteAgent(req.params.name, wd)
    if (!deleted) {
      return res.status(404).json({ error: 'Agent not found' })
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete agent' })
  }
})

// Skills (project-level, requires workingDirectory)
router.get('/skills', async (req, res) => {
  try {
    const workingDirectory = req.query.workingDirectory as string | undefined
    if (!workingDirectory) {
      return res.status(400).json({ error: 'workingDirectory is required' })
    }
    const skills = await config.getSkills(workingDirectory)
    res.json(skills)
  } catch (err) {
    res.status(500).json({ error: 'Failed to list skills' })
  }
})

router.get('/skills/:name', async (req, res) => {
  try {
    const workingDirectory = req.query.workingDirectory as string | undefined
    if (!workingDirectory) {
      return res.status(400).json({ error: 'workingDirectory is required' })
    }
    const skill = await config.getSkill(workingDirectory, req.params.name)
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' })
    }
    res.json(skill)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get skill' })
  }
})

router.post('/skills', async (req, res) => {
  try {
    const { name, content, workingDirectory } = req.body
    if (!name || !workingDirectory) {
      return res.status(400).json({ error: 'name and workingDirectory are required' })
    }
    // 检查是否已存在
    const existing = await config.getSkill(workingDirectory, name)
    if (existing) {
      return res.status(409).json({ error: 'Skill already exists' })
    }
    await config.saveSkill(workingDirectory, name, content || '')
    res.status(201).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create skill' })
  }
})

router.put('/skills/:name', async (req, res) => {
  try {
    const { content, workingDirectory } = req.body
    if (!workingDirectory) {
      return res.status(400).json({ error: 'workingDirectory is required' })
    }
    const existing = await config.getSkill(workingDirectory, req.params.name)
    if (!existing) {
      return res.status(404).json({ error: 'Skill not found' })
    }
    await config.saveSkill(workingDirectory, req.params.name, content ?? existing.content)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update skill' })
  }
})

router.delete('/skills/:name', async (req, res) => {
  try {
    const workingDirectory = req.query.workingDirectory as string | undefined
    if (!workingDirectory) {
      return res.status(400).json({ error: 'workingDirectory is required' })
    }
    const deleted = await config.deleteSkill(workingDirectory, req.params.name)
    if (!deleted) {
      return res.status(404).json({ error: 'Skill not found' })
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete skill' })
  }
})

// Rules (project-level CLAUDE.md)
router.get('/rules', async (req, res) => {
  try {
    const workingDirectory = req.query.workingDirectory as string | undefined
    if (!workingDirectory) {
      return res.status(400).json({ error: 'workingDirectory is required' })
    }
    const content = await config.getRules(workingDirectory)
    res.json({ content })
  } catch (err) {
    res.status(500).json({ error: 'Failed to read rules' })
  }
})

router.put('/rules', async (req, res) => {
  try {
    const { content, workingDirectory } = req.body
    if (!workingDirectory) {
      return res.status(400).json({ error: 'workingDirectory is required' })
    }
    await config.saveRules(workingDirectory, content ?? '')
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to save rules' })
  }
})

export default router
