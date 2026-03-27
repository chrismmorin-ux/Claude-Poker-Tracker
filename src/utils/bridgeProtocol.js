/**
 * bridgeProtocol.js — App-side bridge protocol constants
 *
 * Single source of truth: ignition-poker-tracker/shared/constants.js
 * Re-exported here so app code imports from the canonical location.
 *
 * Requires the `@extension-shared` alias in vite.config.js
 * (resolves to ignition-poker-tracker/shared/).
 */

export { PROTOCOL_VERSION, BRIDGE_MSG } from '@extension-shared/constants.js';
