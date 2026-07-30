/**
 * extensionless-resolver.mjs — resolve hooks that let plain Node import `src/`.
 *
 * Everything under `src/` is written for Vite, which resolves extensionless relative
 * specifiers (`import { clamp } from '../mathUtils'`). Node does not — that resolution
 * went away with `--experimental-specifier-resolution` in Node 20 — so a codegen script
 * that wants to reuse production code cannot simply import it.
 *
 * DEV-ONLY tooling for `scripts/`: nothing here ships, and nothing in `src/` depends
 * on it. Loaded via `scripts/utils/register-src-resolver.mjs`, never directly.
 *
 * The alternative was adding `vite-node` as a devDependency (it is NOT a vitest 4
 * dependency, so it would be a genuinely new one) or reimplementing the hand evaluator
 * inside the generator. The second is the real hazard: a second evaluator can silently
 * drift from the one the app uses, which would make generated tables wrong in a way no
 * test would catch. Reusing production code is the whole point.
 */

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) throw err;
    // The two candidates Vite would try, in its order.
    for (const candidate of [`${specifier}.js`, `${specifier}/index.js`]) {
      try {
        return await nextResolve(candidate, context);
      } catch { /* try the next candidate */ }
    }
    throw err;
  }
}
