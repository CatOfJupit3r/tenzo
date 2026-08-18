import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';

import { ErrorBoundary } from './components/error-boundary';
import { NotFound } from './components/not-found';
import PseudoPage from './components/pseudo-page';
import { INTERVALS } from './constants/dates';
import { loggerFactory } from './lib/logging/logger';
import { routeTree } from './routeTree.gen';

const ROUTER_LOGGER = loggerFactory.getLogger('router');
const QUERY_LOGGER = loggerFactory.getLogger('react-query');

function getOperationIdentifier(key: readonly unknown[] | undefined) {
  const candidate = key?.[0];

  if (typeof candidate === 'string') return candidate.slice(0, 120);
  if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);

  return undefined;
}

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
    queryCache: new QueryCache({
      onError: (error, query) => {
        const operation = getOperationIdentifier(query.queryKey);
        QUERY_LOGGER.error('Query failed', error, operation ? { operation } : undefined);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _onMutateResult, mutation) => {
        const operation = getOperationIdentifier(mutation.options.mutationKey);
        QUERY_LOGGER.error('Mutation failed', error, operation ? { operation } : undefined);
      },
    }),
  });

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    context: { queryClient },
    defaultPendingComponent: PseudoPage,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: ErrorBoundary,
    defaultOnCatch: (error, errorInfo) => {
      const componentStack = errorInfo.componentStack?.trim();
      ROUTER_LOGGER.error(
        'Router caught an error',
        error,
        componentStack ? { componentStack: componentStack.slice(0, 2_000) } : undefined,
      );
    },
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
