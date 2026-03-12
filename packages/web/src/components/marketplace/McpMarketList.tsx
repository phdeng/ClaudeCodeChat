import { useState, useMemo } from 'react'
import {
  FolderOpen,
  Database,
  Search,
  Globe,
  MessageSquare,
  Brain,
  Code,
  Map,
  HardDrive,
  Wrench,
  Check,
  Loader2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  MCP_MARKET_ITEMS,
  MCP_CATEGORIES,
  type McpMarketItem,
  type McpCategory,
} from '@/data/mcpMarketData'

const ICON_MAP: Record<string, React.ElementType> = {
  FolderOpen,
  Database,
  Search,
  Globe,
  MessageSquare,
  Brain,
  Code,
  Wrench,
  Map,
  HardDrive,
}

interface McpMarketListProps {
  installedServers: string[]
  onInstall: (item: McpMarketItem) => Promise<void>
}

export default function McpMarketList({ installedServers, onInstall }: McpMarketListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<McpCategory>('全部')
  const [installingId, setInstallingId] = useState<string | null>(null)

  // 环境变量弹窗状态
  const [envDialogItem, setEnvDialogItem] = useState<McpMarketItem | null>(null)
  const [envValues, setEnvValues] = useState<Record<string, string>>({})

  const filteredItems = useMemo(() => {
    let items = [...MCP_MARKET_ITEMS]

    // 分类筛选
    if (activeCategory !== '全部') {
      items = items.filter((item) => item.category === activeCategory)
    }

    // 搜索筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      items = items.filter(
        (item) =>
          item.displayName.toLowerCase().includes(query) ||
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    }

    // 按 popularity 排序
    items.sort((a, b) => b.popularity - a.popularity)

    return items
  }, [searchQuery, activeCategory])

  // 检查 item 是否有需要填写的环境变量
  const getEmptyEnvKeys = (item: McpMarketItem): string[] => {
    if (!item.config.env) return []
    return Object.entries(item.config.env)
      .filter(([, value]) => value === '')
      .map(([key]) => key)
  }

  const handleInstallClick = (item: McpMarketItem) => {
    const emptyKeys = getEmptyEnvKeys(item)
    if (emptyKeys.length > 0) {
      // 需要填写环境变量，弹出表单
      const initialValues: Record<string, string> = {}
      emptyKeys.forEach((key) => {
        initialValues[key] = ''
      })
      setEnvValues(initialValues)
      setEnvDialogItem(item)
    } else {
      // 直接安装
      doInstall(item)
    }
  }

  const doInstall = async (item: McpMarketItem, customEnv?: Record<string, string>) => {
    setInstallingId(item.id)
    try {
      const finalItem = customEnv
        ? {
            ...item,
            config: {
              ...item.config,
              env: { ...item.config.env, ...customEnv },
            },
          }
        : item
      await onInstall(finalItem)
    } finally {
      setInstallingId(null)
    }
  }

  const handleEnvSubmit = () => {
    if (!envDialogItem) return
    doInstall(envDialogItem, envValues)
    setEnvDialogItem(null)
    setEnvValues({})
  }

  const handleEnvCancel = () => {
    setEnvDialogItem(null)
    setEnvValues({})
  }

  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索 MCP 服务器..."
          className="pl-9"
        />
      </div>

      {/* 分类 Tab */}
      <div className="flex flex-wrap gap-1.5">
        {MCP_CATEGORIES.map((category) => (
          <Button
            key={category}
            variant="ghost"
            size="xs"
            onClick={() => setActiveCategory(category)}
            className={cn(
              'rounded-full transition-all',
              activeCategory === category
                ? 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {category}
          </Button>
        ))}
      </div>

      {/* 卡片网格 */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          未找到匹配的 MCP 服务器
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredItems.map((item) => {
            const IconComp = ICON_MAP[item.icon] || Wrench
            const isInstalled = installedServers.includes(item.name)
            const isInstalling = installingId === item.id

            return (
              <Card
                key={item.id}
                className={cn(
                  'py-0 transition-all hover:border-muted-foreground/50',
                  isInstalled && 'opacity-70'
                )}
              >
                <CardContent className="p-4 flex flex-col gap-3">
                  {/* 头部：图标 + 名称 + 作者 */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <IconComp size={20} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {item.displayName}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {item.category}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{item.author}</span>
                    </div>
                  </div>

                  {/* 描述 */}
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {item.description}
                  </p>

                  {/* 底部：标签 + 安装按钮 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1 min-w-0">
                      {item.tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-normal"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    {isInstalled ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled
                        className="flex-shrink-0 text-muted-foreground"
                      >
                        <Check size={12} />
                        已安装
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        onClick={() => handleInstallClick(item)}
                        disabled={isInstalling}
                        className="flex-shrink-0 bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white hover:opacity-90"
                      >
                        {isInstalling ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          '安装'
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 环境变量填写弹窗 */}
      {envDialogItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleEnvCancel}
          />
          <div className="relative z-10 w-full max-w-md mx-4 rounded-lg border bg-background p-6 shadow-lg animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">
                  配置 {envDialogItem.displayName}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  请填写以下环境变量后安装
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleEnvCancel}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </Button>
            </div>

            <div className="space-y-3">
              {Object.keys(envValues).map((key) => (
                <div key={key}>
                  <label className="text-xs font-medium text-foreground mb-1.5 block font-mono">
                    {key}
                  </label>
                  <Input
                    value={envValues[key]}
                    onChange={(e) =>
                      setEnvValues((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    placeholder={`输入 ${key}`}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" size="sm" onClick={handleEnvCancel}>
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleEnvSubmit}
                disabled={Object.values(envValues).some((v) => !v.trim())}
                className="bg-gradient-to-r from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] text-white hover:opacity-90"
              >
                确认安装
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
