#!/usr/bin/env bash

echo "============================================"
echo "  ClaudeCodeChat - 停止服务"
echo "============================================"
echo

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.server.pid"
STOPPED=false

# 方式1: 通过 PID 文件停止
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "[停止] 终止后端进程 (PID: $PID)..."
        kill "$PID" 2>/dev/null
        # 等待进程退出
        for i in $(seq 1 5); do
            if ! kill -0 "$PID" 2>/dev/null; then
                break
            fi
            sleep 1
        done
        # 如果还没退出，强制终止
        if kill -0 "$PID" 2>/dev/null; then
            echo "[停止] 强制终止 (PID: $PID)..."
            kill -9 "$PID" 2>/dev/null
        fi
        STOPPED=true
    fi
    rm -f "$PID_FILE"
fi

# 方式2: 查找占用 3001 端口的进程
PORT_PIDS=$(lsof -ti :3001 2>/dev/null || true)
if [ -n "$PORT_PIDS" ]; then
    for PID in $PORT_PIDS; do
        echo "[停止] 终止端口 3001 进程 (PID: $PID)..."
        kill "$PID" 2>/dev/null || true
        STOPPED=true
    done
fi

if [ "$STOPPED" = true ]; then
    echo
    echo "[OK] 服务已停止"
else
    echo "[提示] 未检测到运行中的服务"
fi
