---
name: dependency-injection-setup
description: Set up and use dependency injection with tsyringe for server-side services. Use when creating services, implementing service-to-service dependencies, using the logger factory pattern, or resolving services in handlers.
---

# Dependency Injection Setup

## Core concepts

This codebase uses tsyringe with `@hono/tsyringe` for request-scoped dependency injection. Key features:

- **emitDecoratorMetadata enabled (via SWC)**: tsyringe automatically infers constructor dependencies from types
- **Request-scoped containers**: `@hono/tsyringe` creates a child container per request
- **No tokens needed**: Inject classes directly for concrete classes

**Key principles:**
- Use `@singleton()` for stateless services shared across requests (LoggerFactory, AuthService, etc.)
- Use `@injectable()` for request-scoped services (UserService, etc.)
- Access services via `context.resolve(ServiceClass)` in handlers

## Step-by-step procedure

### 1. Create the service class

Create your service in `apps/server/src/features/<feature>/<feature>.service.ts`.

**See [references/service-patterns.md](references/service-patterns.md) for complete service examples.**

```typescript
// For stateless shared services
import { singleton } from 'tsyringe';

@singleton()
export class MySharedService {
  // Shared across all requests
}

// For request-scoped services
import { injectable } from 'tsyringe';

@injectable()
export class MyRequestService {
  // New instance per request
}
```

### 2. Register the service

Add the import to `apps/server/src/di/container.ts`:

```typescript
export async function registerServices() {
  // Import triggers @singleton()/@injectable() registration
  await import('@~/features/my-feature/my-feature.service');
}
```

### 3. Use in oRPC handlers

Use `context.resolve(ServiceClass)` to get services:

```typescript
import { MyFeatureService } from '@~/features/my-feature/my-feature.service';
import { protectedProcedure, base } from '../lib/orpc';

export const myRouter = base.myFeature.router({
  doSomething: protectedProcedure.myFeature.doSomething.handler(async ({ context, input }) => {
    const service = context.resolve(MyFeatureService);
    return service.doSomething(input.value);
  }),
});
```

### 4. Use in Hono routes (non-contract)

Use `c.var.resolve(ServiceClass)`:

```typescript
import { Hono } from 'hono';
import { MyFeatureService } from '@~/features/my-feature/my-feature.service';

const router = new Hono();

router.get('/my-route', async (c) => {
  const service = c.var.resolve(MyFeatureService);
  const result = await service.doSomething();
  return c.json(result);
});
```

### 5. Use in loaders/middleware (global container)

For code that runs before the request context exists, use the global container:

```typescript
import { container } from 'tsyringe';
import { MyFeatureService } from '@~/features/my-feature/my-feature.service';

const myService = container.resolve(MyFeatureService);
```

## Constructor injection pattern

For service-to-service dependencies, tsyringe automatically resolves from parameter types:

```typescript
import { singleton } from 'tsyringe';
import { UserService } from '@~/features/user/user.service';
import { LoggerFactory } from '@~/features/logger/logger.factory';
import type { iWithLogger } from '@~/features/logger/logger.types';

@singleton()
export class NotificationsService implements iWithLogger {
  public readonly logger: iWithLogger['logger'];

  constructor(
    private readonly userService: UserService,  // Auto-resolved from type
    loggerFactory: LoggerFactory,               // Auto-resolved from type
  ) {
    this.logger = loggerFactory.create('notifications');
  }

  public async notifyUser(userId: string, message: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      this.logger.warn('Cannot notify non-existent user', { userId });
      return;
    }
    // Send notification
  }
}
```

## Service lifecycle

### `@singleton()` - Globally shared

Use for stateless services shared across all requests:

```typescript
@singleton()
export class LoggerFactory { ... }
export class AuthService { ... }
export class DatabaseService { ... }
```

**Use cases:** Loggers, auth, database connections, event bus, caches

### `@injectable()` - Request-scoped

Use for services that should be created fresh per request:

```typescript
@injectable()
export class UserService { ... }
export class OrderService { ... }
```

**Use cases:** Services that might cache request-specific data, services with request state

## EventBus pattern

The `EventBus` is a singleton service for decoupled service communication. It uses typed `Listener<T>` instances for full type safety.

### Quick example

```typescript
import { singleton } from 'tsyringe';
import { EventBus } from '@~/features/events/event-bus';
import { OrderCreatedListener } from '@~/features/events/listeners/orders.listeners';

@singleton()
export class OrderService {
  constructor(private readonly eventBus: EventBus) {}

  async createOrder(data: CreateOrderInput) {
    const order = await OrderModel.create(data);
    // Payload is type-checked against Listener<{ orderId: string; userId: string }>
    this.eventBus.emit(OrderCreatedListener, { orderId: order._id.toString(), userId: data.userId });
    return order;
  }
}
```

Listeners are defined in `features/events/listeners/` and imported by other features. See [references/advanced-patterns.md](references/advanced-patterns.md) for full documentation on defining listeners, emitting, and subscribing.

## When to use tokens (rare)

Only use tokens for interface-based injection. See `apps/server/src/di/tokens.ts` for documentation.

```typescript
// Define token for interface
export const PAYMENT_SERVICE_TOKEN = Symbol.for('PaymentService');

// Register implementation
container.registerSingleton<iPaymentService>(PAYMENT_SERVICE_TOKEN, StripePaymentService);

// Inject via @inject decorator
constructor(@inject(PAYMENT_SERVICE_TOKEN) private payment: iPaymentService) {}
```

**See [references/advanced-patterns.md](references/advanced-patterns.md) for testing patterns, best practices, and advanced service patterns.**
