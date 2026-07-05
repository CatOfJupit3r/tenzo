// sort-imports-ignore
import 'reflect-metadata';
import { serve } from '@hono/node-server';

import env from './constants/env';
import loaders from './loaders';

if (process.env.NODE_ENV === 'test') {
  throw new Error('Server should not be started in test environment');
}

const { app } = await loaders();

const server = serve(
  {
    fetch: app.fetch,
    port: env.SERVER_PORT,
    hostname: env.SERVER_HOST,
  },
  (info) => {
    console.log(`CDN server listening on http://${info.address}:${info.port}`);
  },
);

const shutdown: NodeJS.SignalsListener = (signal) => {
  console.log(`Received ${signal}, performing shutdown tasks...`);
  server.close();
  console.log('Server closed.');
  // eslint-disable-next-line n/no-process-exit
  process.exit(0);
};

const SIGNALS = ['SIGINT', 'SIGTERM'] as const;

SIGNALS.forEach((signal) => process.on(signal, shutdown));
