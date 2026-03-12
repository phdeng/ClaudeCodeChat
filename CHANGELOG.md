# Changelog

所有版本的功能变更记录。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/)。

---

## [1.14.0] — 2026-03-13

### 新增
- **旧会话归档提示**：超过 30 天未活动的会话在侧边栏显示淡化样式（opacity-50）+ 天数提示（如"45天前"），置顶会话不受影响
- **TTS 朗读控制条**：朗读消息时底部显示控制条，支持暂停/继续/停止 + 语速调节（0.5x - 2.0x）
  - 状态指示（朗读中/已暂停，带脉冲动画）
  - 语速实时切换（自动重建 utterance 应用新语速）

---

## [1.13.0] — 2026-03-13

### 新增
- **消息日期分隔线**：不同日期的消息之间自动显示分隔线（今天/昨天/X月X日），方便定位时间
- **TXT 纯文本导出**：会话导出菜单新增 .txt 格式，包含角色、时间和分隔线

---

## [1.12.0] — 2026-03-13

### 新增
- **快速会话切换器**：Ctrl+Shift+H 打开浮动面板，模糊搜索会话标题快速切换
  - 上下箭头键盘导航 + Enter 确认 + Esc 关闭
  - 显示会话标题、消息数、标签、最后活动时间（相对时间）
  - 当前会话蓝色高亮标记
- **输入框 Token 统计增强**：Token 数超过 2000 显示橙色，超过 5000 显示红色预警

---

## [1.11.0] — 2026-03-13

### 新增
- **消息气泡样式优化**：用户消息右对齐 + 主题色实心气泡 + 白色文字 + 轻阴影；AI 消息左对齐 + 淡灰卡片背景 + 圆角
- **快速笔记 ScratchPad**：右下角浮动便签窗口（320x400），支持临时记录想法/代码片段/提示词草稿
  - Zustand + localStorage 持久化笔记内容
  - 底部工具栏：字数统计 + 复制到剪贴板 + 清空
  - 最小化状态 + 内容非空蓝色圆点指示

### 改进
- 用户气泡内代码块通过 CSS 选择器覆盖颜色，确保可读性
- 移动端气泡宽度自适应（90%），桌面端 80%

---

## [1.10.0] — 2026-03-13

### 新增
- **侧边栏底部工具栏精简**：6 个竖排按钮（~250px）改为单行水平图标栏（~40px），每个按钮仅显示图标 + Tooltip 悬浮提示，大幅释放历史会话列表空间
- **多会话标签页**：聊天区域顶部新增标签页栏，支持同时打开多个会话快速切换
  - 标签页可拖拽排序、右键菜单（关闭/关闭其他/关闭全部）
  - 流式响应中的会话显示动态指示点
  - 最多 10 个标签页 + 滚动箭头溢出处理
  - 新建标签页按钮（+ 号）
- **标签页状态管理**（`sessionTabsStore.ts`）：Zustand + localStorage 持久化

### 变更
- 版本号从 1.9.0 升级到 1.10.0
- 侧边栏点击会话自动在标签页中打开
- ChatPage 与标签页状态双向同步

---

## [1.9.0] — 2026-03-12

### 新增
- **MCP 市场**：12+ 热门 MCP 服务器（文件系统/GitHub/数据库/搜索/浏览器自动化等），一键安装到设置
- **Skill 市场**：8+ 实用技能模板（代码审查/Git提交规范/TDD/API设计/安全审计等），一键添加到项目
- **市场主页面**：独立 /marketplace 路由，MCP/Skill 双 Tab + 搜索 + 分类筛选
- **已安装检测**：市场卡片自动检测安装状态，已安装项显示勾选标记
- **环境变量配置**：安装需要 API Key 的 MCP 服务器时弹出配置表单
- **Skill 预览**：安装前可预览 SKILL.md 内容（Markdown 渲染）
- **侧边栏/底部导航入口**：新增市场快捷入口

---

## [1.8.0] — 2026-03-12

