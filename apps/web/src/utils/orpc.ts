import { createORPCClient, onError } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient, InferContractRouterOutputs } from '@orpc/contract';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { isError } from 'lodash-es';

import type { CONTRACT } from '@startername/shared';

import { getBackendURL, isOnClient } from './ssr-helpers';

const INTERCEPTORS = [
  onError((error) => {
    if (!isOnClient) return;
    if (isError(error) && error.message.includes('The operation was aborted')) return;
    console.error(error);
  }),
] as ConstructorParameters<typeof RPCLink>[0]['interceptors'];

const getORPCClient = createIsomorphicFn()
  .client((): ContractRouterClient<typeof CONTRACT> => {
    const URL = getBackendURL('/rpc');
    const link = new RPCLink({
      url: URL,
      async fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
      interceptors: INTERCEPTORS,
    });

    return createORPCClient(link);
  })
  .server((): ContractRouterClient<typeof CONTRACT> => {
    const URL = getBackendURL('/rpc');
    const link = new RPCLink({
      url: URL,
      headers: getRequestHeaders,
      interceptors: INTERCEPTORS,
    });
    return createORPCClient(link);
  });
// I don't really want to add oRPC server to here too, so better keep it separate
// .server(() =>
//   createRouterClient(appRouter, {
//     context: async ({ req }) => {
//       return createContext({ context: req });
//     },
//   }),
// )

const client: ContractRouterClient<typeof CONTRACT> = getORPCClient();
export type ORPCOutputs = InferContractRouterOutputs<typeof CONTRACT>;
export default client;
