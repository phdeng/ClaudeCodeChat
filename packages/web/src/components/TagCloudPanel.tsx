import { useMemo, useState } from 'react'
import { Tags, X } from 'lucide-react'
import { useSessionStore } from '../stores/sessionStore'

/** 预设颜色列表 */
const TAG_COLORS = [
  '#3b82f6', '#a855f7', '#22c55e', '#f97316',
  '#ec4899', '#06b6d4', '#ef4444', '#eab308',
]

/** 根据标签名生成确定性颜色 */
function getTagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

/** 将频率映射到字体大小 (12px ~ 28px) */
function getFontSize(count: number, maxCount: number): number {
  if (maxCount <= 1) return 16
  const ratio = (count - 1) / (maxCount - 1)
  return 12 + ratio * 16
}

interface TagCloudPanelProps {
  /** 点击标签后的回调（可用于筛选会话） */
  onTagClick?: (tag: string) => void
}

/**
 * 标签云可视化面板
 * 展示所有会话标签的词云效果
 * 标签大小基于使用频率，颜色基于哈希
 */
export default function TagCloudPanel({ onTagClick }: TagCloudPanelProps) {
  const sessions = useSessionStore(s => s.sessions)
  const [expanded, setExpanded] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // 统计标签频率
  const tagStats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const session of sessions) {
      if (session.tags) {
        for (const tag of session.tags) {
          counts.set(tag, (counts.get(tag) || 0) + 1)
        }
      }
    }
    // 排序：频率高的在前
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  }, [sessions])

  const maxCount = tagStats.length > 0 ? tagStats[0].count : 0

  // 选中标签后筛选出的会话
  const filteredSessions = useMemo(() => {
    if (!selectedTag) return []
    return sessions.filter(s => s.tags?.includes(selectedTag))
  }, [sessions, selectedTag])

  if (tagStats.length === 0) return null

  return (
    <div className="border-t border-border">
      {/* 标题栏 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-foreground hover:bg-accent/30 transition-colors cursor-pointer"
      >
        <Tags size={13} />
        <span>标签云</span>
        <span className="text-[10px] opacity-50">({tagStats.length})</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {/* 词云区域 */}
          <div className="flex flex-wrap gap-1.5 items-center justify-center py-2">
            {tagStats.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => {
                  setSelectedTag(selectedTag === tag ? null : tag)
                  onTagClick?.(tag)
                }}
                className="px-1.5 py-0.5 rounded-md transition-all duration-200 cursor-pointer hover:opacity-80"
                style={{
                  fontSize: `${getFontSize(count, maxCount)}px`,
                  color: getTagColor(tag),
                  backgroundColor: selectedTag === tag ? `${getTagColor(tag)}20` : 'transparent',
                  border: selectedTag === tag ? `1px solid ${getTagColor(tag)}40` : '1px solid transparent',
                }}
                title={`${tag} (${count}个会话)`}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* 选中标签后显示关联会话列表 */}
          {selectedTag && filteredSessions.length > 0 && (
            <div className="mt-2 border-t border-border pt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted-foreground">
                  含「{selectedTag}」的会话 ({filteredSessions.length})
                </span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className="p-0.5 rounded hover:bg-accent text-muted-foreground cursor-pointer"
                >
                  <X size={10} />
                </button>
              </div>
              <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
                {filteredSessions.slice(0, 10).map(s => (
                  <div
                    key={s.id}
                    className="text-[11px] text-muted-foreground truncate px-1.5 py-0.5 rounded hover:bg-accent/30"
                  >
                    {s.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