### 新增
- **消息收藏夹**：跨会话收藏消息，独立面板浏览/搜索/分类管理，支持备注和 Markdown 预览
- **@文件路径补全**：输入框中输入 `@` 自动弹出文件路径补全列表，模糊匹配 + 键盘导航
- **收藏夹侧边栏入口**：侧边栏底部新增收藏夹按钮 + 数量 badge

---

## [1.7.0] — 2026-03-12

### 新增
- **提示词模板库**：6 个内置模板（代码审查/Bug修复/重构/解释代码/编写测试/文档生成）+ 自定义模板 CRUD
- **拖拽文件到对话**：将文件拖入输入区域自动插入 @文件路径 引用
- **会话内消息搜索**：Ctrl+F 打开搜索栏，实时高亮匹配 + 上下跳转 + 搜索替换（仅用户消息）
- **消息文本高亮**：搜索时消息内匹配关键词以黄色 `<mark>` 高亮显示

### 改进
- 匹配消息闪烁动画（search-flash）提升搜索定位体验

---

## [v1.6.0] — 2026-03-12

### 新增
- **文件浏览器组件**（`FileExplorer.tsx`）：聚焦模式下的文件浏览面板，包含：
  - 面包屑导航（可点击路径段快速跳转）
  - 文件/目录列表（按类型排序，图标按扩展名映射）
  - 搜索过滤（300ms debounce）
  - 文件预览（底部面板展示文件内容）
  - 「添加到上下文」按钮（复制 @路径 到剪贴板）
- **文件浏览器状态管理**（`fileExplorerStore.ts`）：路径、显示状态、面板宽度（localStorage 持久化）
- **聚焦分屏布局**：焦点模式下左右分屏 — 文件浏览器（左）+ 对话区域（右）
  - 可拖拽分隔条（min 200px，max 50% 视口宽度）
  - 焦点工具条新增文件浏览器切换按钮
- **`/files` 命令升级**：从输出文件树改为进入聚焦分屏模式 + 打开文件浏览器

### 变更
- 版本号从 1.5.0 升级到 1.6.0
- `zenMode` 状态从 ChatLayout useState 迁移到 settingsStore（跨组件共享）
- `/files` 命令从文本输出改为打开分屏文件浏览器
- 焦点模式浮动工具条新增文件浏览器切换按钮（FolderOpen 图标）

---

## [v1.5.0] — 2026-03-12

### 新增
- **MessageList 组件拆分**：4200+ 行巨型组件拆分为独立模块：
  - `messageUtils.ts`：15 个工具函数（时间格式化、文本统计、thinking/tool 解析、工具信息映射等）
  - `messageTypes.ts`：6 个 TypeScript 接口（ToolUseParsed/ToolResultParsed/MessageGroup 等）
  - `CodeBlock.tsx`：代码块渲染（Shiki 高亮 + 复制 + 全屏 + Diff + 片段保存）+ InlineDiffView + useCopyToClipboard Hook
  - `MessageActions.tsx`：消息操作栏（编辑/复制/收藏/固定/朗读/翻译）+ VersionHistoryPanel + TokenUsageBadge + FeedbackButtons + MessageReactions
- **全局搜索增强面板**：`/search` 命令打开 Sheet 抽屉，支持：
  - 多维度筛选：日期范围、标签、颜色标签、项目路径、消息角色
  - 搜索结果按会话分组 + 关键词 `<mark>` 高亮
  - 搜索历史（最近 10 条，localStorage 持久化）
- **对话分支可视化**：侧边栏「查看分支」入口，打开 Sheet 面板展示 fork 关系树：
  - Session 接口扩展 parentSessionId + forkFromMessageIndex
  - 递归树形渲染，当前会话蓝色高亮，点击节点跳转

### 变更
- 版本号从 1.4.0 升级到 1.5.0
- forkSession 方法记录父子关系（parentSessionId + forkFromMessageIndex）
- ChatPage 新增 `/search` 命令处理
- Sidebar 会话操作菜单新增「查看分支」入口
- CLAUDE.md 新增「设计先行」规则

