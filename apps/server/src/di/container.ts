import 'reflect-metadata';
import { container } from 'tsyringe';

export { container };

/**
 * Initialize the DI container.
 *
 * Classes decorated with @singleton() are globally shared.
 * Classes decorated with @injectable() are request-scoped when resolved
 * from a child container (via @hono/tsyringe middleware).
 *
 * Note: With emitDecoratorMetadata enabled, tsyringe automatically resolves
 * constructor dependencies from their types. No tokens needed for concrete classes.
 */
export async function registerServices() {
  // Import services to trigger decorator registration
  // Dynamic imports avoid circular dependencies at startup
  await import('@~/db/database.service');
  await import('@~/features/auth/auth.service');
  await import('@~/features/achievements/achievements.service');
  await import('@~/features/badges/badges.service');
  await import('@~/features/logger/logger.factory');
  await import('@~/features/events/event-bus');
  await import('@~/features/valkey/valkey.service');
  await import('@~/features/user/user.service');
}
