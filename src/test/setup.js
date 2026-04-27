/**
 * Vitest test setup file
 * Configures testing environment and extends matchers
 */

import '@testing-library/jest-dom';

// Auto-import fake-indexeddb so any test that touches IDB (initDB, getDB, etc.)
// runs against an in-memory implementation under jsdom.
// Required by MPMF G5-B1 (subscription store v18 migration tests) and other
// IDB-dependent suites that previously had to polyfill manually.
import 'fake-indexeddb/auto';
