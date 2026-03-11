# ClaudeCodeChat

<p align="center">
  <strong>为 Claude Code CLI 打造的 Web 聊天界面</strong>
</p>

<p align="center">
  不熟悉命令行？没关系。ClaudeCodeChat 提供 ChatGPT 风格的 Web 界面，让你像聊天一样使用 Claude Code 的全部能力。
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#功能特性">功能特性</a> ·
  <a href="#配置管理">配置管理</a> ·
  <a href="#开发指南">开发指南</a>
</p>

---

## 功能特性

### 核心对话
- **实时流式对话** — SSE 推送，逐字输出，思考过程实时可见
- **富文本渲染** — Markdown / 代码高亮(Shiki) / 数学公式(KaTeX) / 流程图(Mermaid)
- **图片支持** — 粘贴/拖拽上传图片，内联预览，点击放大
- **工具调用展示** — 11 种工具图标 + 中文名称，折叠/展开输入输出

### 会话管理
- 会话创建/编辑/删除/置顶/归档
- 标签分类 + 颜色标记 + 拖拽排序
- 会话模板 / 导入导出(Markdown/JSON) / 对话分叉
- 智能标题自动生成
- 会话统计 + 时间线视图

### 消息操作
- 编辑消息 + 重新生成(带版本历史 Diff 对比)
- 复制(Markdown/纯文本) / 收藏 / 引用回复
- TTS 朗读 / 翻译 / Emoji 反应
- 多选批量操作 / 消息置顶

### 输入增强
- `@` 引用文件 / `/` 斜杠命令 / `#` 引用消息
- 输入历史(上下键) / 语音输入
- Markdown 格式化工具栏
- 智能输入建议 / 快捷短语

### 配置管理
- **MCP 服务器** — 可视化增删改查，支持环境变量配置
- **Hooks 钩子** — 内联编辑 matcher + command
- **Skills 技能** — 项目级技能 CRUD
- **Subagent 子代理** — YAML 配置 + 内置/自定义管理
- **Rules 规则** — CLAUDE.md 在线编辑
- **通用设置** — 模型选择 / 权限模式 / 环境变量
- 支持全局 + 项目级配置切换

### 界面体验
- 暗色/亮色/跟随系统 三态主题 + 8 种主题色
- Zen 焦点模式 / 17+ 快捷键 / Ctrl+K 命令面板
- 移动端响应式 + PWA + 触摸手势
- 项目文件夹选择器(支持 Windows 盘符 / Linux 路径)

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · shadcn/ui · Zustand |
| **后端** | Express 5 · TypeScript · SSE (Server-Sent Events) |
| **渲染** | react-markdown · Shiki · KaTeX · Mermaid |
| **构建** | pnpm workspaces (Monorepo) |
| **CLI** | `claude --print --verbose --output-format stream-json` |

---

## 前置要求

- **Node.js** >= 20
- **pnpm** >= 8 (`npm install -g pnpm`)
- **Claude Code CLI** 已安装并可用 (`claude --version`)

---

## 快速开始

### 一键安装 & 启动

**Windows** (以管理员身份运行 PowerShell):
```powershell
.\scripts\install.bat
.\scripts\start.bat
```

**Linux / macOS**:
```bash
chmod +x scripts/*.sh
./scripts/install.sh
./scripts/start.sh
```

### 手动安装

```bash
# 1. 克隆仓库
git clone https://github.com/anthropics/ClaudeCodeChat.git
cd ClaudeCodeChat

# 2. 安装依赖
pnpm install

# 3. 开发模式（前后端热重载）
pnpm dev

# 4. 或者构建后启动
pnpm build
pnpm start
```

打开浏览器访问 **http://localhost:5173** (开发模式) 或 **http://localhost:3001** (生产模式)。

---

## 脚本说明

| 脚本 | Windows | Linux / macOS | 说明 |
|------|---------|---------------|------|
| 安装 | `scripts\install.bat` | `scripts/install.sh` | 检查环境 + 安装依赖 + 构建 |
| 启动 | `scripts\start.bat` | `scripts/start.sh` | 启动前后端服务 |
| 停止 | `scripts\stop.bat` | `scripts/stop.sh` | 停止所有服务进程 |
| 重启 | `scripts\restart.bat` | `scripts/restart.sh` | 停止后重新启动 |

---

## 项目结构

```
ClaudeCodeChat/
├── packages/
│   ├── web/                        # 前端 React 应用
│   │   ├── src/
│   │   │   ├── components/         # 25+ React 组件
│   │   │   ├── pages/              # ChatPage · SettingsPage
│   │   │   ├── layouts/            # ChatLayout (侧边栏+主区域)
│   │   │   ├── stores/             # Zustand 状态管理
│   │   │   └── utils/              # 工具函数
│   │   └── vite.config.ts          # Vite + API/SSE 代理
│   └── server/                     # 后端 Express 服务
│       └── src/
│           ├── index.ts            # HTTP + SSE 入口
│           ├── routes/             # REST API 路由
│           └── services/           # CLI 进程管理 + 配置读写
├── scripts/                        # 安装/启动/停止脚本
├── docs/milestones/                # 版本里程碑文档
├── CLAUDE.md                       # AI 开发指南
└── package.json                    # Monorepo 根配置
```

---

## 数据流

```
用户输入 → 前端 React → HTTP POST /api/chat/send → 后端 Express
                                                        ↓
                                              spawn claude CLI
                                           (stdin 写入消息)
                                                        ↓
                                            CLI stdout stream-json
                                                        ↓
                                           后端解析 → SSE 推送
                                                        ↓
                                        前端 Zustand store 更新
                                                        ↓
                                      ReactMarkdown 实时渲染
```

---

## 开发指南

```bash
pnpm install          # 安装依赖
pnpm dev              # 同时启动前后端开发服务器
pnpm dev:web          # 仅启动前端 (localhost:5173)
pnpm dev:server       # 仅启动后端 (localhost:3001)
pnpm build            # 构建所有包
pnpm build:web        # 仅构建前端
pnpm build:server     # 仅构建后端
```

### 关键约定

- 前端路径别名: `@/` → `packages/web/src/`
- 前端 `/api` 和 `/ws` 请求自动代理到后端 `:3001`
- 深色主题 CSS 变量定义在 `packages/web/src/index.css`
- 组件使用 `var(--color-*)` 而非硬编码颜色
- 配置 API: `/api/config/mcp-servers` · `/api/config/hooks` · `/api/config/settings`
- 文件系统 API: `/api/filesystem/browse` · `/api/filesystem/validate`

---

## 常见问题

**Q: 提示找不到 Claude CLI？**
确保已安装 Claude Code CLI 并在系统 PATH 中：
```bash
claude --version
```

**Q: 图片上传后 AI 无法识别？**
图片通过临时文件 + `@path` 引用传递给 CLI。确保系统临时目录可写。

**Q: 如何切换项目工作目录？**
点击顶部工具栏的文件夹图标，选择项目路径。CLI 会在该目录下执行。

**Q: 支持哪些模型？**
取决于你的 Claude Code CLI 配置。可在顶部模型选择器中切换。

---

## 许可证

MIT License

---

<p align="center">
  使用 Claude Code 构建 ❤️
</p>
