#!/usr/bin/env bash
set -e

echo "============================================"
echo "  ClaudeCodeChat v1.0.0 - 启动服务"
echo "============================================"
echo

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="$SCRIPT_DIR/.server.pid"
LOG_DIR="$PROJECT_DIR/logs"

cd "$PROJECT_DIR"

# 检查是否已构建
if [ ! -f "packages/server/dist/index.js" ]; then
    echo "[提示] 未检测到构建产物，正在构建..."
    pnpm build
fi

# 检查端口占用
if lsof -i :3001 &>/dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ":3001 "; then
    echo "[警告] 端口 3001 已被占用，请先运行 ./scripts/stop.sh"
    exit 1
fi

# 创建日志目录
mkdir -p "$LOG_DIR"

# 后台模式 or 前台模式
if [ "$1" = "-d" ] || [ "$1" = "--daemon" ]; then
    # 后台守护模式
    echo "[启动] 后端服务 (端口 3001, 守护模式)..."
    nohup node packages/server/dist/index.js > "$LOG_DIR/server.log" 2>&1 &
    SERVER_PID=$!
    echo "$SERVER_PID" > "$PID_FILE"

    # 等待启动
    sleep 2
    if kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "[OK] 后端已启动 (PID: $SERVER_PID)"
        echo
        echo "============================================"
        echo "  服务已启动！"
        echo "  后端: http://localhost:3001"
        echo "  前端: pnpm dev:web (localhost:5173)"
        echo "  日志: $LOG_DIR/server.log"
        echo "  停止: ./scripts/stop.sh"
        echo "============================================"
    else
        echo "[错误] 后端启动失败，查看日志: $LOG_DIR/server.log"
        rm -f "$PID_FILE"
        exit 1
    fi
else
    # 前台模式
    echo "[启动] 后端服务 (端口 3001, 前台模式)..."
    echo "[提示] 按 Ctrl+C 停止服务"
    echo "[提示] 使用 -d 参数可后台运行: ./scripts/start.sh -d"
    echo
    echo "============================================"
    echo "  后端: http://localhost:3001"
    echo "  前端: pnpm dev:web (localhost:5173)"
    echo "============================================"
    echo

    # 捕获退出信号，清理 PID 文件
    cleanup() {
        rm -f "$PID_FILE"
        echo
        echo "[OK] 服务已停止"
        exit 0
    }
    trap cleanup SIGINT SIGTERM

    # 记录 PID
    echo $$ > "$PID_FILE"

    # 前台运行
    exec node packages/server/dist/index.js
fi
