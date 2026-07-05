import type { StorageApi } from '@tanstack/react-db';

/**
 * TanStack DB's localStorage collections read/write synchronously at creation
 * time. Because this app is server-rendered (TanStack Start), `window` is not
 * available during SSR, so we hand collections a no-op in-memory store on the
 * server and the real `localStorage`/`sessionStorage` in the browser.
 */
const createMemoryStorage = (): StorageApi => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
};

const isBrowser = typeof window !== 'undefined';

export const localStorageApi: StorageApi = isBrowser ? window.localStorage : createMemoryStorage();

export const sessionStorageApi: StorageApi = isBrowser ? window.sessionStorage : createMemoryStorage();
