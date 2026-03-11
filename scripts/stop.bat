@echo off
chcp 65001 >nul 2>&1
title ClaudeCodeChat - 停止服务

echo ============================================
echo   ClaudeCodeChat - 停止服务
echo ============================================
echo.

:: 方式1: 通过 PID 文件停止
if exist "%~dp0.server.pid" (
    set /p PID=<"%~dp0.server.pid"
    echo [停止] 终止后端进程 (PID: %PID%)...
    taskkill /PID %PID% /T /F >nul 2>&1
    del "%~dp0.server.pid" >nul 2>&1
)

:: 方式2: 查找并终止占用 3001 端口的进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " ^| findstr "LISTENING" 2^>nul') do (
    echo [停止] 终止端口 3001 进程 (PID: %%a)...
    taskkill /PID %%a /T /F >nul 2>&1
)

:: 方式3: 终止所有 node 进程中名为 index.js 的
for /f "tokens=2" %%a in ('wmic process where "commandline like '%%packages\\server\\dist\\index.js%%'" get processid /value 2^>nul ^| findstr "="') do (
    set WPID=%%a
    set WPID=!WPID:ProcessId=!
    set WPID=!WPID:~1!
    if defined WPID (
        echo [停止] 终止 server 进程 (PID: !WPID!)...
        taskkill /PID !WPID! /T /F >nul 2>&1
    )
)

echo.
echo [OK] 服务已停止
pause
