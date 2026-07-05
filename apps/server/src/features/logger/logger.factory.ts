import { singleton } from 'tsyringe';

import { Logger } from './logger';

/**
 * Factory for creating loggers with namespaces.
 *
 * Uses a single global Logger instance and creates child loggers
 * with proper namespace inheritance.
 *
 * @example
 * const factory = container.resolve(LoggerFactory);
 * const apiLogger = factory.create('api');        // namespace: 'api'
 * const usersLogger = apiLogger.child('users');   // namespace: 'api:users'
 */
@singleton()
export class LoggerFactory {
  private readonly instance: Logger;

  constructor() {
    this.instance = new Logger({
      colorize: process.env.NODE_ENV !== 'production',
    });
  }

  /**
   * Create a new logger with the given namespace.
   * Returns a Logger instance that properly maintains the namespace.
   */
  public create(namespace: string): Logger {
    return this.instance.child(namespace);
  }

  /**
   * Get the root global logger instance.
   * Prefer using create() with a namespace for better log organization.
   */
  public global(): Logger {
    return this.instance;
  }
}
