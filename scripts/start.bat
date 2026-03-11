@echo off
chcp 65001 >nul 2>&1
title ClaudeCodeChat - 服务运行中

echo ============================================
echo   ClaudeCodeChat v1.0.0 - 启动服务
echo ============================================
echo.

cd /d "%~dp0.."

:: 检查是否已构建
if not exist "packages\server\dist\index.js" (
    echo [提示] 未检测到构建产物，正在构建...
    call pnpm build
    if %errorlevel% neq 0 (
        echo [错误] 构建失败，请先运行 scripts\install.bat
        pause
        exit /b 1
    )
)

:: 检查端口占用
netstat -ano | findstr ":3001 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [警告] 端口 3001 已被占用，请先运行 scripts\stop.bat
    pause
    exit /b 1
)

:: 将 PID 写入文件以便 stop 脚本使用
echo [启动] 后端服务 (端口 3001)...
start /b "" node packages\server\dist\index.js > logs\server.log 2>&1

:: 等待后端启动
timeout /t 2 /nobreak >nul

:: 获取后端 PID
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    echo %%a > "%~dp0.server.pid"
    echo [OK] 后端已启动 (PID: %%a)
)

:: 检查前端构建产物
if exist "packages\web\dist\index.html" (
    echo.
    echo [提示] 前端已构建，可通过以下地址访问：
    echo   http://localhost:3001
    echo.
    echo   后端同时提供静态文件服务（需配置）
    echo   或运行 pnpm dev:web 启动前端开发服务器 (localhost:5173)
) else (
    echo [提示] 运行 pnpm dev:web 启动前端开发服务器
)

echo.
echo ============================================
echo   服务已启动！
echo   后端: http://localhost:3001
echo   前端: pnpm dev:web ^(localhost:5173^)
echo   按 Ctrl+C 或运行 scripts\stop.bat 停止
echo ============================================
echo.
echo 服务日志输出中（按 Ctrl+C 停止）...

:: 前台运行，显示日志
if not exist "logs" mkdir logs
node packages\server\dist\index.js 2>&1
