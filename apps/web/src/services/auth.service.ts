import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { getBackendURL } from '@~/utils/ssr-helpers';

export const getAuthHeaders = createIsomorphicFn()
  .client(() => ({}))
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  .server(() => getRequestHeaders());

const createAuthInstance = () =>
  createAuthClient({
    plugins: [usernameClient()],
    baseURL: getBackendURL('/auth'),
    fetchOptions: {
      throw: true,
    },
  });

class AuthService {
  private authInstance;

  constructor() {
    this.authInstance = createAuthInstance();
  }

  public async getSession() {
    return this.authInstance.getSession({ fetchOptions: { throw: true, headers: getAuthHeaders() } });
  }

  public getInstance() {
    return this.authInstance;
  }
}

export type InternalAuthSession = AuthService['authInstance']['$Infer']['Session'];

export default new AuthService();
