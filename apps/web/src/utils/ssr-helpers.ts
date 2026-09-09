import { createIsomorphicFn } from '@tanstack/react-start';
import { em } from 'enumwaii';

import { clientAbsoluteLink } from './client-absolute-link';

export const BROWSER_STORAGE_KINDS_ENUM = em(['LOCAL', 'SESSION']);
export const BROWSER_STORAGE_KINDS = BROWSER_STORAGE_KINDS_ENUM.enum;

export const isOnClient = typeof window !== 'undefined';

export type BrowserStorageKind = (typeof BROWSER_STORAGE_KINDS_ENUM)['~type'];

export function getBrowserStorage(kind: BrowserStorageKind): Storage | null {
  if (!isOnClient) {
    return null;
  }

  return kind === BROWSER_STORAGE_KINDS.LOCAL ? window.localStorage : window.sessionStorage;
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
