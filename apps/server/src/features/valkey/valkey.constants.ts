/**
 * Cache TTL (Time To Live) constants in seconds
 *
 * Use these constants to ensure consistent cache expiration across the application.
 * Adjust values based on your data freshness requirements.
 */
export const CACHE_TTL = {
  /** Static data that rarely changes during runtime (1 hour) */
  STATIC: 3600,

  /** Lists with pagination - short duration (30 seconds) */
  LIST_SHORT: 30,

  /** Lists with pagination - medium duration (1 minute) */
  LIST_MEDIUM: 60,

  /** Single entity by ID - short duration (2 minutes) */
  ENTITY_SHORT: 120,

  /** Single entity by ID - medium duration (5 minutes) */
  ENTITY_MEDIUM: 300,

  /** Expensive aggregations - medium duration (5 minutes) */
  AGGREGATION_MEDIUM: 300,

  /** Expensive aggregations - long duration (10 minutes) */
  AGGREGATION_LONG: 600,

  /** User-specific data (1 minute) */
  USER_DATA: 60,
} as const;

/**
 * Cache key prefixes for consistent naming
 *
 * Add your domain-specific prefixes here. Using prefixes allows for:
 * - Pattern-based invalidation (e.g., invalidate all user caches)
 * - Clear cache key organization
 * - Avoiding key collisions between features
 *
 * @example Add your own prefixes:
 * ```typescript
 * export const CACHE_PREFIX = {
 *   ...CACHE_PREFIX,
 *   ORDERS: 'orders',
 *   ORDERS_LIST: 'orders:list',
 *   PRODUCTS: 'products',
 * } as const;
 * ```
 */
export const CACHE_PREFIX = {
  /** User-related cache */
  USER: 'user',
  /** Session-related cache */
  SESSION: 'session',
  /** Generic entity cache */
  ENTITY: 'entity',
  /** Generic list cache */
  LIST: 'list',
  /** Aggregation/stats cache */
  STATS: 'stats',
  /** Badges cache */
  BADGES: 'badges',
  /** Achievements cache */
  ACHIEVEMENTS: 'achievements',
} as const;

/**
 * Helper to build cache keys consistently
 *
 * This object provides type-safe functions to generate cache keys.
 * Add your own key builders as your domain grows.
 *
 * @example Usage:
 * ```typescript
 * const key = buildCacheKey.user(userId);
 * const cached = await valkeyService.cached(key, CACHE_TTL.USER_DATA, () => fetchUser(userId));
 * ```
 *
 * @example Extend with your own builders:
 * ```typescript
 * // In your feature file
 * export const buildOrderCacheKey = {
 *   order: (orderId: string) => `${CACHE_PREFIX.ORDERS}:${orderId}`,
 *   orderList: (userId: string, page: number) => `${CACHE_PREFIX.ORDERS}:${userId}:list:${page}`,
 * } as const;
 * ```
 */
export const buildCacheKey = {
  /** Build cache key for user profile */
  userProfile: (userId: string) => `${CACHE_PREFIX.USER}:${userId}:profile`,

  /** Build cache key for user-specific data */
  userData: (userId: string, dataType: string) => `${CACHE_PREFIX.USER}:${userId}:${dataType}`,

  /** Build cache key for a generic entity */
  entity: (entityType: string, entityId: string) => `${CACHE_PREFIX.ENTITY}:${entityType}:${entityId}`,

  /** Build cache key for a paginated list */
  list: (entityType: string, limit: number, offset: number) => `${CACHE_PREFIX.LIST}:${entityType}:${limit}:${offset}`,

  /** Build cache key for a user-scoped paginated list */
  userList: (userId: string, entityType: string, limit: number, offset: number) =>
    `${CACHE_PREFIX.LIST}:${userId}:${entityType}:${limit}:${offset}`,

  /** Build cache key for stats/aggregations */
  stats: (statType: string, ...params: string[]) =>
    `${CACHE_PREFIX.STATS}:${statType}${params.length > 0 ? `:${params.join(':')}` : ''}`,

  /** Build cache key for all badges list (static) */
  badges: () => `${CACHE_PREFIX.BADGES}:all`,

  /** Build cache key for all achievements list (static) */
  achievements: () => `${CACHE_PREFIX.ACHIEVEMENTS}:all`,

  /** Build cache key for user's unlocked achievements */
  userAchievements: (userId: string) => `${CACHE_PREFIX.USER}:${userId}:achievements`,
} as const;
