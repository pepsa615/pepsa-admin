import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/admin-api': {
          target: env.VITE_ADMIN_API_PROXY_TARGET || 'http://localhost:3300',
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  };
});
