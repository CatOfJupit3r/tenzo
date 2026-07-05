import Redis from 'ioredis';
import { isNil } from 'lodash-es';
import { singleton } from 'tsyringe';

import { tryCatch } from '@startername/shared/helpers/std-utils';

import env from '@~/constants/env';

import { LoggerFactory } from '../logger/logger.factory';
import type { iWithLogger, LoggerType } from '../logger/logger.types';

@singleton()
export class ValkeyService implements iWithLogger {
  public readonly logger: LoggerType;

  private client: Redis | Nil = null;

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.create('valkey');
  }

  public async connect() {
    if (this.client) return this.client;
    if (env.NODE_ENV === 'test') {
      this.logger.info('Valkey connection skipped in test environment');
      return null;
    }

    this.client = new Redis({
      host: env.VALKEY_HOST,
      port: env.VALKEY_PORT,
      username: env.VALKEY_USERNAME,
      password: env.VALKEY_PASSWORD,
      db: env.VALKEY_DB,
    });

    this.client.on('error', (error) => {
      this.logger.error('Valkey connection error', { error });
    });

    this.client.on('connect', () => {
      this.logger.info('Valkey connected');
    });

    await this.client.ping();
    return this.client;
  }

  public getClient() {
    if (!this.client) throw new Error('Valkey client is not connected');
    return this.client;
  }

  public async disconnect() {
    if (!this.client) return;
    await this.client.quit();
    this.client = null;
  }

  /**
   * Get cached data by key
   * @param key Cache key
   * @returns Parsed data or null if not found
   */
  public async cacheGet<T>(key: string): Promise<T | Nil> {
    if (!this.client) return null;

    const { data, error } = await tryCatch(async () => {
      const cached = await this.client?.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as T;
    });

    if (error) {
      this.logger.warn('Cache get failed', { key, error });
      return null;
    }
    return data;
  }

  /**
   * Set cached data with TTL
   * @param key Cache key
   * @param value Data to cache (will be JSON stringified)
   * @param ttlSeconds Time to live in seconds
   */
  public async cacheSet<T>(key: string, value: T, ttlSeconds: number) {
    if (!this.client) return;

    const { error } = await tryCatch(async () => {
      await this.client?.setex(key, ttlSeconds, JSON.stringify(value));
    });

    if (error) {
      this.logger.warn('Cache set failed', { key, error });
    }
  }

  /**
   * Delete cached data by key
   * @param key Cache key
   */
  public async cacheDel(key: string) {
    if (!this.client) return;

    const { error } = await tryCatch(async () => {
      await this.client?.del(key);
    });

    if (error) {
      this.logger.warn('Cache delete failed', { key, error });
    }
  }

  /**
   * Invalidate all keys matching a pattern
   * @param pattern Redis pattern (e.g., "user:*", "entity:123:*")
   *
   * @example Invalidate all user caches:
   * ```typescript
   * await valkeyService.invalidatePattern('user:*');
   * ```
   *
   * @example Invalidate specific entity's related caches:
   * ```typescript
   * await valkeyService.invalidatePattern(`entity:${entityId}:*`);
   * ```
   */
  public async invalidatePattern(pattern: string) {
    if (!this.client) return;

    const { error } = await tryCatch(async () => {
      let cursor = '0';
      let totalDeleted = 0;

      // Use SCAN instead of KEYS to avoid blocking the server
      do {
        if (!this.client) break;

        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          await this.client.del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== '0');

      if (totalDeleted > 0) {
        this.logger.debug('Invalidated cache keys', { pattern, count: totalDeleted });
      }
    });

    if (error) {
      this.logger.warn('Cache pattern invalidation failed', { pattern, error });
    }
  }

  /**
   * Cache-aside pattern wrapper
   *
   * Checks cache first, falls back to fetcher if miss, then populates cache.
   * This is the recommended way to use caching in most cases.
   *
   * @param key Cache key
   * @param ttlSeconds Time to live in seconds
   * @param fetcher Function to fetch data on cache miss
   * @returns Cached or freshly fetched data
   *
   * @example Basic usage:
   * ```typescript
   * const user = await valkeyService.cached(
   *   buildCacheKey.userProfile(userId),
   *   CACHE_TTL.USER_DATA,
   *   () => userService.findById(userId)
   * );
   * ```
   *
   * @example With dependencies:
   * ```typescript
   * const stats = await valkeyService.cached(
   *   buildCacheKey.stats('dashboard', organizationId),
   *   CACHE_TTL.AGGREGATION_MEDIUM,
   *   () => computeExpensiveStats(organizationId)
   * );
   * ```
   */
  public async cached<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.cacheGet<T>(key);
    if (!isNil(cached)) return cached;

    const data = await fetcher();
    await this.cacheSet(key, data, ttlSeconds);
    return data;
  }
}
