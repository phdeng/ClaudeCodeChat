import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import ChatLayout from './layouts/ChatLayout'
import ChatPage from './pages/ChatPage'
import { useThemeStore } from './stores/themeStore'

// 非首屏页面懒加载
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SessionsPage = lazy(() => import('./pages/SessionsPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))

export default function App() {
  const { theme, accentColor } = useThemeStore()

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(theme)
  }, [theme])

  // 主题色：设置 data-accent 属性到 <html>
  useEffect(() => {
    document.documentElement.dataset.accent = accentColor
  }, [accentColor])

  // 监听系统主题变化，仅在 system 模式下实时响应
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const currentMode = useThemeStore.getState().mode
      if (currentMode === 'system') {
        const newTheme = mediaQuery.matches ? 'dark' : 'light'
        useThemeStore.setState({ theme: newTheme })
      }
    }

    mediaQuery.addEventListener('change', handler)

    // 初始化时处理一次（如果是 system 模式）
    const { mode } = useThemeStore.getState()
    if (mode === 'system') {
      handler()
    }

    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return (
    <>
      <Routes>
        <Route element={<ChatLayout />}>
          <Route index element={<ChatPage />} />
          <Route path="/chat/:sessionId" element={<ChatPage />} />
          <Route path="/settings" element={<Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">加载中...</div>}><SettingsPage /></Suspense>} />
          <Route path="/sessions" element={<Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">加载中...</div>}><SessionsPage /></Suspense>} />
          <Route path="/search" element={<Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">加载中...</div>}><SearchPage /></Suspense>} />
        </Route>
      </Routes>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'bg-card text-foreground border-border',
          duration: 3000,
        }}
        theme={theme as 'dark' | 'light'}
      />
    </>
  )
}
