import { getContext } from 'hono/context-storage';
import winston from 'winston';

import { tryCatch } from '@startername/shared/helpers/std-utils';

import { WINSTON_LOGGER_FORMAT } from './logger.helpers';
import type { iRequestContext } from './logger.types';

interface iLoggerConfig {
  colorize?: boolean;
}

interface iChildLoggerConfig {
  namespace: string;
  parent: Logger;
}

/**
 * Global Winston logger instance - created once and shared across all child loggers.
 * Child loggers inherit from this instance but have their own namespace.
 */
let globalWinstonLogger: winston.Logger | null = null;

function getOrCreateGlobalLogger(colorize: boolean): winston.Logger {
  const isTest = process.env.NODE_ENV === 'test';
  const configuredLevel = process.env.LOG_LEVEL;

  let level: string;
  if (configuredLevel) {
    level = configuredLevel;
  } else if (process.env.NODE_ENV === 'production') {
    level = 'info';
  } else if (isTest) {
    level = 'error';
  } else {
    level = 'debug';
  }

  const shouldSilence = isTest && (configuredLevel === 'silent' || level === 'silent');

  globalWinstonLogger ??= winston.createLogger({
    level: shouldSilence ? 'error' : level,
    silent: shouldSilence,
    format: WINSTON_LOGGER_FORMAT(colorize),
    transports: [new winston.transports.Console({ silent: shouldSilence })],
  });
  return globalWinstonLogger;
}

/**
 * Logger wrapper class that provides namespacing and automatic userId injection.
 *
 * Uses a single global Winston instance for consistency, with child loggers
 * maintaining their own namespace hierarchy.
 *
 * Request context (userId, requestId) is automatically injected via AsyncLocalStorage.
 */
export class Logger {
  private winstonLogger: winston.Logger;

  private namespace: string;

  constructor(config: iLoggerConfig | iChildLoggerConfig) {
    if ('parent' in config) {
      // Child logger - inherit parent's Winston instance
      this.namespace = config.namespace;
      this.winstonLogger = config.parent.getWinstonLogger();
    } else {
      // Root logger - create or get global Winston instance
      const shouldColorize = config.colorize ?? process.env.NODE_ENV !== 'production';
      this.winstonLogger = getOrCreateGlobalLogger(shouldColorize);
      this.namespace = 'global';
    }
  }

  /**
   * Get metadata with request context (userId, requestId) injected automatically.
   */
  private getMetaWithContext(meta?: Record<string, unknown>): Record<string, unknown> {
    const logMeta: Record<string, unknown> = {
      namespace: this.namespace,
      ...meta,
    };

    const { data, error } = tryCatch(() => getContext<iRequestContext>());

    if (!error) {
      const { var: requestContext } = data;

      Object.assign(logMeta, {
        ...(requestContext?.userId && { userId: requestContext.userId }),
        ...(requestContext?.requestId && { requestId: requestContext.requestId }),
      });
    }
    return logMeta;
  }

  /**
   * Get the underlying Winston logger instance.
   * Used internally for creating child loggers.
   */
  public getWinstonLogger(): winston.Logger {
    return this.winstonLogger;
  }

  public error(message: string, meta?: Record<string, unknown>) {
    this.winstonLogger.error(message, this.getMetaWithContext(meta));
  }

  public warn(message: string, meta?: Record<string, unknown>) {
    this.winstonLogger.warn(message, this.getMetaWithContext(meta));
  }

  public info(message: string, meta?: Record<string, unknown>) {
    this.winstonLogger.info(message, this.getMetaWithContext(meta));
  }

  public debug(message: string, meta?: Record<string, unknown>) {
    this.winstonLogger.debug(message, this.getMetaWithContext(meta));
  }

  /**
   * Create a child logger with a sub-namespace.
   * The child inherits the same Winston instance but has its own namespace.
   *
   * @example
   * const mainLogger = loggerFactory.create('api');
   * const childLogger = mainLogger.child('users'); // namespace: 'api:users'
   */
  public child(subNamespace: string): Logger {
    const newNamespace = this.namespace === 'global' ? subNamespace : `${this.namespace}:${subNamespace}`;
    return new Logger({ namespace: newNamespace, parent: this });
  }
}
