import { Router, type Router as RouterType } from 'express'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const router: RouterType = Router()
const isWindows = os.platform() === 'win32'

/**
 * 获取 Windows 系统中可用的盘符列表（A-Z）
 */
async function getWindowsDrives(): Promise<string[]> {
  const drives: string[] = []
  for (let i = 65; i <= 90; i++) {
    const drive = String.fromCharCode(i) + ':\\'
    try {
      await fs.access(drive)
      drives.push(drive)
    } catch { /* 盘符不存在 */ }
  }
  return drives
}

/**
 * 检查指定路径是否包含 .git 目录（即是否为 Git 仓库）
 */
async function isGitRepo(dirPath: string): Promise<boolean> {
  try {
    const gitPath = path.join(dirPath, '.git')
    const stat = await fs.stat(gitPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

/**
 * GET /api/filesystem/browse?path=<dir_path>
 * 浏览指定目录下的子目录列表。如果未指定路径，则返回用户主目录的内容。
 */
router.get('/browse', async (req, res) => {
  try {
    const rawPath = req.query.path as string | undefined
    const decodedPath = rawPath ? decodeURIComponent(rawPath) : undefined

    // Windows 盘符列表：当请求 __drives__ 或未指定路径且为 Windows 时
    if (isWindows && (decodedPath === '__drives__' || !decodedPath)) {
      // 未指定路径时默认显示用户主目录（保持向后兼容）
      // 只有显式请求 __drives__ 时才返回盘符列表
      if (decodedPath === '__drives__') {
        const drives = await getWindowsDrives()
        const directories = drives.map(d => ({
          name: d.replace('\\', ''),  // "C:" 格式显示
          path: d,
          isGitRepo: false,
        }))
        return res.json({
          current: '__drives__',
          parent: null,
          directories,
          platform: 'win32',
        })
      }
    }

    // 从查询参数获取路径，未指定则使用用户主目录
    const targetPath = decodedPath ? path.resolve(decodedPath) : os.homedir()

    // 验证目标路径是否存在且为目录
    let stat
    try {
      stat = await fs.stat(targetPath)
    } catch {
      return res.json({
        current: targetPath,
        parent: path.dirname(targetPath),
        directories: [],
        platform: isWindows ? 'win32' : 'other',
      })
    }

    if (!stat.isDirectory()) {
      return res.json({
        current: targetPath,
        parent: path.dirname(targetPath),
        directories: [],
        platform: isWindows ? 'win32' : 'other',
      })
    }

    // 读取目录内容，仅保留子目录
    const entries = await fs.readdir(targetPath, { withFileTypes: true })
    const directories: { name: string; path: string; isGitRepo: boolean }[] = []

    for (const entry of entries) {
      // 过滤隐藏目录（以 . 开头的目录）
      if (entry.name.startsWith('.')) continue
      if (!entry.isDirectory()) continue

      const fullPath = path.join(targetPath, entry.name)
      const gitRepo = await isGitRepo(fullPath)

      directories.push({
        name: entry.name,
        path: fullPath,
        isGitRepo: gitRepo,
      })
    }

    // 按名称字母顺序排序
    directories.sort((a, b) => a.name.localeCompare(b.name))

    // 计算父目录路径
    const parentDir = path.dirname(targetPath)
    // Windows 盘符根目录（如 C:\）的父目录应指向盘符列表
    let parentPath: string | null
    if (isWindows && /^[a-zA-Z]:\\$/.test(targetPath)) {
      parentPath = '__drives__'
    } else {
      parentPath = parentDir !== targetPath ? parentDir : null
    }

    res.json({
      current: targetPath,
      parent: parentPath,
      directories,
      platform: isWindows ? 'win32' : 'other',
    })
  } catch (err) {
    console.error('文件系统浏览失败:', err)
    res.status(500).json({ error: 'Failed to browse directory' })
  }
})

/**
 * GET /api/filesystem/files?path=<dir_path>&query=<search_filter>
 * 列出指定目录下的文件和子目录。如果未指定路径，则使用当前工作目录或用户主目录。
 * - 过滤隐藏文件/目录（以 . 开头）
 * - 如果提供 query 参数，对名称进行大小写不敏感的模糊匹配
 * - 结果限制为 50 条，目录排在前面，各组内按字母排序
 */
router.get('/files', async (req, res) => {
  try {
    const rawPath = req.query.path as string | undefined
    const query = req.query.query as string | undefined
    const targetPath = rawPath ? path.resolve(decodeURIComponent(rawPath)) : (process.cwd() || os.homedir())

    // 验证目标路径是否存在且为目录
    let stat
    try {
      stat = await fs.stat(targetPath)
    } catch {
      return res.json({
        current: targetPath,
        parent: path.dirname(targetPath),
        entries: [],
      })
    }

    if (!stat.isDirectory()) {
      return res.json({
        current: targetPath,
        parent: path.dirname(targetPath),
        entries: [],
      })
    }

    // 读取目录内容
    const dirEntries = await fs.readdir(targetPath, { withFileTypes: true })

    const directories: { name: string; path: string; type: 'directory' }[] = []
    const files: { name: string; path: string; type: 'file'; size: number; extension: string }[] = []

    const queryLower = query?.toLowerCase()

    for (const entry of dirEntries) {
      // 过滤隐藏文件/目录
      if (entry.name.startsWith('.')) continue

      // 如果提供了查询参数，进行模糊匹配（大小写不敏感）
      if (queryLower && !entry.name.toLowerCase().includes(queryLower)) continue

      const fullPath = path.join(targetPath, entry.name)

      if (entry.isDirectory()) {
        directories.push({
          name: entry.name,
          path: fullPath,
          type: 'directory',
        })
      } else if (entry.isFile()) {
        try {
          const fileStat = await fs.stat(fullPath)
          const ext = path.extname(entry.name)
          files.push({
            name: entry.name,
            path: fullPath,
            type: 'file',
            size: fileStat.size,
            extension: ext,
          })
        } catch {
          // 无法读取文件信息，跳过
        }
      }
    }

    // 各组内按名称字母排序
    directories.sort((a, b) => a.name.localeCompare(b.name))
    files.sort((a, b) => a.name.localeCompare(b.name))

    // 目录排在前面，然后是文件，限制 50 条
    const entries = [...directories, ...files].slice(0, 50)

    // 计算父目录路径
    const parentPath = path.dirname(targetPath)

    res.json({
      current: targetPath,
      parent: parentPath !== targetPath ? parentPath : null,
      entries,
    })
  } catch (err) {
    console.error('文件列表获取失败:', err)
    res.status(500).json({ error: 'Failed to list files' })
  }
})

/**
 * GET /api/filesystem/validate?path=<dir_path>
 * 验证指定路径是否存在且为目录，并检查是否为 Git 仓库。
 */
router.get('/validate', async (req, res) => {
  try {
    const rawPath = req.query.path as string | undefined
    if (!rawPath) {
      return res.json({ valid: false, path: null, isGitRepo: false })
    }

    const targetPath = path.resolve(decodeURIComponent(rawPath))

    let stat
    try {
      stat = await fs.stat(targetPath)
    } catch {
      return res.json({ valid: false, path: targetPath, isGitRepo: false })
    }

    if (!stat.isDirectory()) {
      return res.json({ valid: false, path: targetPath, isGitRepo: false })
    }

    const gitRepo = await isGitRepo(targetPath)

    res.json({
      valid: true,
      path: targetPath,
      isGitRepo: gitRepo,
    })
  } catch (err) {
    console.error('路径验证失败:', err)
    res.status(500).json({ error: 'Failed to validate path' })
  }
})

/**
 * GET /api/filesystem/git-info?path=<dir_path>
 * 返回指定目录的 Git 仓库信息：当前分支、状态、是否有未提交更改。
 */
router.get('/git-info', async (req, res) => {
  try {
    const rawPath = req.query.path as string | undefined
    if (!rawPath) {
      return res.json({ branch: null, status: '', hasChanges: false })
    }

    const targetPath = path.resolve(decodeURIComponent(rawPath))

    // 先检查是否为 Git 仓库
    const gitRepo = await isGitRepo(targetPath)
    if (!gitRepo) {
      return res.json({ branch: null, status: '', hasChanges: false })
    }

    // 获取当前分支名
    let branch = ''
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: targetPath,
        timeout: 5000,
      })
      branch = stdout.trim()
    } catch {
      branch = 'unknown'
    }

    // 获取 git status 简短格式
    let status = ''
    let hasChanges = false
    try {
      const { stdout } = await execFileAsync('git', ['status', '--short'], {
        cwd: targetPath,
        timeout: 5000,
      })
      status = stdout.trim()
      hasChanges = status.length > 0
    } catch {
      // status 获取失败不影响整体
    }

    res.json({
      branch,
      status,
      hasChanges,
    })
  } catch (err) {
    console.error('获取 Git 信息失败:', err)
    res.status(500).json({ error: 'Failed to get git info' })
  }
})

