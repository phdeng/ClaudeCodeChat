# ClaudeCodeChat

<p align="center">
  <a href="./README.md">中文</a> | <a href="./README_EN.md">English</a>
</p>

<p align="center">
  <strong>A Web Chat Interface for Claude Code CLI</strong>
</p>

<p align="center">
  Not comfortable with the command line? No worries. ClaudeCodeChat provides a ChatGPT-style web interface that lets you use the full power of Claude Code just by chatting.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#features">Features</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#development">Development</a>
</p>

---

## Features

### Core Chat
- **Real-time Streaming** — SSE push, token-by-token output, live thinking process
- **Rich Rendering** — Markdown / Syntax Highlighting (Shiki) / Math (KaTeX) / Diagrams (Mermaid)
- **Image Support** — Paste/drag-and-drop upload, inline preview, click to zoom
- **Tool Call Display** — 11 tool icons with names, collapsible input/output

### Session Management
- Create / Edit / Delete / Pin / Archive sessions
- Tags + Color labels + Drag-and-drop reorder
- Session templates / Import & Export (Markdown/JSON) / Conversation forking
- Smart auto-generated titles
- Session statistics + Timeline view

### Message Actions
- Edit messages + Regenerate (with version history Diff comparison)
- Copy (Markdown/Plain text) / Bookmark / Quote reply
- TTS Read-aloud / Translate / Emoji reactions
- Multi-select batch operations / Pin messages

### Input Enhancements
- `@` file references / `/` slash commands / `#` message references
- Input history (arrow keys) / Voice input
- Markdown formatting toolbar
- Smart input suggestions / Quick phrases

### Configuration Management
- **MCP Servers** — Visual CRUD with environment variable support
- **Hooks** — Inline edit matcher + command
- **Skills** — Project-level skill CRUD
- **Subagent** — YAML config + built-in/custom management
- **Rules** — Online CLAUDE.md editor
- **General Settings** — Model selection / Permission mode / Environment variables
- Global + Project-level config switching

### UI/UX
- Dark / Light / System theme + 8 accent colors
- Zen focus mode / 17+ keyboard shortcuts / Ctrl+K command palette
- Mobile responsive + PWA + Touch gestures
- Project folder picker (Windows drive letters / Linux paths)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · shadcn/ui · Zustand |
| **Backend** | Express 5 · TypeScript · SSE (Server-Sent Events) |
| **Rendering** | react-markdown · Shiki · KaTeX · Mermaid |
| **Build** | pnpm workspaces (Monorepo) |
| **CLI** | `claude --print --verbose --output-format stream-json` |

---

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 8 (`npm install -g pnpm`)
- **Claude Code CLI** installed and available (`claude --version`)

---

## Quick Start

### One-click Install & Launch

**Windows** (Run PowerShell as Administrator):
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

### Manual Installation

```bash
# 1. Clone the repository
git clone https://github.com/phdeng/ClaudeCodeChat.git
cd ClaudeCodeChat

# 2. Install dependencies
pnpm install

# 3. Development mode (hot reload for both frontend & backend)
pnpm dev

# 4. Or build and start
pnpm build
pnpm start
```

Open your browser at **http://localhost:5173** (dev mode) or **http://localhost:3001** (production mode).

---

## Scripts

| Script | Windows | Linux / macOS | Description |
|--------|---------|---------------|-------------|
| Install | `scripts\install.bat` | `scripts/install.sh` | Check environment + Install deps + Build |
| Start | `scripts\start.bat` | `scripts/start.sh` | Start frontend & backend services |
| Stop | `scripts\stop.bat` | `scripts/stop.sh` | Stop all service processes |
| Restart | `scripts\restart.bat` | `scripts/restart.sh` | Stop then restart |

---

## Project Structure

```
ClaudeCodeChat/
├── packages/
│   ├── web/                        # Frontend React App
│   │   ├── src/
│   │   │   ├── components/         # 25+ React components
│   │   │   ├── pages/              # ChatPage · SettingsPage
│   │   │   ├── layouts/            # ChatLayout (sidebar + main area)
│   │   │   ├── stores/             # Zustand state management
│   │   │   └── utils/              # Utility functions
│   │   └── vite.config.ts          # Vite + API/SSE proxy
│   └── server/                     # Backend Express Service
│       └── src/
│           ├── index.ts            # HTTP + SSE entry
│           ├── routes/             # REST API routes
│           └── services/           # CLI process management + config R/W
├── scripts/                        # Install/Start/Stop scripts
├── docs/milestones/                # Version milestone docs
├── CLAUDE.md                       # AI development guide
└── package.json                    # Monorepo root config
```

---

## Data Flow

```
User Input → Frontend React → HTTP POST /api/chat/send → Backend Express
                                                              ↓
                                                    spawn claude CLI
                                                 (write message via stdin)
                                                              ↓
                                                  CLI stdout stream-json
                                                              ↓
                                                 Backend parse → SSE push
                                                              ↓
                                              Frontend Zustand store update
                                                              ↓
                                            ReactMarkdown real-time render
```

---

## Development

```bash
pnpm install          # Install dependencies
pnpm dev              # Start both frontend & backend dev servers
pnpm dev:web          # Start frontend only (localhost:5173)
pnpm dev:server       # Start backend only (localhost:3001)
pnpm build            # Build all packages
pnpm build:web        # Build frontend only
pnpm build:server     # Build backend only
```

### Key Conventions

- Frontend path alias: `@/` → `packages/web/src/`
- Frontend `/api` requests are proxied to backend `:3001`
- Dark theme CSS variables defined in `packages/web/src/index.css`
- Components use `var(--color-*)` instead of hardcoded colors
- Config API: `/api/config/mcp-servers` · `/api/config/hooks` · `/api/config/settings`
- Filesystem API: `/api/filesystem/browse` · `/api/filesystem/validate`

---

## FAQ

**Q: Claude CLI not found?**
Make sure Claude Code CLI is installed and in your system PATH:
```bash
claude --version
```

**Q: AI can't recognize uploaded images?**
Images are passed to the CLI via temp files + `@path` reference. Ensure your system temp directory is writable.

**Q: How to switch project working directory?**
Click the folder icon in the top toolbar and select a project path. The CLI will execute in that directory.

**Q: Which models are supported?**
Depends on your Claude Code CLI configuration. Switch models using the model selector in the top bar.

---

## License

MIT License

---

<p align="center">
  Built with Claude Code
</p>
