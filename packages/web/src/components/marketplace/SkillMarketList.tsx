import { useState } from 'react'
import {
  Search, SearchCheck, GitCommitHorizontal, FlaskConical, Route, FileText,
  ShieldCheck, Wrench, Gauge, ChevronDown, ChevronUp, Loader2, Check,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTranslation } from '../../i18n'
import {
  SKILL_MARKET_ITEMS,
  SKILL_CATEGORIES,
  type SkillMarketItem,
} from '../../data/skillMarketData'

/** lucide 图标名 → 组件映射 */
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  SearchCheck,
  GitCommitHorizontal,
  FlaskConical,
  Route,
  FileText,
  ShieldCheck,
  Wrench,
  Gauge,
}

interface SkillMarketListProps {
  workingDirectory?: string
  installedSkills: string[]
  onInstall: (item: SkillMarketItem) => Promise<void>
}

export default function SkillMarketList({
  workingDirectory,
  installedSkills,
  onInstall,
}: SkillMarketListProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('全部')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [installingId, setInstallingId] = useState<string | null>(null)

  // 筛选
  const filtered = SKILL_MARKET_ITEMS.filter((item) => {
    const matchCategory = activeCategory === '全部' || item.category === activeCategory
    if (!matchCategory) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      item.displayName.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  }).sort((a, b) => b.popularity - a.popularity)

  const handleInstall = async (item: SkillMarketItem) => {
    setInstallingId(item.id)
    try {
      await onInstall(item)
    } finally {
      setInstallingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* 搜索框 */}
      <div className="relative flex-shrink-0">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('marketplace.search' as any)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* 分类 Tab */}
      <div className="flex flex-wrap gap-1.5 flex-shrink-0">
        {SKILL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 卡片网格 */}
      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
          {filtered.map((item) => {
            const IconComp = ICON_MAP[item.icon] || SearchCheck
            const isInstalled = installedSkills.includes(item.name)
            const isInstalling = installingId === item.id
            const isExpanded = expandedId === item.id
            const noProject = !workingDirectory

            return (
              <Card
                key={item.id}
                className="p-4 gap-2 flex flex-col transition-shadow hover:shadow-md"
              >
                {/* 头部：图标 + 名称 + 作者 */}
                <div className="flex items-start gap-2.5">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <IconComp size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm leading-tight truncate">{item.displayName}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {t('marketplace.by' as any)} {item.author}
                    </div>
                  </div>
                </div>

                {/* 描述 */}
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {item.description}
                </p>

                {/* 标签 */}
                <div className="flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* 预览展开区域 */}
                {isExpanded && (
                  <div className="border rounded-lg p-3 bg-muted/30 max-h-64 overflow-y-auto">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {item.skillMd}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* 底部操作 */}
                <div className="flex items-center gap-2 mt-auto pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp size={12} className="mr-1" />
                        {t('common.close')}
                      </>
                    ) : (
                      <>
                        <ChevronDown size={12} className="mr-1" />
                        {t('marketplace.preview' as any)}
                      </>
                    )}
                  </Button>

                  <div className="flex-1" />

                  {isInstalled ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs px-3"
                      disabled
                    >
                      <Check size={12} className="mr-1" />
                      {t('marketplace.installed' as any)}
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs px-3"
                      disabled={noProject || isInstalling}
                      title={noProject ? t('marketplace.selectProjectFirst' as any) : ''}
                      onClick={() => handleInstall(item)}
                    >
                      {isInstalling ? (
                        <>
                          <Loader2 size={12} className="mr-1 animate-spin" />
                          {t('marketplace.installing' as any)}
                        </>
                      ) : (
                        t('marketplace.addToProject' as any)
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}

          {filtered.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-12">
              {t('commandPalette.noResults' as any)}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
