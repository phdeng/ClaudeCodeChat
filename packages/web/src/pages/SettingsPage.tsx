import { useState } from 'react'
import { ArrowLeft, Server, Webhook, Puzzle, Users, ChevronRight, SlidersHorizontal, Globe, FolderOpen, FileText, BarChart3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import McpServersPanel from '../components/settings/McpServersPanel'
import HooksPanel from '../components/settings/HooksPanel'
import GeneralSettingsPanel from '../components/settings/GeneralSettingsPanel'
import SubagentPanel from '../components/settings/SubagentPanel'
import SkillsPanel from '../components/settings/SkillsPanel'
import RulesPanel from '../components/settings/RulesPanel'
import UsageStatsPanel from '../components/settings/UsageStatsPanel'
import { useSessionStore } from '../stores/sessionStore'
import { useTranslation } from '../i18n'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type Scope = 'global' | 'project'

const TAB_DEFS = [
  { id: 'general', labelKey: 'settings.general' as const, icon: SlidersHorizontal, scopes: ['global', 'project'] as Scope[] },
  { id: 'mcp', labelKey: 'settings.mcp' as const, icon: Server, scopes: ['global', 'project'] as Scope[] },
  { id: 'hooks', labelKey: 'settings.hooks' as const, icon: Webhook, scopes: ['global', 'project'] as Scope[] },
  { id: 'skills', labelKey: 'settings.skills' as const, icon: Puzzle, scopes: ['project'] as Scope[] },
  { id: 'subagent', labelKey: 'settings.subagent' as const, icon: Users, scopes: ['global', 'project'] as Scope[] },
  { id: 'rules', labelKey: 'settings.rules' as const, icon: FileText, scopes: ['project'] as Scope[] },
  { id: 'usage', labelKey: 'settings.usage' as const, icon: BarChart3, scopes: ['global', 'project'] as Scope[] },
] as const

type TabId = typeof TAB_DEFS[number]['id']

export default function SettingsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [scope, setScope] = useState<Scope>('global')
  const { sessions, activeSessionId } = useSessionStore()
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const workingDirectory = activeSession?.workingDirectory

  const activeTabDef = TAB_DEFS.find(tab => tab.id === activeTab)
  const activeTabLabel = activeTabDef ? t(activeTabDef.labelKey) : ''

  // 当前 scope 下可用的 tabs
  const visibleTabs = TAB_DEFS.filter(tab => tab.scopes.includes(scope))

  // 切换 scope 时，如果当前 tab 不可用，自动切换到第一个可用 tab
  const handleScopeChange = (newScope: Scope) => {
    setScope(newScope)
    const currentTabDef = TAB_DEFS.find(tab => tab.id === activeTab)
    if (currentTabDef && !currentTabDef.scopes.includes(newScope)) {
      const firstAvailable = TAB_DEFS.find(tab => tab.scopes.includes(newScope))
      if (firstAvailable) {
        setActiveTab(firstAvailable.id)
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-xl text-foreground"
          >
            <ArrowLeft size={18} />
          </Button>
          <nav className="flex items-center gap-1.5 text-sm">
            <span
              className="text-foreground cursor-pointer transition-colors"
              onClick={() => navigate(-1)}
            >
              {t('settings.title')}
            </span>
            <ChevronRight size={14} className="text-muted-foreground opacity-50" />
            <span className="text-foreground font-medium">
              {activeTabLabel}
            </span>
          </nav>
        </div>
      </header>

      <Separator />

      {/* Scope 切换器 */}
      <div className="px-5 pt-3">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleScopeChange('global')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl transition-all text-sm',
              scope === 'global'
                ? 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'
                : 'text-foreground hover:bg-accent'
            )}
          >
            <Globe size={14} />
            {t('settings.global')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleScopeChange('project')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl transition-all text-sm',
              scope === 'project'
                ? 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'
                : 'text-foreground hover:bg-accent'
            )}
          >
            <FolderOpen size={14} />
            {t('settings.project')}
          </Button>
          {scope === 'project' && workingDirectory && (
            <span className="text-xs text-muted-foreground ml-2 truncate max-w-[300px]" title={workingDirectory}>
              {workingDirectory}
            </span>
          )}
          {scope === 'project' && !workingDirectory && (
            <span className="text-xs text-amber-400/80 ml-2">
              {t('chat.selectProjectFirst')}
            </span>
          )}
        </div>
      </div>

      <div className="pt-2 pb-0 px-5">
        <div className="max-w-3xl mx-auto flex gap-1">
          {visibleTabs.map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 rounded-xl transition-all',
                activeTab === tab.id
                  ? 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'
                  : 'text-foreground hover:bg-accent'
              )}
            >
              <tab.icon size={15} />
              {t(tab.labelKey)}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-3xl mx-auto animate-fade-in" key={`${scope}-${activeTab}`}>
          {activeTab === 'general' && <GeneralSettingsPanel scope={scope} workingDirectory={workingDirectory} />}
          {activeTab === 'mcp' && <McpServersPanel scope={scope} workingDirectory={workingDirectory} />}
          {activeTab === 'hooks' && <HooksPanel scope={scope} workingDirectory={workingDirectory} />}
          {activeTab === 'skills' && <SkillsPanel workingDirectory={workingDirectory} />}
          {activeTab === 'subagent' && <SubagentPanel scope={scope} workingDirectory={workingDirectory} />}
          {activeTab === 'rules' && <RulesPanel workingDirectory={workingDirectory} />}
          {activeTab === 'usage' && <UsageStatsPanel />}
        </div>
      </div>
    </div>
  )
}
