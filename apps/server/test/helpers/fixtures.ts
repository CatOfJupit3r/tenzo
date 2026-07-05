import { container } from '../../src/di/container';
import { getTestApp, resetAppCache } from './instance';

export async function getIntegrationFixtures() {
  const { app, appRouter, auth } = await getTestApp();
  return { app, appRouter, auth };
}

export function resetContainer() {
  container.reset();
}

export async function resetIntegrationState() {
  resetContainer();
  await resetAppCache();
}
