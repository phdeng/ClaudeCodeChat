import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心 — 几乎不会变，长期缓存
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI 框架
          'vendor-ui': ['radix-ui', 'lucide-react', 'sonner', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          // Markdown 渲染
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'remark-math', 'rehype-katex'],
          // KaTeX 数学渲染（较大）
          'vendor-katex': ['katex'],
          // Mermaid 图表（较大，非首屏必需）
          'vendor-mermaid': ['mermaid'],
          // 状态管理
          'vendor-zustand': ['zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
