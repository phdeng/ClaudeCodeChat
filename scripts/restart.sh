#!/usr/bin/env bash

echo "============================================"
echo "  ClaudeCodeChat - 重启服务"
echo "============================================"
echo

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "--- 停止服务 ---"
bash "$SCRIPT_DIR/stop.sh"

echo
echo "--- 启动服务 ---"
# 传递原始参数（如 -d）
bash "$SCRIPT_DIR/start.sh" "$@"
