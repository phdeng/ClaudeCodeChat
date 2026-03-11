# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言要求

永远使用中文回复和输出。

## 项目概述

ClaudeCodeChat 是一个 Web 应用，为不熟悉命令行的用户提供类似 ChatGPT 的界面来管理和使用 Claude Code CLI。核心功能包括：

- 创建和管理对话会话（含 Markdown 渲染）
- 管理 MCP (Model Context Protocol) 服务器配置
- 管理 Hooks（钩子）
- 管理 Skills（技能）— 开发中
- 管理 Subagent（子代理）— 开发中

## 技术栈

- **Monorepo**: pnpm workspaces
- **前端** (`packages/web`): React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + shadcn/ui + Zustand + react-markdown
- **后端** (`packages/server`): Express 5 + TypeScript + SSE (Server-Sent Events)
- **CLI 交互**: 后端通过 `child_process.spawn` 调用 `claude` CLI，使用 `--print --verbose --output-format stream-json`，消息通过 stdin 传入（避免 Windows shell 引号问题）

## 开发命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 同时启动前后端开发服务器
pnpm dev:web          # 仅启动前端 (localhost:5173)
pnpm dev:server       # 仅启动后端 (localhost:3001)
pnpm build            # 构建所有包
pnpm build:web        # 仅构建前端
pnpm build:server     # 仅构建后端
```

## 架构

```
packages/
├── web/                    # 前端 React 应用
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.tsx         # 会话列表侧边栏（含工作目录显示）
│   │   │   ├── ChatInput.tsx       # 消息输入框
│   │   │   ├── MessageList.tsx     # 消息展示（Markdown 渲染）
│   │   │   ├── FolderPicker.tsx    # 项目文件夹选择器（浏览+选择）
│   │   │   └── settings/
│   │   │       ├── McpServersPanel.tsx      # MCP 服务器管理
│   │   │       ├── HooksPanel.tsx           # Hooks 管理
│   │   │       ├── GeneralSettingsPanel.tsx # 通用设置（模型/语言/权限/环境变量）
│   │   │       └── SubagentPanel.tsx        # 子代理管理（内置+自定义 CRUD）
│   │   ├── layouts/ChatLayout.tsx  # 侧边栏+主区域布局（含模型选择器+连接状态+文件夹选择）
│   │   ├── pages/
│   │   │   ├── ChatPage.tsx        # 对话页（SSE+HTTP 通信，支持模型和工作目录）
│   │   │   └── SettingsPage.tsx    # 设置页（5 个 Tab）
│   │   └── stores/sessionStore.ts  # Zustand 会话状态（含模型选择+连接状态+工作目录）
│   └── vite.config.ts              # 含 API 代理到 :3001
└── server/                 # 后端 Express 服务
    └── src/
        ├── index.ts                # HTTP + SSE 入口
        ├── routes/
        │   ├── config.ts           # 配置管理 REST API（settings/agents/hooks/mcp）
        │   └── filesystem.ts       # 文件系统浏览 API（目录列表+验证）
        └── services/
            ├── claudeCode.ts       # CLI 进程管理（支持模型选择+工作目录+权限模式）
            └── configManager.ts    # 读写 ~/.claude/ 配置文件（含 agents CRUD）
```

### 数据流

1. 用户在前端输入消息 → 通过 HTTP POST (`/api/chat/send`) 发送到后端
2. 后端 `ClaudeCodeManager` spawn `claude` CLI，消息通过 stdin 写入
3. CLI 输出 stream-json → 后端逐行解析，通过 SSE (`/api/chat/stream`) 推送事件
4. 前端 EventSource 接收事件，Zustand store 实时更新，ReactMarkdown 渲染
5. CLI 完成后 SSE 发送 `done` 事件，前端结束流式状态
6. 断线重连：EventSource 自动重连 + POST `/api/chat/resume` 恢复缺失数据

### 关键约定

- 前端路径别名: `@/` → `packages/web/src/`
- 前端开发服务器代理: `/api` 自动转发到后端 `:3001`（含 SSE 连接）
- 深色主题 CSS 变量定义在 `packages/web/src/index.css` 的 `:root`
- 组件使用 `var(--color-*)` 而非硬编码颜色
- spawn claude CLI 时必须 `delete env.CLAUDECODE` 避免嵌套检测
- CLI session ID 映射：前端 UUID → CLI 自动分配的 UUID（通过 init 事件获取）
- 配置 API 路径: `/api/config/mcp-servers`, `/api/config/hooks`, `/api/config/settings`, `/api/config/agents`
- 文件系统 API: `/api/filesystem/browse`, `/api/filesystem/validate`
- Chat API: POST `/api/chat/send`（发送）、POST `/api/chat/stop`（停止）、POST `/api/chat/resume`（恢复）
- SSE 连接: GET `/api/chat/stream?clientId=xxx`（接收流式事件）
- SSE 事件类型: `connected`、`init`、`stream`、`done`、`error`、`heartbeat`

## Agent Teams 规则

- **并行 agent 数量限制**：每轮最多启动 **2 个** agent（避免子 agent 限额耗尽）
- 每个 agent 应尽量只修改 1-2 个文件，避免多 agent 修改同一文件导致冲突
- 每轮 agent 全部完成后，必须运行 `pnpm build` 验证构建
- 构建失败时立即修复，再启动下一轮

## 版本管理与里程碑

- **里程碑规划**：规划大版本需求时，按里程碑版本记录到 `docs/milestones/` 目录下的 Markdown 文件（如 `v1.0.md`、`v1.1.md`）
- **版本号推送**：每个里程碑完成后，更新 `package.json` 版本号，创建 git tag 并推送到远程仓库
- **分支管理**：每个里程碑版本必须创建独立的 git 分支（命名格式 `release/vX.Y.Z`），并推送到远程仓库。例如 v1.1.0 对应 `release/v1.1.0` 分支
- **测试 Agent**：每个里程碑版本必须启动**测试 Agent** 进行功能验证，测试结果记录到 `docs/milestones/` 对应版本文件的「测试报告」章节
- **Bug 跟踪**：测试 Agent 发现的 bug 记录在里程碑文件中，开发 Agent 必须在下一轮优先修复这些 bug，修复后由测试 Agent 回归验证

## 环境信息

- 平台：Windows 11
- Node.js >= 20, pnpm
- Claude Code 实验性功能已启用：Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
- Git 提交作者：`phdeng`
