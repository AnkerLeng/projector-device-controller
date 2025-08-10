import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // Electron-specific configuration
  base: process.env.NODE_ENV === 'production' ? './' : '/',
  build: {
    target: 'esnext', // 更新构建目标
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      external: ['electron']
    }
  },
  server: {
    host: '127.0.0.1', // 显式设置host
    port: 5173,
    strictPort: true
  }
})