// sort-imports-ignore
// Import connection first to ensure mongoose is connected before we load the app
import './connection';
import loaders from '../../src/loaders';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Tests should be run in test environment');
}

type LoadedApp = Awaited<ReturnType<typeof loaders>>;

let cachedLoader: Promise<LoadedApp> | null = null;

async function loadOnce() {
  if (!cachedLoader) {
    cachedLoader = loaders();
  }
  return cachedLoader;
}

export async function resetAppCache() {
  cachedLoader = null;
}

const { app, appRouter, auth } = await loadOnce();

export { app, appRouter, auth, loadOnce as getTestApp };
