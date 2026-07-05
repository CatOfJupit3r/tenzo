import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { getBackendURL } from '@~/utils/ssr-helpers';

const getInitialAuthHeaders = createIsomorphicFn()
  .client(() => ({}) as Record<string, string>)
  .server(getRequestHeaders);

const authInstance = createAuthClient({
  plugins: [usernameClient()],
  baseURL: getBackendURL('/auth'),
  fetchOptions: {
    throw: true,
    headers: getInitialAuthHeaders(),
  },
});

class AuthService {
  public async getSession() {
    return authInstance.getSession({ fetchOptions: { throw: true } });
  }

  public getInstance() {
    return authInstance;
  }
}

export type InternalAuthSession = (typeof authInstance)['$Infer']['Session'];

export default new AuthService();
