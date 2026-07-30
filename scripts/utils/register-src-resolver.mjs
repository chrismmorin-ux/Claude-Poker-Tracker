/**
 * register-src-resolver.mjs — entry point for the extensionless resolve hooks.
 *
 * Kept separate from the hooks themselves because `register()` runs on the main
 * thread while the hooks module is loaded on a dedicated hooks thread; a module that
 * registers itself would re-enter.
 *
 * Usage:
 *   node --import ./scripts/utils/register-src-resolver.mjs scripts/<script>.mjs
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./extensionless-resolver.mjs', pathToFileURL(import.meta.filename));
