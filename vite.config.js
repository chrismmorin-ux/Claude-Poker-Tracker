import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Poker Tracker',
        short_name: 'Poker',
        description: 'Live poker hand tracker and exploit engine',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/$/],
        runtimeCaching: [
          {
            // Network-first for the HTML shell — never serve stale markup
            urlPattern: /\/index\.html$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'html-cache', expiration: { maxEntries: 1 } },
          },
          {
            // Cache-first for hashed assets (immutable by design)
            urlPattern: /\/assets\/.*\.(js|css)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'asset-cache', expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: './src/test/setup.js',
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 3,
        minForks: 1,
        memoryLimit: 0.7,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'src/reducers/__tests__/**/*.test.js',
            'src/utils/**/__tests__/**/*.test.js',
            'src/constants/__tests__/**/*.test.js',
            'src/types/__tests__/**/*.test.js',
            'src/migrations/__tests__/**/*.test.js',
            'src/test/**/*.test.js',
            'scripts/__tests__/**/*.test.{js,cjs}',
          ],
          pool: 'threads',
          poolOptions: { threads: { maxThreads: 4 } },
          testTimeout: 5000,
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          setupFiles: './src/test/setup.js',
          include: [
            'src/components/**/__tests__/**/*.test.jsx',
            'src/components/**/__tests__/**/*.test.js',
          ],
          pool: 'forks',
          poolOptions: {
            forks: {
              maxForks: 2,
              execArgv: ['--max-old-space-size=3072'],
            },
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'hooks',
          environment: 'jsdom',
          setupFiles: './src/test/setup.js',
          include: [
            'src/hooks/__tests__/**/*.test.js',
            'src/contexts/__tests__/**/*.test.jsx',
            'src/__tests__/**/*.test.js',
          ],
          pool: 'forks',
          poolOptions: {
            forks: {
              maxForks: 2,
              execArgv: ['--max-old-space-size=3072'],
            },
          },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{js,jsx}'],
    },
  },
})
