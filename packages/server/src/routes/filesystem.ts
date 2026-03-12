import { Router, type Router as RouterType } from 'express'
import * as fs from 'fs/promises'
import { createReadStream } from 'fs'
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
 * 返回指定目录的详细 Git 状态信息：分支、ahead/behind、暂存/修改/未跟踪文件列表。
 * 使用 `git status --porcelain -b` 解析输出。
 */
router.get('/git-status', async (req, res) => {
  try {
    const rawPath = req.query.path as string | undefined
    if (!rawPath) {
      return res.json({ error: 'Not a git repository' })
    }

    const targetPath = path.resolve(decodeURIComponent(rawPath))

    // 检查是否为 Git 仓库
    const gitRepo = await isGitRepo(targetPath)
    if (!gitRepo) {
      return res.json({ error: 'Not a git repository' })
    }

    const execOpts = { cwd: targetPath, timeout: 5000 }

    // 使用 --porcelain -b 获取机器可解析的状态输出
    let porcelainOutput = ''
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain', '-b'], execOpts)
      porcelainOutput = stdout
    } catch {
      return res.json({ error: 'Failed to execute git status' })
    }

    const lines = porcelainOutput.split('\n').filter(l => l.length > 0)

    // 解析第一行分支信息：## branch...origin/branch [ahead N, behind M]
    let branch = 'unknown'
    let ahead = 0
    let behind = 0

    if (lines.length > 0 && lines[0].startsWith('## ')) {
      const branchLine = lines[0].substring(3) // 去掉 "## "
      // 解析分支名（可能包含 ...origin/branch 和 [ahead N, behind M]）
      const bracketMatch = branchLine.match(/\[(.+)\]/)
      if (bracketMatch) {
        const info = bracketMatch[1]
        const aheadMatch = info.match(/ahead (\d+)/)
        const behindMatch = info.match(/behind (\d+)/)
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10)
        if (behindMatch) behind = parseInt(behindMatch[1], 10)
      }
      // 分支名：取 ... 前的部分，或整个（去掉 [...] 部分）
      const branchPart = branchLine.replace(/\s*\[.+\]/, '')
      const dotIndex = branchPart.indexOf('...')
      branch = dotIndex >= 0 ? branchPart.substring(0, dotIndex) : branchPart
    }

    // 解析文件状态行（跳过第一行分支信息）
    const staged: { file: string; status: string }[] = []
    const modified: { file: string; status: string }[] = []
    const untracked: { file: string }[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (line.length < 4) continue // 至少 "XY file" 格式

      const indexStatus = line[0]   // 暂存区状态
      const workTreeStatus = line[1] // 工作区状态
      const fileName = line.substring(3) // 文件名（跳过 "XY "）

      // 未跟踪文件
      if (indexStatus === '?' && workTreeStatus === '?') {
        untracked.push({ file: fileName })
        continue
      }

      // 暂存区有变更
      if (indexStatus !== ' ' && indexStatus !== '?') {
        staged.push({ file: fileName, status: indexStatus })
      }

      // 工作区有变更
      if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
        modified.push({ file: fileName, status: workTreeStatus })
      }
    }

    const hasChanges = staged.length > 0 || modified.length > 0 || untracked.length > 0

    res.json({
      branch,
      ahead,
      behind,
      staged,
      modified,
      untracked,
      hasChanges,
    })
  } catch (err) {
    console.error('获取 Git 状态失败:', err)
    res.status(500).json({ error: 'Failed to get git status' })
  }
})

/**
 * GET /api/filesystem/git-diff?path=<dir_path>&file=<file_path>
 * 返回指定目录（或特定文件）的 Git diff 内容和统计信息。
 */
router.get('/git-diff', async (req, res) => {
  try {
    const rawPath = req.query.path as string | undefined
    const rawFile = req.query.file as string | undefined

    if (!rawPath) {
      return res.status(400).json({ error: '缺少 path 参数' })
    }

    // 安全检查
    const pathCheck = validatePathSecurity(rawPath)
    if (!pathCheck.valid) {
      return res.status(403).json({ error: pathCheck.error })
    }

    const targetPath = pathCheck.resolvedPath

    // 检查是否为 Git 仓库
    const gitRepo = await isGitRepo(targetPath)
    if (!gitRepo) {
      return res.json({ error: 'Not a git repository' })
    }

    const execOpts = { cwd: targetPath, timeout: 10000, maxBuffer: 5 * 1024 * 1024 }

    // 构建 git diff 命令参数
    const diffArgs = ['diff']
    const statArgs = ['diff', '--stat']

    if (rawFile) {
      // 安全检查：文件路径不能包含 ..
      const decodedFile = decodeURIComponent(rawFile)
      if (decodedFile.includes('..')) {
        return res.status(403).json({ error: '文件路径中不允许包含 ".."' })
      }
      diffArgs.push('--', decodedFile)
      statArgs.push('--', decodedFile)
    }

    // 获取 diff 内容
    let diffOutput = ''
    try {
      const { stdout } = await execFileAsync('git', diffArgs, execOpts)
      diffOutput = stdout
    } catch {
      diffOutput = ''
    }

    // 获取统计信息
    let insertions = 0
    let deletions = 0
    try {
      const { stdout } = await execFileAsync('git', statArgs, execOpts)
      // 解析 stat 输出的最后一行，格式如：
      // "3 files changed, 10 insertions(+), 3 deletions(-)"
      const statLines = stdout.trim().split('\n')
      const summaryLine = statLines[statLines.length - 1] || ''
      const insertMatch = summaryLine.match(/(\d+) insertion/)
      const deleteMatch = summaryLine.match(/(\d+) deletion/)
      if (insertMatch) insertions = parseInt(insertMatch[1], 10)
      if (deleteMatch) deletions = parseInt(deleteMatch[1], 10)
    } catch {
      // stat 获取失败不影响整体
    }

    res.json({
      diff: diffOutput,
      stats: { insertions, deletions },
    })
  } catch (err) {
    console.error('获取 Git diff 失败:', err)
    res.status(500).json({ error: 'Failed to get git diff' })
  }
})