/**
 * GET /api/filesystem/tree?path=<dir_path>&depth=<max_depth>
 * 返回指定目录的文件树结构（递归），最多 depth 层深度。
 * 排除 node_modules, .git, dist, build, __pycache__, .next, .cache 等目录。
 */
router.get('/tree', async (req, res) => {
  try {
    const rawPath = req.query.path as string | undefined
    const depthStr = req.query.depth as string | undefined
    const maxDepth = Math.min(parseInt(depthStr || '2', 10), 4)  // 最多 4 层

    if (!rawPath) {
      return res.json({ tree: '', path: null })
    }

    const targetPath = path.resolve(decodeURIComponent(rawPath))

    // 验证目标路径是否存在且为目录
    let stat
    try {
      stat = await fs.stat(targetPath)
    } catch {
      return res.json({ tree: '目录不存在', path: targetPath })
    }

    if (!stat.isDirectory()) {
      return res.json({ tree: '路径不是目录', path: targetPath })
    }

    // 需要排除的目录名称
    const EXCLUDED_DIRS = new Set([
      'node_modules', '.git', 'dist', 'build', '__pycache__',
      '.next', '.cache', '.vscode', '.idea', 'coverage',
      '.turbo', '.output', '.nuxt', '.svelte-kit',
    ])

    // 递归构建目录树
    const lines: string[] = []
    let entryCount = 0
    const MAX_ENTRIES = 200  // 限制条目数量

    async function buildTree(dirPath: string, prefix: string, depth: number) {
      if (depth > maxDepth || entryCount >= MAX_ENTRIES) return

      let entries
      try {
        entries = await fs.readdir(dirPath, { withFileTypes: true })
      } catch {
        return
      }

      // 过滤并排序：目录在前，文件在后，各自按名称排序
      const filtered = entries.filter(e => {
        if (e.name.startsWith('.') && EXCLUDED_DIRS.has(e.name)) return false
        if (e.isDirectory() && EXCLUDED_DIRS.has(e.name)) return false
        return true
      })

      const dirs = filtered.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))
      const files = filtered.filter(e => !e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))
      const sorted = [...dirs, ...files]

      for (let i = 0; i < sorted.length; i++) {
        if (entryCount >= MAX_ENTRIES) {
          lines.push(`${prefix}... (已达到 ${MAX_ENTRIES} 条限制)`)
          break
        }

        const entry = sorted[i]
        const isLast = i === sorted.length - 1
        const connector = isLast ? '\u2514\u2500\u2500 ' : '\u251C\u2500\u2500 '
        const childPrefix = isLast ? '    ' : '\u2502   '

        if (entry.isDirectory()) {
          lines.push(`${prefix}${connector}${entry.name}/`)
          entryCount++
          await buildTree(path.join(dirPath, entry.name), prefix + childPrefix, depth + 1)
        } else {
          lines.push(`${prefix}${connector}${entry.name}`)
          entryCount++
        }
      }
    }

    const dirName = path.basename(targetPath)
    lines.push(`${dirName}/`)
    entryCount++
    await buildTree(targetPath, '', 1)

    res.json({
      tree: lines.join('\n'),
      path: targetPath,
      entryCount,
    })
  } catch (err) {
    console.error('目录树生成失败:', err)
    res.status(500).json({ error: 'Failed to generate directory tree' })
  }
})

