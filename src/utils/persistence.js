/**
 * persistence.js - Backward compatibility re-export
 *
 * This file re-exports from the new modular persistence layer.
 * New code should import directly from './persistence/index.js' or specific modules.
 *
 * @deprecated Import from './persistence/index.js' or specific modules instead
 */

// Re-export everything from the modular persistence layer
export * from './persistence/index.js';