/**
 * 文件扩展名 → 语言类型映射表
 */
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.r': 'r',
  '.scala': 'scala',
  '.dart': 'dart',
  '.lua': 'lua',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.ps1': 'powershell',
  '.bat': 'batch',
  '.cmd': 'batch',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.json': 'json',
  '.jsonc': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.proto': 'protobuf',
  '.dockerfile': 'dockerfile',
  '.tf': 'terraform',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.txt': 'plaintext',
  '.log': 'plaintext',
  '.ini': 'ini',
  '.cfg': 'ini',
  '.conf': 'ini',
  '.env': 'dotenv',
  '.gitignore': 'plaintext',
  '.dockerignore': 'plaintext',
  '.editorconfig': 'ini',
}

/**
 * 根据文件扩展名获取语言类型
 */
function getLanguageByExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  // 特殊文件名处理（无扩展名但有特定名称）
  const baseName = path.basename(filePath).toLowerCase()
  if (baseName === 'dockerfile') return 'dockerfile'
  if (baseName === 'makefile') return 'makefile'
  if (baseName === 'cmakelists.txt') return 'cmake'
  if (baseName === '.gitignore') return 'plaintext'
  if (baseName === '.env' || baseName.startsWith('.env.')) return 'dotenv'

  return EXTENSION_LANGUAGE_MAP[ext] || 'unknown'
}

/**
 * 检查文件内容是否为二进制（通过检测前 8KB 中是否包含 null 字节）
 */
function isBinaryBuffer(buffer: Buffer): boolean {
  // 检查前 8192 字节中是否有 null 字节
  const checkLength = Math.min(buffer.length, 8192)
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) return true
  }
  return false
}

/**
 * 安全路径检查：禁止路径遍历攻击
 * - 路径规范化后不能包含 ..
 * - 返回规范化后的绝对路径
 */
function validatePathSecurity(rawPath: string): { valid: boolean; resolvedPath: string; error?: string } {
  if (!rawPath || typeof rawPath !== 'string') {
    return { valid: false, resolvedPath: '', error: '路径参数不能为空' }
  }

  const decoded = decodeURIComponent(rawPath)

  // 检查原始路径中是否包含 .. 路径遍历
  if (decoded.includes('..')) {
    return { valid: false, resolvedPath: '', error: '路径中不允许包含 ".."，禁止路径遍历' }
  }

  const resolvedPath = path.resolve(decoded)
  return { valid: true, resolvedPath }
}

/**
 * GET /api/filesystem/file-info?path=<file_path>
 * 获取指定文件的详细信息：名称、大小、行数、语言类型、修改时间等。
 * - 仅对小于 1MB 的文件计算行数
 * - 通过扩展名判断语言类型
 */
router.get('/file-info', async (req, res) => {
  try {
    const rawPath = req.query.path as string | undefined
    if (!rawPath) {
      return res.status(400).json({ error: '缺少 path 参数' })
    }

    // 安全检查
    const pathCheck = validatePathSecurity(rawPath)
    if (!pathCheck.valid) {
      return res.status(403).json({ error: pathCheck.error })
    }

    const filePath = pathCheck.resolvedPath

    // 获取文件状态
    let stat
    try {
      stat = await fs.stat(filePath)
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        return res.status(404).json({ error: '文件不存在' })
      }
      if (code === 'EACCES' || code === 'EPERM') {
        return res.status(403).json({ error: '没有权限访问该文件' })
      }
      throw err
    }

    const isDirectory = stat.isDirectory()
    const fileName = path.basename(filePath)

    // 计算行数（仅对小于 1MB 的非目录文件）
    let lineCount: number | null = null
    let isReadable = true

    if (!isDirectory && stat.size <= 1024 * 1024) {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        lineCount = content.split('\n').length
      } catch {
        // 无法读取文件内容（可能是二进制或权限问题）
        isReadable = false
      }
    } else if (!isDirectory && stat.size > 1024 * 1024) {
      // 文件过大，不计算行数但仍标记为可读
      try {
        await fs.access(filePath, 4 /* fs.constants.R_OK */)
      } catch {
        isReadable = false
      }
    }

    // 获取语言类型（仅对文件有意义）
    const language = isDirectory ? 'directory' : getLanguageByExtension(filePath)

    res.json({
      name: fileName,
      path: filePath,
      size: stat.size,
      lineCount,
      language,
      lastModified: stat.mtime.toISOString(),
      isDirectory,
      isReadable,
    })
  } catch (err) {
    console.error('获取文件信息失败:', err)
    res.status(500).json({ error: '获取文件信息失败' })
  }
})

