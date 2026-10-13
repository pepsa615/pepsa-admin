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
      // Deploy uses PEPSA_VITE_OUTDIR so the live dist/ is swapped atomically
      // instead of being emptied mid-build (which makes nginx SPA-fallback HTML for JS).
      outDir: process.env.PEPSA_VITE_OUTDIR || 'dist',
      emptyOutDir: true,
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
