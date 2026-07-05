import type { User, Session } from 'better-auth';
import type { Env } from 'hono';

import type { Logger } from './logger';

export type LoggerType = Logger;

export interface iWithLogger {
  logger: LoggerType;
}

/**
 * Request context stored in AsyncLocalStorage
 * This allows propagating request-scoped data (like userId) through the call stack
 * without explicitly passing it through every function.
 */
export interface iRequestContext extends Env {
  Variables: Env['Variables'] & {
    /** The authenticated user's ID, if available */
    userId?: string;
    /** Unique request identifier for tracing */
    requestId?: string;
    /** The session object, if available */
    session?:
      | {
          user: User;
          session: Session;
        }
      | Nil;
  };
}
