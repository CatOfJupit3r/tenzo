import { container } from 'tsyringe';

import { registerServices } from '@~/di';
import { LoggerFactory } from '@~/features/logger/logger.factory';

import achievementsLoader from './achievements.loader';
import authLoader from './auth.loader';
import databaseLoader from './database.loader';
import eventsLoader from './events.loader';
import honoLoader from './hono.loader';

const isTest = process.env.NODE_ENV === 'test';
let cachedLoadersPromise: ReturnType<typeof bootstrap> | null = null;

async function bootstrap() {
  await registerServices();

  const logger = isTest ? null : container.resolve(LoggerFactory).global();

  if (logger) logger.info('Registering DI services...');

  logger?.info('DI services registered.');
  logger?.info('Loading database...');
  const db = await databaseLoader();
  logger?.info('Database loaded.');
  logger?.info('Loading authentication...');
  const instance = await authLoader(db);
  logger?.info('Authentication loaded.');
  logger?.info('Loading events...');
  await eventsLoader();
  logger?.info('Events loaded.');
  logger?.info('Loading achievements...');
  await achievementsLoader();
  logger?.info('Achievements loaded.');
  logger?.info('Loading Hono framework...');
  const { app, appRouter } = await honoLoader();

  logger?.info('Hono framework loaded.');
  logger?.info('All loaders completed.');

  return { app, auth: instance, appRouter };
}

export default async function loaders() {
  cachedLoadersPromise ??= bootstrap();
  return cachedLoadersPromise;
}
