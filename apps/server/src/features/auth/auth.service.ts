import type { mongoose } from '@typegoose/typegoose';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { username } from 'better-auth/plugins';
import type Redis from 'ioredis';
import { isNil } from 'lodash-es';
import { singleton } from 'tsyringe';

import env from '@~/constants/env';

import type { EventBus } from '../events/event-bus';
import { UserAfterRegisteredListener } from '../events/listeners/user.listeners';
import { LoggerFactory } from '../logger/logger.factory';
import type { iWithLogger, LoggerType } from '../logger/logger.types';
import { devImpersonatePlugin } from './better-auth-plugins/dev-impersonate.plugin';

const createInstance = (db: mongoose.mongo.Db, logger: LoggerType, valkey: Redis | Nil, eventBus: EventBus) =>
  betterAuth({
    // @ts-expect-error - ignore for now
    database: mongodbAdapter(db),
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.CORS_ORIGIN ?? ''],
    plugins: [username(), devImpersonatePlugin()],
    secondaryStorage: !isNil(valkey)
      ? {
          get: async (key) => valkey.get(key),
          set: async (key, value, ttl) => {
            if (ttl) await valkey.set(key, value, 'EX', ttl);
            else await valkey.set(key, value);
          },
          delete: async (key) => {
            await valkey.del(key);
          },
        }
      : undefined,
    emailAndPassword: {
      enabled: true,
    },
    telemetry: {
      enabled: false,
    },
    basePath: '/auth',
    advanced: {
      defaultCookieAttributes: {
        sameSite: 'none',
        secure: true,
        httpOnly: true,
      },
    },
    experimental: {
      joins: true,
    },
    databaseHooks: {
      user: {
        create: {
          async after(user) {
            await eventBus.emit(UserAfterRegisteredListener, { userId: user.id });
          },
        },
      },
    },
  });

@singleton()
export class AuthService implements iWithLogger {
  public readonly logger: iWithLogger['logger'];

  private instance: ReturnType<typeof createInstance> | null = null;

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.create('auth');
  }

  public connect(db: mongoose.mongo.Db, valkey: Redis | Nil, eventBus: EventBus) {
    this.instance = createInstance(db, this.logger, valkey, eventBus);
  }

  public getInstance() {
    if (!this.instance) throw new Error('AuthService not initialized. Call connect() first.');

    return this.instance;
  }
}
