/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const basePath = env.VITE_BASE_PATH || '/'

  return {
    base: basePath.endsWith('/') ? basePath : `${basePath}/`,
    plugins: [react()],
    server: {
      port: 5173,
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  }
})
