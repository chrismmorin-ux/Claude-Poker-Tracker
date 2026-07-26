/**
 * loader.mjs — WS-273 module loader for the backtest harness.
 *
 * WHY THIS EXISTS. The harness must run the ACTUAL production engine modules —
 * a reimplementation would score a different model and the number would be
 * worthless. But `src/` is written for the Vite bundler and uses extensionless
 * relative imports (`import { ACTIONS } from './gameConstants'`), which plain
 * Node ESM refuses to resolve. Running the harness under `node` alone therefore
 * fails at the first engine import.
 *
 * Rather than fork the engine or rewrite every import, we borrow the resolver
 * the app already uses: a Vite server in middleware mode, loading modules
 * through `ssrLoadModule`. Same resolution rules as the app and the test suite,
 * so the harness cannot silently diverge from what ships.
 *
 * The repo has no `vite-node` binary; this is the same mechanism using only
 * what is already installed.
 */

import { createServer } from 'vite';

/**
 * Open a module loader backed by a Vite SSR server.
 *
 * @param {string} [root=process.cwd()] - repo root
 * @returns {Promise<{ load: (path: string) => Promise<any>, close: () => Promise<void> }>}
 */
export const openLoader = async (root = process.cwd()) => {
  const server = await createServer({
    configFile: false,          // skip the app's plugins (React/PWA) — pure resolution
    root,
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
    logLevel: 'error',
  });

  return {
    /**
     * @param {string} path - repo-root-relative, leading slash (e.g. '/src/utils/x.js')
     */
    load: (path) => server.ssrLoadModule(path),
    close: () => server.close(),
  };
};
