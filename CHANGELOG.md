# Changelog

所有版本的功能变更记录。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/)。

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

[v1.2.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.1.0...v1.2.0
[v1.1.0]: https://github.com/phdeng/ClaudeCodeChat/compare/v1.0.0...v1.1.0
[v1.0.0]: https://github.com/phdeng/ClaudeCodeChat/releases/tag/v1.0.0
