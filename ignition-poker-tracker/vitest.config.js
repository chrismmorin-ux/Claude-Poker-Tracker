import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `background/` was absent from this list until 2026-08-21, so the service
    // worker — the hub every port and every push goes through — had no test
    // coverage at all. The stale-disconnect clobber in its onDisconnect handlers
    // lived there undetected as a result.
    include: [
      'shared/__tests__/**/*.test.js',
      'side-panel/__tests__/**/*.test.js',
      'background/__tests__/**/*.test.js',
      'test/replay/**/*.test.js',
    ],
    exclude: ['dist/**'],
  },
});
