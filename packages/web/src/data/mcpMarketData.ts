export interface McpMarketItem {
  id: string
  name: string
  displayName: string
  description: string
  category: string
  icon: string
  author: string
  config: {
    command: string
    args: string[]
    env?: Record<string, string>
  }
  tags: string[]
  popularity: number
}

export const MCP_CATEGORIES = [
  '全部',
  '文件系统',
  '数据库',
  '搜索',
  '开发工具',
  '通信',
  'AI增强',
] as const

export type McpCategory = (typeof MCP_CATEGORIES)[number]

export const MCP_MARKET_ITEMS: McpMarketItem[] = [
  {
    id: 'filesystem',
    name: 'filesystem',
    displayName: 'Filesystem',
    description: '安全的文件系统访问，支持读写文件、创建目录、搜索文件等操作',
    category: '文件系统',
    icon: 'FolderOpen',
    author: 'Anthropic',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path'],
    },
    tags: ['文件', '目录', '读写'],
    popularity: 100,
  },
  {
    id: 'github',
    name: 'github',
    displayName: 'GitHub',
    description: 'GitHub API 集成，管理仓库、Issue、PR、代码搜索等功能',
    category: '开发工具',
    icon: 'Code',
    author: 'Anthropic',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
    },
    tags: ['Git', 'API', '代码管理'],
    popularity: 95,
  },
  {
    id: 'postgres',
    name: 'postgres',
    displayName: 'PostgreSQL',
    description: 'PostgreSQL 数据库连接，执行查询、管理表结构和数据',
    category: '数据库',
    icon: 'Database',
    author: 'Anthropic',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      env: { POSTGRES_CONNECTION_STRING: '' },
    },
    tags: ['SQL', '数据库', '查询'],
    popularity: 90,
  },
  {
    id: 'brave-search',
    name: 'brave-search',
    displayName: 'Brave Search',
    description: 'Brave 搜索引擎集成，支持网页搜索和本地搜索',
    category: '搜索',
    icon: 'Search',
    author: 'Anthropic',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: { BRAVE_API_KEY: '' },
    },
    tags: ['搜索', '网页', 'API'],
    popularity: 88,
  },
  {
    id: 'sqlite',
    name: 'sqlite',
    displayName: 'SQLite',
    description: 'SQLite 轻量级数据库，支持本地数据存储和查询',
    category: '数据库',
    icon: 'Database',
    author: 'Anthropic',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', './data.db'],
    },
    tags: ['SQL', '数据库', '轻量'],
    popularity: 85,
  },
  {
    id: 'puppeteer',
    name: 'puppeteer',
    displayName: 'Puppeteer',
    description: '浏览器自动化工具，支持网页截图、表单填写、页面操作',
    category: '开发工具',
    icon: 'Globe',
    author: 'Anthropic',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    },
    tags: ['浏览器', '自动化', '截图'],
    popularity: 82,
  },
  {
    id: 'memory',
    name: 'memory',
    displayName: 'Memory',
    description: '基于知识图谱的持久记忆系统，帮助 AI 记住重要信息',
    category: 'AI增强',
    icon: 'Brain',
    author: 'Anthropic',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    },
    tags: ['记忆', '知识图谱', '持久化'],
    popularity: 80,
  },
  {
    id: 'slack',
    name: 'slack',
    displayName: 'Slack',
    description: 'Slack 工作空间集成，发送消息、管理频道、搜索历史',
    category: '通信',
    icon: 'MessageSquare',
    author: 'Anthropic',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
      env: { SLACK_BOT_TOKEN: '', SLACK_TEAM_ID: '' },
    },
    tags: ['消息', '团队', '协作'],
    popularity: 78,
  },
  {
    id: 'sequential-thinking',
    name: 'sequential-thinking',
    displayName: 'Sequential Thinking',
    description: '增强 AI 的逐步推理能力，适合复杂问题分析和规划',
    category: 'AI增强',
    icon: 'Brain',
    author: 'Anthropic',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    },
    tags: ['推理', '分析', '规划'],
    popularity: 77,
  },
  {
    id: 'fetch',
    name: 'fetch',
    displayName: 'Fetch',
    description: 'HTTP 请求工具，获取网页内容并转换为 Markdown 格式',
    category: '开发工具',
    icon: 'Globe',
    author: 'Anthropic',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
    },
    tags: ['HTTP', '网页', '抓取'],
    popularity: 75,
  },
  {
    id: 'google-maps',
    name: 'google-maps',
    displayName: 'Google Maps',
    description: 'Google Maps API 集成，支持地理编码、路线规划、地点搜索',
    category: '搜索',
    icon: 'Map',
    author: 'Anthropic',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-google-maps'],
      env: { GOOGLE_MAPS_API_KEY: '' },
    },
    tags: ['地图', '位置', '导航'],
    popularity: 70,
  },
  {
    id: 'everything',
    name: 'everything',
    displayName: 'Everything',
    description: 'Windows 桌面文件极速搜索，基于 Everything 搜索引擎',
    category: '搜索',
    icon: 'HardDrive',
    author: 'Anthropic',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
    },
    tags: ['搜索', 'Windows', '文件'],
    popularity: 65,
  },
]
