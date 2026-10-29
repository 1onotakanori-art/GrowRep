/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2021',
    // Firebase を個別チャンクに分離し、初期ロードのメインバンドルを軽量化
    rollupOptions: {
      // 管理画面（/admin）を別ページとして同じビルドに含める
      input: {
        main: 'index.html',
        admin: 'admin.html',
      },
      output: {
        manualChunks: {
          firebase: [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
