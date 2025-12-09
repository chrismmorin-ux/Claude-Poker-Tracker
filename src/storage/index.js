/**
 * Storage Module - Central Export
 *
 * Provides storage abstraction layer for the Poker Tracker application.
 *
 * Architecture:
 *   IStorage (interface) -> IndexedDBStorage (implementation)
 *                        -> CloudStorage (future)
 *                        -> MockStorage (testing)
 *
 * Usage:
 *   // Setup in main app
 *   import { StorageProvider, indexedDBStorage } from './storage';
 *   <StorageProvider storage={indexedDBStorage}>...</StorageProvider>
 *
 *   // Use in components
 *   import { useStorage } from './storage';
 *   const storage = useStorage();
 *   await storage.getAllHands();
 */

// Interface definition
export { IStorage } from './IStorage';

// IndexedDB implementation
export { IndexedDBStorage, indexedDBStorage } from './IndexedDBStorage';

// React context and hooks
export { StorageProvider, useStorageContext, useStorage } from './StorageProvider';
