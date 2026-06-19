import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

// Build identity — baked into the bundle (the running version's truth) AND written to
// dist/version.json on every build, so local `npm run deploy` carries a fresh stamp the
// app can check against (previously only CI stamped version.json — local deploys had none).
// CI's deploy step overwrites version.json with github.sha after build; same shape, consistent.
// Full SHA so it matches CI's version.json (github.sha is the full 40-char SHA).
const BUILD_SHA = (() => {
  try { return execSync('git rev-parse HEAD').toString().trim(); }
  catch { return 'local'; }
})();
const BUILD_TIME = new Date().toISOString();

const stampVersionJson = () => ({
  name: 'stamp-version-json',
  apply: 'build',
  writeBundle() {
    writeFileSync(
      resolve(__dirname, 'dist/version.json'),
      JSON.stringify({ version: BUILD_SHA, built: BUILD_TIME }),
    );
  },
});

export default defineConfig({
  resolve: {
    alias: {
      '@extension-shared': resolve(__dirname, 'ignition-poker-tracker/shared'),
    },
  },
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
        // 'any' so player editor / picker / profile / sighting modal can
        // render in portrait when the phone is held portrait. TableView is
        // still designed at 1600×720 landscape but the manifest no longer
        // forces orientation. Owner: 2026-05-05.
        orientation: 'any',
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
    stampVersionJson(),
  ],
  define: {
    __BUILD_SHA__: JSON.stringify(BUILD_SHA),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/firebase/')) return 'firebase'
          if (id.includes('/src/utils/exploitEngine/')) return 'exploitEngine'
        },
      },
    },
  },
  server: {
    host: true,
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: './src/test/setup.js',
    env: {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'test-project',
      VITE_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '0',
      VITE_FIREBASE_APP_ID: 'test-app-id',
      VITE_FIREBASE_MEASUREMENT_ID: 'test-measurement-id',
    },
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
            'src/test/**/*.test.js',
            'scripts/__tests__/**/*.test.{js,cjs}',
          ],
          // Slow CPU-bound equity-enumeration tests live in the
          // `slow-unit` project below — they need a dedicated process
          // to fit within their per-test timeouts. Excluding them here
          // prevents the thread-pool from co-running them with peers
          // and starving them of CPU. See SPR-089 fix.
          exclude: [
            'src/utils/drillContent/__tests__/frameworkValidator.test.js',
            'src/utils/drillContent/__tests__/matchupShapeRouting.test.js',
            'src/utils/drillContent/__tests__/precisionAudit.test.js',
            'src/utils/drillContent/__tests__/shapesCatalog.test.js',
          ],
          pool: 'threads',
          poolOptions: { threads: { maxThreads: 4 } },
          testTimeout: 5000,
        },
      },
      {
        // Slow-unit project — CPU-bound equity-enumeration tests over
        // src/utils/drillContent/. These iterate ~150–400 (hero, villain)
        // pairs through preflop-equity enumeration; per-test cold runtimes
        // are 5–15 minutes. The regular `unit` project's `pool: threads,
        // maxThreads: 4` causes them to time-out under co-runner CPU
        // contention even when they'd pass cleanly in isolation.
        //
        // This project pins them to `pool: forks, maxForks: 1` so each
        // file runs in its own dedicated Node process, in sequence —
        // no thread-pool sharing, no cross-file contention.
        //
        // If you author a new slow drillContent equity test, add it here
        // AND to the exclude list above.
        extends: true,
        test: {
          name: 'slow-unit',
          environment: 'node',
          include: [
            'src/utils/drillContent/__tests__/frameworkValidator.test.js',
            'src/utils/drillContent/__tests__/matchupShapeRouting.test.js',
            'src/utils/drillContent/__tests__/precisionAudit.test.js',
            'src/utils/drillContent/__tests__/shapesCatalog.test.js',
          ],
          pool: 'forks',
          poolOptions: { forks: { maxForks: 1 } },
          // Inline per-test timeouts in these files (300_000–900_000ms)
          // already override this project default; this floor is the
          // safety net if a new test in this set forgets the inline arg.
          testTimeout: 1800000,
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
            'src/hooks/__tests__/**/*.test.jsx',
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
