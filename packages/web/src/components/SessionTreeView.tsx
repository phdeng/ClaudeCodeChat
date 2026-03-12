import { useMemo } from 'react'
import { GitBranch, MessageSquare, Clock } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useSessionStore, type Session } from '@/stores/sessionStore'

interface SessionTreeViewProps {
  sessionId: string
  open: boolean
  onClose: () => void
  onNavigate: (sessionId: string) => void
}

interface TreeNode {
  session: Session
  children: TreeNode[]
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '...'
}

/**
 * 从当前会话向上查找根节点（没有 parentSessionId 或 parent 不存在的祖先）
 */
function findRoot(sessionId: string, sessionsMap: Map<string, Session>): Session | null {
  let current = sessionsMap.get(sessionId)
  if (!current) return null

  const visited = new Set<string>()
  while (current?.parentSessionId && sessionsMap.has(current.parentSessionId)) {
    if (visited.has(current.id)) break // 防止循环引用
    visited.add(current.id)
    current = sessionsMap.get(current.parentSessionId)!
  }
  return current
}

/**
 * 从根节点递归构建树（通过 parentSessionId 查找 children）
 */
function buildTree(root: Session, childrenMap: Map<string, Session[]>): TreeNode {
  const children = childrenMap.get(root.id) || []
  return {
    session: root,
    children: children
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((child) => buildTree(child, childrenMap)),
  }
}

function TreeNodeComponent({
  node,
  depth,
  isLast,
  currentSessionId,
  onNavigate,
}: {
  node: TreeNode
  depth: number
  isLast: boolean
  currentSessionId: string
  onNavigate: (sessionId: string) => void
}) {
  const isCurrent = node.session.id === currentSessionId
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className="flex items-start gap-1 relative"
        style={{ paddingLeft: depth > 0 ? depth * 20 : 0 }}
      >
        {/* 连接线 */}
        {depth > 0 && (
          <span className="shrink-0 text-muted-foreground/50 font-mono text-xs leading-6 select-none w-5 text-center">
            {isLast ? '└─' : '├─'}
          </span>
        )}

        {/* 节点内容 */}
        <button
          onClick={() => onNavigate(node.session.id)}
          className={`
            flex-1 text-left rounded-lg px-3 py-2 transition-colors cursor-pointer
            hover:bg-accent/50
            ${isCurrent
              ? 'border-2 border-blue-500 bg-blue-500/10'
              : 'border border-border/50'
            }
          `}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium truncate">
              {truncate(node.session.title, 30)}
            </span>
            {isCurrent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 shrink-0">
                当前
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatTime(node.session.createdAt)}
            </span>
            {node.session.forkFromMessageIndex !== undefined && (
              <span className="text-orange-400/80">
                从第 {node.session.forkFromMessageIndex + 1} 条消息分叉
              </span>
            )}
          </div>

          <div className="text-xs text-muted-foreground/60 mt-0.5">
            {node.session.messages.length} 条消息
            {hasChildren && (
              <span className="ml-2">
                · {node.children.length} 个分支
              </span>
            )}
          </div>
        </button>
      </div>

      {/* 递归渲染子节点 */}
      {node.children.length > 0 && (
        <div className="relative mt-1">
          {/* 垂直连接线 */}
          {node.children.length > 1 && (
            <div
              className="absolute border-l border-muted-foreground/20"
              style={{
                left: (depth + 1) * 20 + 9,
                top: 0,
                bottom: 28,
              }}
            />
          )}
          <div className="flex flex-col gap-1">
            {node.children.map((child, idx) => (
              <TreeNodeComponent
                key={child.session.id}
                node={child}
                depth={depth + 1}
                isLast={idx === node.children.length - 1}
                currentSessionId={currentSessionId}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SessionTreeView({
  sessionId,
  open,
  onClose,
  onNavigate,
}: SessionTreeViewProps) {
  const sessions = useSessionStore((s) => s.sessions)

  const tree = useMemo(() => {
    if (!sessions.length) return null

    // 构建快速查找 map
    const sessionsMap = new Map<string, Session>()
    for (const s of sessions) {
      sessionsMap.set(s.id, s)
    }

    // 构建 parentId -> children[] 映射
    const childrenMap = new Map<string, Session[]>()
    for (const s of sessions) {
      if (s.parentSessionId) {
        const siblings = childrenMap.get(s.parentSessionId) || []
        siblings.push(s)
        childrenMap.set(s.parentSessionId, siblings)
      }
    }

    // 从当前会话找到根节点
    const root = findRoot(sessionId, sessionsMap)
    if (!root) return null

    // 检查这个根节点是否有任何分支关系
    // 如果根节点就是当前会话，且没有 children，且没有 parent，就是孤立的
    const hasRelations =
      root.parentSessionId ||
      childrenMap.has(root.id) ||
      root.id !== sessionId

    if (!hasRelations && !childrenMap.has(sessionId)) return null

    return buildTree(root, childrenMap)
  }, [sessions, sessionId])

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[380px] sm:max-w-[380px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GitBranch className="size-5 text-blue-400" />
            对话分支
          </SheetTitle>
          <SheetDescription>
            查看当前对话的分叉历史与分支关系
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          {tree ? (
            <div className="flex flex-col gap-1">
              <TreeNodeComponent
                node={tree}
                depth={0}
                isLast={true}
                currentSessionId={sessionId}
                onNavigate={(id) => {
                  onNavigate(id)
                  onClose()
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <GitBranch className="size-10 mb-3 opacity-30" />
              <p className="text-sm">该会话没有分支记录</p>
              <p className="text-xs mt-1 opacity-60">
                在消息上使用「分叉」功能后，分支关系会显示在这里
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
