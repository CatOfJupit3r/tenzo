import { tsyringe } from '@hono/tsyringe';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins';
import { onError } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import { ZodToJsonSchemaConverter } from '@orpc/zod';
import { Hono } from 'hono';
import type { Context as HonoContext } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { isEmpty } from 'lodash-es';
import { stringify } from 'safe-stable-stringify';
import { container } from 'tsyringe';

import env from '@~/constants/env';
import { AuthService } from '@~/features/auth/auth.service';
import { LoggerFactory } from '@~/features/logger/logger.factory';
import { requestContextMiddleware } from '@~/features/logger/logger.middleware';
import type { iRequestContext } from '@~/features/logger/logger.types';
import { appRouter } from '@~/routers';
import nonContractRouter from '@~/routers/non-contract.router';

interface iCreateContextOptions {
  context: HonoContext<iRequestContext>;
}

function contextGenerator() {
  return async function createContext({ context }: iCreateContextOptions) {
    const session = context.get('session');
    // eslint-disable-next-line @typescript-eslint/prefer-destructuring
    const resolve = context.var.resolve;
    return {
      session,
      resolve,
    };
  };
}

function shouldLogError(_error: unknown) {
  // Add logic to determine if the error should be logged
  return false;
}

export type Context = Awaited<ReturnType<ReturnType<typeof contextGenerator>>>;

export default async function honoLoader() {
  const app = new Hono<iRequestContext>();

  const auth = container.resolve(AuthService).getInstance();
  const apiLogger = container.resolve(LoggerFactory).create('API');

  const createContext = contextGenerator();

  // Request-scoped DI container - creates a child container per request
  app.use('/*', tsyringe());
  app.use('/*', requestContextMiddleware);

  app.use(contextStorage());
  app.use(
    logger((msg, ...info) => {
      const meta = isEmpty(info) ? undefined : { info };
      apiLogger.debug(msg, meta);
    }),
  );
  app.use(
    '/*',
    cors({
      origin: env.CORS_ORIGIN,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  );
  app.on(['POST', 'GET'], '/auth/*', async (c) => auth.handler(c.req.raw));

  app.route('/', nonContractRouter);

  const apiHandler = new OpenAPIHandler(appRouter, {
    plugins: [
      new OpenAPIReferencePlugin({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      }),
    ],
    interceptors: [
      onError((error) => {
        if (!shouldLogError(error)) return;
        apiLogger.error(stringify(error) ?? 'Unknown API error');
      }),
    ],
  });

  const rpcHandler = new RPCHandler(appRouter, {
    interceptors: [
      onError((error) => {
        if (!shouldLogError(error)) return;
        apiLogger.error(stringify(error) ?? 'Unknown RPC error');
      }),
    ],
  });

  app.use('/*', async (c, next) => {
    const context = await createContext({ context: c });

    const apiResult = await apiHandler.handle(c.req.raw, {
      context,
    });

    if (apiResult.matched) {
      return c.newResponse(apiResult.response.body, apiResult.response);
    }

    const rpcResult = await rpcHandler.handle(c.req.raw, {
      prefix: '/rpc',
      context,
    });

    if (rpcResult.matched) {
      return c.newResponse(rpcResult.response.body, rpcResult.response);
    }

    return next();
  });

  app.get('/', (c) => c.text('OK'));

  return { app, appRouter };
}
