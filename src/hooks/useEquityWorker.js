/**
 * useEquityWorker.js — Re-export from EquityWorkerContext (RT-27)
 *
 * The Worker lifecycle moved to a singleton context provider so that all
 * consumers share a single Worker instance. Import from contexts/ directly
 * for new code; this re-export preserves existing import paths.
 */
export { useEquityWorker } from '../contexts/EquityWorkerContext';
