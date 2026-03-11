@echo off
chcp 65001 >nul 2>&1
title ClaudeCodeChat - 安装

echo ============================================
echo   ClaudeCodeChat v1.0.0 - 一键安装
echo ============================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js ^>= 20
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查 Node 版本
for /f "tokens=1 delims=v" %%a in ('node -v') do set NODE_VER=%%a
for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_MAJOR=%%a
set NODE_MAJOR=%NODE_MAJOR:v=%
if %NODE_MAJOR% lss 20 (
    echo [错误] Node.js 版本过低，需要 ^>= 20，当前: %NODE_VER%
    pause
    exit /b 1
)
echo [OK] Node.js %NODE_VER%

:: 检查 pnpm
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 未检测到 pnpm，正在安装...
    call npm install -g pnpm
    if %errorlevel% neq 0 (
        echo [错误] pnpm 安装失败
        pause
        exit /b 1
    )
)
for /f %%a in ('pnpm -v') do set PNPM_VER=%%a
echo [OK] pnpm %PNPM_VER%

:: 检查 Claude CLI
where claude >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 未检测到 Claude Code CLI，对话功能将不可用
    echo 安装方式: npm install -g @anthropic-ai/claude-code
) else (
    echo [OK] Claude Code CLI 已安装
)

echo.
echo --- 安装项目依赖 ---
cd /d "%~dp0.."
call pnpm install
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)
echo [OK] 依赖安装完成

echo.
echo --- 构建项目 ---
call pnpm build
if %errorlevel% neq 0 (
    echo [错误] 构建失败
    pause
    exit /b 1
)
echo [OK] 构建完成

echo.
echo ============================================
echo   安装完成！
echo   运行 scripts\start.bat 启动服务
echo ============================================
pause