### 修复
- ContextPanel: Sheet Portal 脱离主 DOM 树导致 Tooltip 崩溃，添加 TooltipProvider
- GitPanel: useEffect 依赖 fetchStatus（包含 t() 翻译函数）导致无限循环，移除依赖

---

## [v1.4.0] — 2026-03-12

### 新增
- **CLI 深度参数面板**：顶部工具栏新增高级参数按钮，支持 4 项 CLI 参数配置：
  - Effort 推理深度（low/medium/high/max）
  - 预算硬限制（`--max-budget-usd` CLI 层面费用上限）
  - Fallback 备选模型（主模型过载时自动降级）
  - 工具权限精细控制（白/黑名单模式）
- **Git 操作集成面板**：`/git` 命令升级为图形化面板，包含：
  - Git 状态可视化（分支名 + ahead/behind + staged/modified/untracked 分组）
  - 文件级 Diff 预览（绿色增/红色删/蓝色 @@ 头）
  - 一键操作：让 Claude commit / review / push
- **对话自动摘要**：CLI 回复完成后自动调用 Haiku 生成 1-2 句摘要 + 关键词标签，存储到 Session
- **后端 Git API**：`/api/filesystem/git-status`（porcelain 解析）+ `/api/filesystem/git-diff`（文件级 diff + 统计）
- **后端摘要 API**：`/api/chat/summarize`（spawn claude --print 通过 stdin 传入 prompt）
- **CLI 参数透传**：`--effort`、`--max-budget-usd`、`--fallback-model`、`--allowedTools`、`--disallowedTools`、`--from-pr`

### 变更
- 版本号从 1.3.0 升级到 1.4.0
- `/git` 命令从文本输出改为打开 Git 操作面板
- Session 接口扩展 7 个字段（effort/maxBudgetUsd/fallbackModel/allowedTools/disallowedTools/summary/keyTopics）
- `/api/chat/send` 路由支持接收和传递 6 个新 CLI 参数

---

## [v1.3.0] — 2026-03-12

### 新增
- **/context 上下文可视化面板**：匹配 CLI `/context` 输出，10x10 彩色方块网格 + Token 类别分解（System prompt/tools/Memory/Skills/Messages/Free/Autocompact）+ MCP 工具列表 + Skills 列表
- **文件预览与内容查看器**：代码语法高亮 + 行号 + 图片预览 + 文件元信息展示
- **敏感信息自动检测与遮罩**：发送前扫描 7 类敏感信息（API Key/密码/私钥/手机号/身份证号/Token/数据库连接串），支持遮罩后发送
- **智能成本预警与预算控制**：设置单会话 Token 预算 + 预警阈值，消耗接近时显示警告条
- **后端文件 API**：`/api/filesystem/file-info`（文件元信息）+ `/api/filesystem/read-file`（文件内容读取，含二进制检测和路径安全检查）
- **UI 基础组件**：Sheet 抽屉组件 + Dialog 弹窗组件（基于 Radix UI）

### 变更
- 版本号从 1.2.0 升级到 1.3.0
- `/context` 命令注册为 directCommand，打开可视化面板
- ContextPanel 重构为双 Tab：Context Usage 可视化 + 管理上下文
- 设置页通用面板新增「成本预算」卡片
- 侧边栏清理遗留无用状态变量

### 技术细节
- 上下文网格使用 useMemo 优化渲染，按类别 token 比例分配 100 个方块
- 敏感检测使用 7 组正则表达式，支持去重和按位置排序
- 文件读取 API 包含路径安全验证（禁止 `..` 遍历）和二进制文件检测（前 8KB null bytes）
- 预算配置通过 localStorage `budget-settings` 持久化，支持跨标签页同步

---

## [v1.2.0] — 2026-03-12

