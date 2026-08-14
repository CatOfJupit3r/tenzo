export interface iStorageApi {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
}

/** Browser storage adapter for Jotai settings and one-time legacy imports. */
const createMemoryStorage = (): iStorageApi => {
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

export const localStorageApi: iStorageApi = isBrowser ? window.localStorage : createMemoryStorage();

export const sessionStorageApi: iStorageApi = isBrowser ? window.sessionStorage : createMemoryStorage();
