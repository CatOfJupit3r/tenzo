import { QueryCache, QueryClient } from '@tanstack/react-query';
import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';

import { ErrorBoundary } from './components/error-boundary';
import { NotFound } from './components/not-found';
import PseudoPage from './components/pseudo-page';
import { INTERVALS } from './constants/dates';
import { routeTree } from './routeTree.gen';
import { tanstackRPC } from './utils/tanstack-orpc';

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // stale time indicates how long a query can be cached for before it's considered stale
        staleTime: INTERVALS.FIVE_MINUTES, // 5 minutes
        // retry attempts indicates how many times a query can be retried before it's considered failed
        retry: 2,
        // retryDelayTime indicates how long to wait before retrying a query
        retryDelay: 1000,
        // refetchInterval indicates how long to keep a query in cache before checking with the server
        refetchInterval: INTERVALS.THIRTY_MINUTES, // 30 minutes
      },
    },
    queryCache: new QueryCache(),
  });

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    context: { tanstackRPC, queryClient },
    defaultPendingComponent: PseudoPage,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: ErrorBoundary,
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
};

declare module '@tanstack/react-router' {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