### 新增
- **国际化 (i18n)**：支持中英文切换，Zustand 持久化语言偏好，320+ 翻译键值覆盖全部界面
- **使用统计仪表板**：Token 消耗分析、成本估算（基于 API 定价）、14 天趋势图、模型分布、项目 Top-5 排行
- **CLI 工具输出结构化解析**：7 种工具类型专用渲染器（Edit/Bash/Glob/Grep/Read/LS/MultiEdit），取代原始 JSON 展示
- **提示词工作流编排**：多步骤链式执行 + `{{prev}}` 变量替换 + 3 个预置模板（代码审查/TDD/文档生成）
- **知识库**：消息保存到知识库 + 全文搜索 + 标签管理 + Markdown 预览 + 独立页面路由

### 变更
- 版本号从 1.1.0 升级到 1.2.0
- 服务端 `/api/version` 端点返回 1.2.0
- 设置页新增「使用统计」Tab（BarChart3 图标）
- 通用设置新增「界面语言」切换卡片
- 命令面板新增 `/workflow` 命令
- 移动端底部导航新增知识库入口

### 技术细节
- i18n 架构：`zh.ts`（主语言包）+ `en.ts`（英文翻译）+ `index.ts`（useTranslation hook）
- `DeepString<T>` 递归泛型解决 `as const` 字面量类型与英文翻译的类型兼容
- 工作流执行通过 SSE `done` 事件触发自动步进，500ms 延迟防止请求堆积
- 知识库使用 Zustand `persist` 中间件持久化到 localStorage

### 新增文件
| 文件 | 说明 |
|------|------|
| `packages/web/src/i18n/zh.ts` | 中文语言包 |
| `packages/web/src/i18n/en.ts` | 英文语言包 |
| `packages/web/src/i18n/index.ts` | i18n 基础设施（store + hook） |
| `packages/web/src/utils/costAnalytics.ts` | Token 成本分析工具函数 |
| `packages/web/src/components/settings/UsageStatsPanel.tsx` | 使用统计仪表板组件 |
| `packages/web/src/components/ToolRenderers.tsx` | CLI 工具输出渲染器（7种） |
| `packages/web/src/stores/workflowStore.ts` | 工作流状态管理（CRUD + 执行） |
| `packages/web/src/components/WorkflowPanel.tsx` | 工作流管理面板 |
| `packages/web/src/components/WorkflowExecutionBar.tsx` | 工作流执行进度条 |
| `packages/web/src/stores/knowledgeStore.ts` | 知识库状态管理 |
| `packages/web/src/pages/KnowledgePage.tsx` | 知识库页面 |
| `packages/web/src/components/SaveToKnowledgeDialog.tsx` | 保存到知识库弹窗 |

---

## [v1.1.0] — 2026-03-11

### 新增
- **移动端增强**：触摸手势（左缘右滑开侧栏）+ 底部导航栏（4 图标）
- **主题色定制**：8 色 CSS 变量切换（蓝/紫/绿/橙/红/粉/青/灰）
- **代码高亮主题**：6 种 Shiki 主题可选（GitHub Dark/Light、Dracula、Nord、One Dark、Monokai）
- **Emoji 反应**：6 快捷表情 + 选择器 + 计数显示
- **上下文记忆面板**：contextNotes CRUD，对话级上下文笔记
- **消息置顶 Pin**：最多 5 条 + 顶部摘要栏 + 跳转定位
- **智能输入建议**：5 类规则匹配（代码/错误/长文/问题/空白）
- **未读消息 badge**：侧边栏红点 + 自动已读标记
- **代码片段管理器**：snippetStore + CRUD + localStorage 持久化
- **导出长图 PNG**：Canvas API + 2x 高清渲染
- **标签云可视化**：词频字号 + 哈希颜色映射
- **功能发现欢迎卡片**：6 卡 3x2 grid 布局引导新用户
- **消息字数/阅读时间**：tooltip 显示统计信息
- **命令面板增强**：新命令 + 分类排序
- **浮动快捷键速查**：右下角面板展示所有快捷键
- **消息分享链接**：生成可分享的消息链接
- **会话颜色标签选择器**：8 色会话标记

