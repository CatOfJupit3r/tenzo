import { createIsomorphicFn } from '@tanstack/react-start';

import { clientAbsoluteLink } from './client-absolute-link';

export const isOnClient = typeof window !== 'undefined';

export type BrowserStorageKind = 'local' | 'session';

export function getBrowserStorage(kind: BrowserStorageKind): Storage | null {
  if (!isOnClient) {
    return null;
  }

  return kind === 'local' ? window.localStorage : window.sessionStorage;
}

export function createBrowserObjectUrl(blob: Blob): string | null {
  return isOnClient ? URL.createObjectURL(blob) : null;
}

export function revokeBrowserObjectUrl(objectUrl: string | null) {
  if (objectUrl && isOnClient) {
    URL.revokeObjectURL(objectUrl);
  }
}

export const getBackendURL = createIsomorphicFn()
  .client((path: string) => clientAbsoluteLink(`/api${path ?? ''}`))
  .server((path: string) => `${process.env.VITE_SERVER_URL}${path ?? ''}`);
