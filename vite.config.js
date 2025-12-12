import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Vitest configuration
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.{test,spec}.{js,jsx}', 'scripts/__tests__/**/*.test.{js,cjs}'],
    testTimeout: 30000, // Increased timeout to handle heavy parallel test runs on Windows
    hookTimeout: 30000,
    maxConcurrency: 3, // Limit parallel tests to avoid resource contention
    fileParallelism: false, // Run test files sequentially for stability
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{js,jsx}'],
    },
  },
})