### 变更
- 架构从 WebSocket 全面迁移到 SSE + HTTP API
- `POST /api/chat/send`（发送）、`POST /api/chat/stop`（停止）、`POST /api/chat/resume`（恢复）
- `GET /api/chat/stream?clientId=xxx`（SSE 连接）
- 移除 `ws` 依赖，后端纯 Express + SSE
- 通信协议: SSE（server→client）+ HTTP POST（client→server）

### 修复
- 通用设置: `deepMerge` 支持 `null` 删除 + 移除无效字段 + `auto` 权限模式
- MCP: 编辑 + env 环境变量 + 错误处理 + PUT API
- Skills: 完整后端 API + 前端 CRUD（项目级 `.claude/skills/`）
- Subagent: yaml 库替换简陋解析器 + 正确处理数组/多行
- Hooks: 内联编辑 matcher/command
- Rules: CLAUDE.md 编辑面板（RulesPanel）
- Windows 盘符选择（遍历 A-Z）+ Linux 路径输入 + 验证
- FolderPicker 滚动条（max-h-300px）
- Thinking 实时流式（`--include-partial-messages` + delta 事件）
- 工具调用展示（ToolUseBlock + 11 种工具图标/中文名）
- 连接状态增强（HTTP ping 延迟 + 版本号 + 手动重连）

### Bug 修复（从 v1.0 测试报告）
- P0: WebSocket onmessage JSON.parse 无 try-catch
- P0: ensureWebSocket 闭包过期问题（改用 useRef）
- P1: 快捷键冲突 Ctrl+H/D（改为 Alt+H/D）
- P1: cliSessionMap 内存泄漏（close 事件时清理）
- P1: Windows SIGTERM 无效（改用 taskkill /T /F）
- P1: 同步覆盖本地数据（改为合并策略）
- P2: Mermaid XSS 风险（securityLevel → strict）
- P2: 预览卡片溢出（边界检测 + 移动端不显示）
- P2: 图片竞态条件（函数式状态更新）
- P2: WebSocket onopen 覆盖（addEventListener once）
- P2: Manager 孤儿进程（新建前 stop+removeAllListeners）
- P2: 同步丢失 archived/sortOrder 字段
- P2: 无障碍性（添加 aria-label）

---

## [v1.0.0] — 2026-03-10

### 新增
- **核心对话**：WebSocket 实时流式对话 + Markdown/KaTeX/Shiki/Mermaid 渲染
- **会话管理**：CRUD + 置顶/归档/标签/分类/拖拽排序/模板/导入导出/分叉
- **消息操作**：编辑/重新生成/复制/反馈/收藏/引用/朗读/右键菜单/多选批量
- **输入增强**：@文件引用 + /斜杠命令 + 输入历史 + 语音输入 + 图片粘贴上传
- **搜索**：会话内搜索（Ctrl+F）+ 全局跨会话搜索（Ctrl+Shift+F）
- **UI/UX**：暗/亮/系统三态主题 + Zen 焦点模式 + 17+ 快捷键 + Ctrl+K 命令面板
- **工具面板**：Prompt 模板库 + 系统提示词 + Token 用量 + 多模型对比 + 时间线视图
- **配置管理**：MCP 服务器 + Hooks + Subagent + 环境变量 + 权限模式 + 项目文件夹选择
- **后端服务**：CLI 进程管理 + 配置读写 + 会话持久化 + 云同步 + 文件系统浏览 API
- **移动端**：响应式布局 + PWA manifest + 触摸手势

### 技术栈
- 前端: React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + shadcn/ui + Zustand
- 后端: Express 5 + TypeScript + WebSocket (ws)
- 构建: pnpm workspaces monorepo

---

[1.14.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.13.0...v1.14.0
[1.13.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.12.0...v1.13.0
[1.12.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.6.0...v1.7.0
[v1.6.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.5.0...v1.6.0
[v1.5.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.4.0...v1.5.0
[v1.4.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.3.0...v1.4.0
[v1.3.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.2.0...v1.3.0
[v1.2.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.1.0...v1.2.0
[v1.1.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.0.0...v1.1.0
[v1.0.0]: https://github.com/phdeng/ClaudeCodeChat/releases/tag/v1.0.0
