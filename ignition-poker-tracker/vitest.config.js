import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['shared/__tests__/**/*.test.js', 'side-panel/__tests__/**/*.test.js'],
    exclude: ['dist/**'],
  },
});
