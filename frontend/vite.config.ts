import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // AntD 与 React 每次发版都不变，单独成块可以让浏览器跨版本复用缓存。
        // 内网单实例部署下体积不是瓶颈，但一个 1MB 的单包会让每次发版都全量重下。
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd', '@ant-design/icons'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 本地开发：前端 5173 直连后端 8080，生产由 Nginx 反代（4.4.1）
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
