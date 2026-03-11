import { readFile, writeFile, mkdir, readdir, unlink, rm, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { homedir } from 'os'
import path from 'path'
import YAML from 'yaml'

const CLAUDE_DIR = path.join(homedir(), '.claude')
const CLAUDE_JSON = path.join(homedir(), '.claude.json')
const USER_SETTINGS = path.join(CLAUDE_DIR, 'settings.json')
const AGENTS_DIR = path.join(CLAUDE_DIR, 'agents')

async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

async function readJsonFile(filePath: string): Promise<any> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function writeJsonFile(filePath: string, data: any): Promise<void> {
  await ensureDir(path.dirname(filePath))
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// MCP Servers
// 配置存储在 ~/.claude.json 中:
//   全局 MCP: 顶层 mcpServers 字段
//   项目 MCP: projects["项目路径"].mcpServers 字段
// workingDirectory 需要转为正斜杠路径作为 projects 的 key

/** 将 Windows 路径转为 ~/.claude.json 中 projects 使用的 key 格式 (正斜杠) */
function toProjectKey(dir: string): string {
  return dir.replace(/\\/g, '/')
}

export async function getMcpServers(workingDirectory?: string): Promise<Record<string, any>> {
  const claudeJson = await readJsonFile(CLAUDE_JSON)
  if (workingDirectory) {
    const key = toProjectKey(workingDirectory)
    return claudeJson.projects?.[key]?.mcpServers || {}
  }
  return claudeJson.mcpServers || {}
}

export async function saveMcpServers(servers: Record<string, any>, workingDirectory?: string): Promise<void> {
  const claudeJson = await readJsonFile(CLAUDE_JSON)
  if (workingDirectory) {
    const key = toProjectKey(workingDirectory)
    if (!claudeJson.projects) claudeJson.projects = {}
    if (!claudeJson.projects[key]) claudeJson.projects[key] = {}
    claudeJson.projects[key].mcpServers = servers
  } else {
    claudeJson.mcpServers = servers
  }
  await writeJsonFile(CLAUDE_JSON, claudeJson)
}

export async function addMcpServer(name: string, config: any, workingDirectory?: string): Promise<void> {
  const servers = await getMcpServers(workingDirectory)
  servers[name] = config
  await saveMcpServers(servers, workingDirectory)
}

export async function updateMcpServer(name: string, config: any, workingDirectory?: string): Promise<void> {
  const servers = await getMcpServers(workingDirectory)
  if (!servers[name]) {
    throw new Error(`MCP server "${name}" not found`)
  }
  servers[name] = config
  await saveMcpServers(servers, workingDirectory)
}

export async function removeMcpServer(name: string, workingDirectory?: string): Promise<void> {
  const servers = await getMcpServers(workingDirectory)
  delete servers[name]
  await saveMcpServers(servers, workingDirectory)
}

// Hooks
// workingDirectory 传入时读写 {workingDirectory}/.claude/settings.json 的 hooks
function getSettingsFilePath(workingDirectory?: string): string {
  if (workingDirectory) {
    return path.join(workingDirectory, '.claude', 'settings.json')
  }
  return USER_SETTINGS
}

export async function getHooks(workingDirectory?: string): Promise<Record<string, any>> {
  const settingsFile = getSettingsFilePath(workingDirectory)
  const settings = await readJsonFile(settingsFile)
  return settings.hooks || {}
}

export async function saveHooks(hooks: Record<string, any>, workingDirectory?: string): Promise<void> {
  const settingsFile = getSettingsFilePath(workingDirectory)
  const settings = await readJsonFile(settingsFile)
  settings.hooks = hooks
  await writeJsonFile(settingsFile, settings)
}

// General settings
export async function getSettings(workingDirectory?: string): Promise<any> {
  const settingsFile = getSettingsFilePath(workingDirectory)
  return readJsonFile(settingsFile)
}

export async function saveSettings(settings: any, workingDirectory?: string): Promise<void> {
  const settingsFile = getSettingsFilePath(workingDirectory)
  await writeJsonFile(settingsFile, settings)
}

// Deep merge utility: merges source into target recursively
// If source[key] === null, the key is deleted from the result (null = delete semantic)
function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] === null) {
      // null means "delete this field"
      delete result[key]
    } else if (
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

export async function updateSettings(partial: Record<string, any>, workingDirectory?: string): Promise<any> {
  const settingsFile = getSettingsFilePath(workingDirectory)
  const existing = await readJsonFile(settingsFile)
  const merged = deepMerge(existing, partial)
  await writeJsonFile(settingsFile, merged)
  return merged
}

// Agents - manage .md files in ~/.claude/agents/

export interface AgentFrontmatter {
  name?: string
  description?: string
  tools?: string | string[]
  disallowedTools?: string | string[]
  model?: string
  permissionMode?: string
  maxTurns?: number
  skills?: string | string[]
  mcpServers?: string | string[]
  hooks?: string
  memory?: string
  background?: string
  isolation?: string
  [key: string]: any
}

export interface Agent {
  name: string
  filename: string
  frontmatter: AgentFrontmatter
  body: string
}

function parseFrontmatter(content: string): { frontmatter: AgentFrontmatter; body: string } {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: content }
  }

  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1) {
    return { frontmatter: {}, body: content }
  }

  const yamlBlock = trimmed.slice(3, endIndex).trim()
  const body = trimmed.slice(endIndex + 3).replace(/^\r?\n/, '')

  try {
    const parsed = YAML.parse(yamlBlock)
    const frontmatter: AgentFrontmatter = typeof parsed === 'object' && parsed !== null ? parsed : {}
    return { frontmatter, body }
  } catch {
    // YAML 解析失败时返回空 frontmatter
    return { frontmatter: {}, body: content }
  }
}

