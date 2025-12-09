/**
 * StorageProvider.jsx - React Context Provider for Storage
 *
 * Provides storage implementation to the component tree via React Context.
 * Allows swapping storage backends (IndexedDB, cloud, mock) without changing components.
 *
 * Usage:
 *   // In App.jsx
 *   import { StorageProvider } from './storage';
 *   import { indexedDBStorage } from './storage';
 *
 *   <StorageProvider storage={indexedDBStorage}>
 *     <App />
 *   </StorageProvider>
 *
 *   // In components
 *   import { useStorage } from './storage';
 *
 *   function MyComponent() {
 *     const storage = useStorage();
 *     const hands = await storage.getAllHands();
 *   }
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { indexedDBStorage } from './IndexedDBStorage';

// Create context with null default (will be provided by StorageProvider)
const StorageContext = createContext(null);

/**
 * StorageProvider component
 *
 * @param {Object} props
 * @param {IStorage} props.storage - Storage implementation to use
 * @param {React.ReactNode} props.children - Child components
 */
export function StorageProvider({ storage = indexedDBStorage, children }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await storage.initialize();
        if (mounted) {
          setIsReady(true);
        }
      } catch (err) {
        if (mounted) {
          setError(err);
          console.error('Storage initialization failed:', err);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [storage]);

  // Provide context value
  const value = {
    storage,
    isReady,
    error,
  };

  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  );
}

/**
 * Hook to access storage from context
 *
 * @returns {Object} Storage context value containing:
 *   - storage: The IStorage implementation
 *   - isReady: Whether storage is initialized
 *   - error: Any initialization error
 */
export function useStorageContext() {
  const context = useContext(StorageContext);

  if (context === null) {
    throw new Error('useStorageContext must be used within a StorageProvider');
  }

  return context;
}

/**
 * Convenience hook to get just the storage instance
 * Throws if storage is not ready yet
 *
 * @returns {IStorage} The storage implementation
 */
export function useStorage() {
  const { storage, isReady, error } = useStorageContext();

  if (error) {
    throw error;
  }

  // Note: We return storage even if not ready, since components
  // may want to use it with their own loading states
  return storage;
}

export default StorageProvider;
