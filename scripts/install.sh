#!/usr/bin/env bash
set -e

echo "============================================"
echo "  ClaudeCodeChat v1.0.0 - 一键安装"
echo "============================================"
echo

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 检查 Node.js
if ! command -v node &>/dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装 Node.js >= 20"
    echo "  macOS:  brew install node"
    echo "  Ubuntu: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
    exit 1
fi

NODE_VER=$(node -v)
NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "[错误] Node.js 版本过低，需要 >= 20，当前: $NODE_VER"
    exit 1
fi
echo "[OK] Node.js $NODE_VER"

# 检查 pnpm
if ! command -v pnpm &>/dev/null; then
    echo "[提示] 未检测到 pnpm，正在安装..."
    npm install -g pnpm
fi
PNPM_VER=$(pnpm -v)
echo "[OK] pnpm $PNPM_VER"

# 检查 Claude CLI
if ! command -v claude &>/dev/null; then
    echo "[警告] 未检测到 Claude Code CLI，对话功能将不可用"
    echo "  安装方式: npm install -g @anthropic-ai/claude-code"
else
    echo "[OK] Claude Code CLI 已安装"
fi

echo
echo "--- 安装项目依赖 ---"
pnpm install
echo "[OK] 依赖安装完成"

echo
echo "--- 构建项目 ---"
pnpm build
echo "[OK] 构建完成"

echo
echo "============================================"
echo "  安装完成！"
echo "  运行 ./scripts/start.sh 启动服务"
echo "============================================"