function serializeFrontmatter(frontmatter: AgentFrontmatter, body: string): string {
  const filtered: Record<string, any> = {}
  for (const key of Object.keys(frontmatter)) {
    if (frontmatter[key] !== undefined && frontmatter[key] !== null) {
      filtered[key] = frontmatter[key]
    }
  }
  if (Object.keys(filtered).length === 0) {
    return body
  }

  const yamlStr = YAML.stringify(filtered, { lineWidth: 0 }).trimEnd()
  return `---\n${yamlStr}\n---\n\n${body}`
}

function getAgentsDir(workingDirectory?: string): string {
  if (workingDirectory) {
    return path.join(workingDirectory, '.claude', 'agents')
  }
  return AGENTS_DIR
}

export async function getAgents(workingDirectory?: string): Promise<Agent[]> {
  const agentsDir = getAgentsDir(workingDirectory)
  await ensureDir(agentsDir)
  let files: string[]
  try {
    files = await readdir(agentsDir)
  } catch {
    return []
  }

  const agents: Agent[] = []
  for (const file of files) {
    if (!file.endsWith('.md')) continue
    try {
      const content = await readFile(path.join(agentsDir, file), 'utf-8')
      const { frontmatter, body } = parseFrontmatter(content)
      const name = frontmatter.name || file.replace(/\.md$/, '')
      agents.push({ name, filename: file, frontmatter, body })
    } catch {
      // 跳过无法读取的文件
    }
  }
  return agents
}

export async function getAgent(name: string, workingDirectory?: string): Promise<Agent | null> {
  const agentsDir = getAgentsDir(workingDirectory)
  const filename = name.endsWith('.md') ? name : `${name}.md`
  const filePath = path.join(agentsDir, filename)
  try {
    const content = await readFile(filePath, 'utf-8')
    const { frontmatter, body } = parseFrontmatter(content)
    const agentName = frontmatter.name || filename.replace(/\.md$/, '')
    return { name: agentName, filename, frontmatter, body }
  } catch {
    return null
  }
}

export async function saveAgent(name: string, frontmatter: AgentFrontmatter, body: string, workingDirectory?: string): Promise<void> {
  const agentsDir = getAgentsDir(workingDirectory)
  await ensureDir(agentsDir)
  const filename = name.endsWith('.md') ? name : `${name}.md`
  const filePath = path.join(agentsDir, filename)
  const content = serializeFrontmatter(frontmatter, body)
  await writeFile(filePath, content, 'utf-8')
}

