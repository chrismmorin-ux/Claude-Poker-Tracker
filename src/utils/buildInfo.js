/* global __BUILD_SHA__, __BUILD_TIME__ */
/**
 * buildInfo.js — the identity of the bundle that is ACTUALLY running.
 *
 * `__BUILD_SHA__` / `__BUILD_TIME__` are replaced at build time by Vite `define`
 * (see vite.config.js). Unlike a /version.json fetch (which reports the SERVER's
 * latest), these are compiled INTO the bundle — so they tell you what build is
 * loaded right now, which is the only way to detect a stale cached app.
 *
 * `typeof` guards keep this safe in test runs where the define isn't applied.
 */
export const BUILD_SHA = typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : 'dev';
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;
