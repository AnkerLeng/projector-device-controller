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
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      external: ['electron'],
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('ant-design-vue') || id.includes('@ant-design/icons-vue')) {
            return 'ant-design';
          }

          if (id.includes('/vue/') || id.includes('@vue')) {
            return 'vue';
          }

          return 'vendor';
        }
      }
    }
  },
  server: {
    host: '127.0.0.1', // 显式设置host
    port: 5173,
    strictPort: true
  }
})