export async function deleteAgent(name: string, workingDirectory?: string): Promise<boolean> {
  const agentsDir = getAgentsDir(workingDirectory)
  const filename = name.endsWith('.md') ? name : `${name}.md`
  const filePath = path.join(agentsDir, filename)
  try {
    await unlink(filePath)
    return true
  } catch {
    return false
  }
}

// Skills - manage .claude/skills/ directories within a project (project-level config)

export interface Skill {
  name: string
  content: string
  hasReferences: boolean
  hasScripts: boolean
}

function getSkillsDir(workingDirectory: string): string {
  return path.join(workingDirectory, '.claude', 'skills')
}

export async function getSkills(workingDirectory: string): Promise<Skill[]> {
  const skillsDir = getSkillsDir(workingDirectory)
  if (!existsSync(skillsDir)) {
    return []
  }

  let entries: string[]
  try {
    entries = await readdir(skillsDir)
  } catch {
    return []
  }

  const skills: Skill[] = []
  for (const entry of entries) {
    const entryPath = path.join(skillsDir, entry)
    try {
      const entryStat = await stat(entryPath)
      if (!entryStat.isDirectory()) continue

      const skillMdPath = path.join(entryPath, 'SKILL.md')
      let content = ''
      try {
        content = await readFile(skillMdPath, 'utf-8')
      } catch {
        // 目录存在但没有 SKILL.md，跳过
        continue
      }

      // 检查 references/ 和 scripts/ 子目录是否存在
      let hasReferences = false
      let hasScripts = false
      try {
        const refStat = await stat(path.join(entryPath, 'references'))
        hasReferences = refStat.isDirectory()
      } catch { /* 不存在 */ }
      try {
        const scriptStat = await stat(path.join(entryPath, 'scripts'))
        hasScripts = scriptStat.isDirectory()
      } catch { /* 不存在 */ }

      skills.push({ name: entry, content, hasReferences, hasScripts })
    } catch {
      // 跳过无法读取的条目
    }
  }

  return skills
}

export async function getSkill(workingDirectory: string, name: string): Promise<Skill | null> {
  const skillDir = path.join(getSkillsDir(workingDirectory), name)
  const skillMdPath = path.join(skillDir, 'SKILL.md')
  try {
    const content = await readFile(skillMdPath, 'utf-8')

    let hasReferences = false
    let hasScripts = false
    try {
      const refStat = await stat(path.join(skillDir, 'references'))
      hasReferences = refStat.isDirectory()
    } catch { /* 不存在 */ }
    try {
      const scriptStat = await stat(path.join(skillDir, 'scripts'))
      hasScripts = scriptStat.isDirectory()
    } catch { /* 不存在 */ }

    return { name, content, hasReferences, hasScripts }
  } catch {
    return null
  }
}

export async function saveSkill(workingDirectory: string, name: string, content: string): Promise<void> {
  const skillDir = path.join(getSkillsDir(workingDirectory), name)
  await ensureDir(skillDir)
  const skillMdPath = path.join(skillDir, 'SKILL.md')
  await writeFile(skillMdPath, content, 'utf-8')
}

export async function deleteSkill(workingDirectory: string, name: string): Promise<boolean> {
  const skillDir = path.join(getSkillsDir(workingDirectory), name)
  try {
    await rm(skillDir, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}

// Rules - read/write CLAUDE.md in project root
export async function getRules(workingDirectory: string): Promise<string> {
  const rulesFile = path.join(workingDirectory, 'CLAUDE.md')
  try {
    return await readFile(rulesFile, 'utf-8')
  } catch {
    return ''
  }
}

export async function saveRules(workingDirectory: string, content: string): Promise<void> {
  const rulesFile = path.join(workingDirectory, 'CLAUDE.md')
  await writeFile(rulesFile, content, 'utf-8')
}