/**
 * GET /api/filesystem/git-status?path=<dir_path>
 * 返回指定目录的详细 Git 状态信息（分支、最近提交、更改文件列表）。
 */
router.get('/git-status', async (req, res) => {
  try {
    const rawPath = req.query.path as string | undefined
    if (!rawPath) {
      return res.json({ isGitRepo: false, info: '未指定项目路径' })
    }

    const targetPath = path.resolve(decodeURIComponent(rawPath))

    // 检查是否为 Git 仓库
    const gitRepo = await isGitRepo(targetPath)
    if (!gitRepo) {
      return res.json({ isGitRepo: false, info: '当前目录不是 Git 仓库' })
    }

    const execOpts = { cwd: targetPath, timeout: 5000 }
    const results: Record<string, string> = {}

    // 获取当前分支
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], execOpts)
      results.branch = stdout.trim()
    } catch {
      results.branch = 'unknown'
    }

    // 获取最近 3 条提交日志
    try {
      const { stdout } = await execFileAsync('git', [
        'log', '--oneline', '-3', '--format=%h %s (%cr)'
      ], execOpts)
      results.recentCommits = stdout.trim()
    } catch {
      results.recentCommits = ''
    }

    // 获取工作区状态
    try {
      const { stdout } = await execFileAsync('git', ['status', '--short'], execOpts)
      results.status = stdout.trim()
    } catch {
      results.status = ''
    }

    // 获取未推送的提交数
    try {
      const { stdout } = await execFileAsync('git', [
        'rev-list', '--count', `origin/${results.branch}..HEAD`
      ], execOpts)
      results.unpushed = stdout.trim()
    } catch {
      results.unpushed = '0'
    }

    // 格式化输出
    const lines: string[] = []
    lines.push(`Git 状态: ${targetPath}`)
    lines.push(`分支: ${results.branch}`)

    if (results.unpushed && results.unpushed !== '0') {
      lines.push(`未推送提交: ${results.unpushed} 个`)
    }

    if (results.status) {
      const changedFiles = results.status.split('\n').length
      lines.push(`工作区变更: ${changedFiles} 个文件`)
      lines.push('')
      lines.push('变更文件:')
      lines.push(results.status)
    } else {
      lines.push('工作区: 干净')
    }

    if (results.recentCommits) {
      lines.push('')
      lines.push('最近提交:')
      lines.push(results.recentCommits)
    }

    res.json({
      isGitRepo: true,
      branch: results.branch,
      hasChanges: !!results.status,
      unpushed: parseInt(results.unpushed || '0', 10),
      info: lines.join('\n'),
    })
  } catch (err) {
    console.error('获取 Git 状态失败:', err)
    res.status(500).json({ error: 'Failed to get git status' })
  }
})

export default router
