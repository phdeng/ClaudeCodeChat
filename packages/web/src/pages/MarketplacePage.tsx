import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plug, Puzzle } from 'lucide-react'
import { toast } from 'sonner'
import { useSessionStore } from '../stores/sessionStore'
import { useTranslation } from '../i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import SkillMarketList from '../components/marketplace/SkillMarketList'
import type { SkillMarketItem } from '../data/skillMarketData'
import type { McpMarketItem } from '../data/mcpMarketData'
import { MCP_MARKET_ITEMS, MCP_CATEGORIES } from '../data/mcpMarketData'

/** 轻量 MCP 市场列表（内联实现，避免循环依赖） */
function McpMarketListInline({
  installedMcpNames,
  onInstall,
}: {
  installedMcpNames: string[]
  onInstall: (item: McpMarketItem) => Promise<void>
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('全部')
  const [installingId, setInstallingId] = useState<string | null>(null)

  const filtered = MCP_MARKET_ITEMS.filter((item) => {
    const matchCat = category === '全部' || item.category === category
    if (!matchCat) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      item.displayName.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  }).sort((a, b) => b.popularity - a.popularity)

  const handleInstall = async (item: McpMarketItem) => {
    setInstallingId(item.id)
    try {
      await onInstall(item)
    } finally {
      setInstallingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="relative flex-shrink-0">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('marketplace.search' as any)}
          className="w-full h-8 pl-8 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Plug size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      <div className="flex flex-wrap gap-1.5 flex-shrink-0">
        {MCP_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              category === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
          {filtered.map((item) => {
            const isInstalled = installedMcpNames.includes(item.name)
            const isInstalling = installingId === item.id
            return (
              <div
                key={item.id}
                className="rounded-xl border bg-card p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Plug size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm leading-tight truncate">{item.displayName}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {t('marketplace.by' as any)} {item.author}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>
                <div className="flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center rounded-full bg-secondary px-1.5 py-0 text-[10px] font-medium text-secondary-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-end mt-auto pt-1">
                  {isInstalled ? (
                    <Button variant="secondary" size="sm" className="h-7 text-xs px-3" disabled>
                      {t('marketplace.installed' as any)}
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs px-3"
                      disabled={isInstalling}
                      onClick={() => handleInstall(item)}
                    >
                      {isInstalling ? t('marketplace.installing' as any) : t('marketplace.install' as any)}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-12">
              {t('commandPalette.noResults' as any)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const workingDirectory = activeSession?.workingDirectory

  const [activeTab, setActiveTab] = useState<'mcp' | 'skill'>('mcp')
  const [installedMcpNames, setInstalledMcpNames] = useState<string[]>([])
  const [installedSkills, setInstalledSkills] = useState<string[]>([])

  // 获取已安装的 MCP 列表
  const fetchInstalledMcp = useCallback(async () => {
    try {
      const res = await fetch('/api/config/mcp-servers')
      if (res.ok) {
        const data = await res.json()
        // data 是一个对象，key 就是 MCP 名称
        setInstalledMcpNames(Object.keys(data || {}))
      }
    } catch {
      // 静默失败
    }
  }, [])

  // 获取已安装的 Skill 列表
  const fetchInstalledSkills = useCallback(async () => {
    if (!workingDirectory) {
      setInstalledSkills([])
      return
    }
    try {
      const res = await fetch(`/api/config/skills?workingDirectory=${encodeURIComponent(workingDirectory)}`)
      if (res.ok) {
        const data = await res.json()
        // data 是数组 [{ name, content }] 或对象
        if (Array.isArray(data)) {
          setInstalledSkills(data.map((s: { name: string }) => s.name))
        } else {
          setInstalledSkills(Object.keys(data || {}))
        }
      }
    } catch {
      // 静默失败
    }
  }, [workingDirectory])

  useEffect(() => {
    fetchInstalledMcp()
  }, [fetchInstalledMcp])

  useEffect(() => {
    fetchInstalledSkills()
  }, [fetchInstalledSkills])

  // 安装 MCP
  const handleInstallMcp = async (item: McpMarketItem) => {
    try {
      const res = await fetch('/api/config/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: item.name, config: item.config }),
      })
      if (!res.ok) throw new Error('Install failed')
      toast.success(t('marketplace.installSuccess' as any))
      await fetchInstalledMcp()
    } catch {
      toast.error(t('sidebar.requestFailed' as any))
    }
  }

  // 安装 Skill
  const handleInstallSkill = async (item: SkillMarketItem) => {
    if (!workingDirectory) {
      toast.error(t('marketplace.selectProjectFirst' as any))
      return
    }
    try {
      const res = await fetch('/api/config/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          content: item.skillMd,
          workingDirectory,
        }),
      })
      if (!res.ok) throw new Error('Install failed')
      toast.success(t('marketplace.installSuccess' as any))
      await fetchInstalledSkills()
    } catch {
      toast.error(t('sidebar.requestFailed' as any))
    }
  }

  const tabs = [
    { key: 'mcp' as const, label: t('marketplace.mcpTab' as any), icon: Plug },
    { key: 'skill' as const, label: t('marketplace.skillTab' as any), icon: Puzzle },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* 顶部标题栏 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} />
        </Button>
        <h1 className="text-base font-semibold">{t('marketplace.title' as any)}</h1>
      </div>

      {/* Tab 栏 */}
      <div className="flex gap-1 px-4 pt-3 pb-1 flex-shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden px-4 py-3">
        {activeTab === 'mcp' ? (
          <McpMarketListInline
            installedMcpNames={installedMcpNames}
            onInstall={handleInstallMcp}
          />
        ) : (
          <SkillMarketList
            workingDirectory={workingDirectory}
            installedSkills={installedSkills}
            onInstall={handleInstallSkill}
          />
        )}
      </div>
    </div>
  )
}