/**
 * GET /api/filesystem/read-file?path=<file_path>&maxSize=<max_bytes>
 * 读取指定文件的文本内容。
 * - 默认最大读取 100KB，超过则截断
 * - 只允许读取文本文件，二进制文件返回错误
 * - 安全检查：禁止路径遍历
 */
router.get('/read-file', async (req, res) => {
  try {
    const rawPath = req.query.path as string | undefined
    const maxSizeStr = req.query.maxSize as string | undefined
    const maxSize = Math.min(parseInt(maxSizeStr || '100000', 10) || 100000, 5 * 1024 * 1024) // 最大 5MB

    if (!rawPath) {
      return res.status(400).json({ error: '缺少 path 参数' })
    }

    // 安全检查
    const pathCheck = validatePathSecurity(rawPath)
    if (!pathCheck.valid) {
      return res.status(403).json({ error: pathCheck.error })
    }

    const filePath = pathCheck.resolvedPath

    // 获取文件状态
    let stat
    try {
      stat = await fs.stat(filePath)
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        return res.status(404).json({ error: '文件不存在' })
      }
      if (code === 'EACCES' || code === 'EPERM') {
        return res.status(403).json({ error: '没有权限访问该文件' })
      }
      throw err
    }

    // 不允许读取目录
    if (stat.isDirectory()) {
      return res.status(400).json({ error: '该路径是一个目录，无法读取文件内容' })
    }

    const totalSize = stat.size

    // 读取文件内容（如果文件很大，只读取 maxSize 字节判断是否为二进制）
    const readSize = Math.min(totalSize, maxSize)

    // 读取文件的 buffer 用于二进制检测
    const fileHandle = await fs.open(filePath, 'r')
    try {
      // 先读取前 8KB 检测是否为二进制文件
      const detectSize = Math.min(totalSize, 8192)
      const detectBuffer = Buffer.alloc(detectSize)
      await fileHandle.read(detectBuffer, 0, detectSize, 0)

      if (isBinaryBuffer(detectBuffer)) {
        return res.status(400).json({
          error: '该文件为二进制文件，无法以文本方式读取',
          totalSize,
        })
      }

      // 读取实际内容
      const contentBuffer = Buffer.alloc(readSize)
      await fileHandle.read(contentBuffer, 0, readSize, 0)
      const content = contentBuffer.toString('utf-8')
      const truncated = totalSize > maxSize
      const lineCount = content.split('\n').length

      res.json({
        content,
        truncated,
        totalSize,
        lineCount,
      })
    } finally {
      await fileHandle.close()
    }
  } catch (err) {
    console.error('读取文件内容失败:', err)
    res.status(500).json({ error: '读取文件内容失败' })
  }
})

/**
 * GET /api/filesystem/raw?path=<file_path>
 * 以原始二进制流返回文件内容，用于浏览器直接预览（PDF、图片等）。
 * - 设置正确的 Content-Type
 * - 安全检查：禁止路径遍历
 * - 最大文件大小限制：50MB
 */
router.get('/raw', async (req, res) => {
  try {
    const rawPath = req.query.path as string | undefined
    if (!rawPath) {
      return res.status(400).json({ error: '缺少 path 参数' })
    }

    // 安全检查
    const pathCheck = validatePathSecurity(rawPath)
    if (!pathCheck.valid) {
      return res.status(403).json({ error: pathCheck.error })
    }

    const filePath = pathCheck.resolvedPath

    // 获取文件状态
    let stat
    try {
      stat = await fs.stat(filePath)
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        return res.status(404).json({ error: '文件不存在' })
      }
      throw err
    }

    if (stat.isDirectory()) {
      return res.status(400).json({ error: '该路径是目录' })
    }

    // 限制 50MB
    if (stat.size > 50 * 1024 * 1024) {
      return res.status(413).json({ error: '文件过大（>50MB）' })
    }

    // MIME 类型映射
    const ext = path.extname(filePath).toLowerCase()
    const MIME_MAP: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.bmp': 'image/bmp',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.doc': 'application/msword',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
    }

    const contentType = MIME_MAP[ext] || 'application/octet-stream'

    // 使用 createReadStream 流式传输
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', stat.size)
    // 内联显示（不强制下载）
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`)

    const stream = createReadStream(filePath)
    stream.pipe(res)
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ error: '读取文件失败' })
      }
    })
  } catch (err) {
    console.error('原始文件读取失败:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: '读取文件失败' })
    }
  }
})

export default router
