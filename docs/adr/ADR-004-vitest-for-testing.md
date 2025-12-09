# ADR-004: Use Vitest for Testing

## Status
Accepted

## Date
2024 (v112 - test coverage project)

## Context
The project needed a testing framework that:
- Integrates well with Vite (our build tool)
- Has good React testing support
- Is fast for large test suites
- Has watch mode for development
- Supports coverage reporting

Options considered:
1. Jest - Industry standard, most documentation
2. Vitest - Vite-native, Jest-compatible API
3. Testing Library alone - Lightweight but limited

## Decision
Use **Vitest** as the test runner with:
- `@testing-library/react` for component testing
- `@testing-library/jest-dom` for DOM matchers
- `fake-indexeddb` for database mocking
- `jsdom` for browser environment simulation
- `@vitest/coverage-v8` for coverage reports

Configuration in `vite.config.js`:
```javascript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.js',
  include: ['src/**/*.{test,spec}.{js,jsx}'],
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html'],
  },
}
```

## Alternatives Considered

### Jest
- **Pros**: Most widely used, huge ecosystem, excellent docs
- **Cons**: Requires additional config with Vite, slower, separate transform step

### Testing Library only
- **Pros**: Simple, focused on user behavior
- **Cons**: No test runner, no watch mode, no coverage

## Consequences

### Positive
- Native Vite integration (same transform, fast HMR)
- Jest-compatible API (familiar patterns, easy migration)
- Fast execution (~20 seconds for 2200 tests)
- Watch mode updates instantly on file changes
- Coverage reports in text and HTML formats
- ESM support out of the box

### Negative
- Less ecosystem/plugins than Jest
- Some Jest plugins don't work
- Newer, less battle-tested

### Current Test Stats
- 75 test files
- 2,221 tests
- ~90% code coverage
- ~21 second full run

## Test Organization
```
src/
├── test/
│   ├── setup.js          # Global setup (jest-dom)
│   ├── utils.js          # Test utilities and factories
│   └── schema-validation.test.js  # Schema drift tests
├── reducers/__tests__/   # Reducer tests
├── hooks/__tests__/      # Hook tests
├── utils/__tests__/      # Utility tests
├── contexts/__tests__/   # Context tests
├── components/
│   ├── ui/__tests__/     # UI component tests
│   └── views/__tests__/  # View component tests
└── storage/__tests__/    # Storage layer tests
```

## References
- v112 test coverage project
- `vite.config.js` test configuration
- `src/test/utils.js` test utilities
- Vitest documentation
