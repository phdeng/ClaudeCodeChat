@echo off
chcp 65001 >nul 2>&1
title ClaudeCodeChat - 重启服务

echo ============================================
echo   ClaudeCodeChat - 重启服务
echo ============================================
echo.

echo --- 停止服务 ---
call "%~dp0stop.bat"

echo.
echo --- 启动服务 ---
call "%~dp0start.bat"
