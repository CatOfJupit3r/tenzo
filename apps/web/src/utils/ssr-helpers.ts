import { createIsomorphicFn } from '@tanstack/react-start';

import { clientAbsoluteLink } from './client-absolute-link';

export const isOnClient = typeof window !== 'undefined';

export const getBackendURL = createIsomorphicFn()
  .client((path: string) => clientAbsoluteLink(`/api${path ?? ''}`))
  .server((path: string) => `${process.env.VITE_SERVER_URL}${path ?? ''}`);
