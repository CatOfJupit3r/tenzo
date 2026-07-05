# Advanced DI Patterns and Testing

## Testing with DI

### Testing oRPC handlers

When testing oRPC handlers that use `context.resolve()`, provide a resolve function in the test context:

```typescript
import { container } from 'tsyringe';
import type { InjectionToken } from 'tsyringe';

// Create a resolve function for test context
function resolve<T>(token: InjectionToken<T>): T {
  return container.resolve(token);
}

// Use in test context
const ctx = () => ({
  context: {
    session: { user, session },
    resolve,
  },
});

// Call handler with context
await call(appRouter.user.getUserProfile, null, ctx());
```

### Mock services in tests

```typescript
import 'reflect-metadata';
import { container } from 'tsyringe';
import { MyService } from '@~/features/my-feature/my-feature.service';
import { LoggerFactory } from '@~/features/logger/logger.factory';

describe('MyHandler', () => {
  beforeEach(() => {
    // Create mock logger factory
    const mockLoggerFactory = {
      create: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
      global: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
    };

    // Register mock (overrides @singleton() registration)
    container.register(LoggerFactory, { useValue: mockLoggerFactory });
  });

  afterEach(() => {
    container.clearInstances();
  });

  it('should use the service', async () => {
    const service = container.resolve(MyService);
    const result = await service.doSomething('test');
    expect(result).toBe('expected result');
  });
});
```

### Factory pattern for testability

Export a factory that accepts dependencies explicitly:

```typescript
export class MyService {
  constructor(
    private readonly userService: UserService,
    private readonly logger: Logger,
  ) {}

  public async doSomething() {
    // Business logic
  }
}

// Factory for testing
export function createMyService(
  userService: UserService,
  logger: Logger,
): MyService {
  return new MyService(userService, logger);
}
```

## Service Lifecycle Patterns

### Singleton (shared across requests)

Use for stateless services:

```typescript
@singleton()
export class MyService { ... }

// No explicit registration needed - @singleton() handles it
```

**When to use**:
- Database access layers
- Auth services
- Logger factories
- Event buses
- Any stateless service

### Request-scoped (via @hono/tsyringe)

Use for services that should be created fresh per HTTP request:

```typescript
import { injectable } from 'tsyringe';

@injectable()
export class UserService { ... }
```

With `@hono/tsyringe` middleware, `@injectable()` services are automatically request-scoped when resolved via `context.resolve()` or `c.var.resolve()`.

**When to use**:
- Services that cache request-specific data
- Services with request state
- Per-request business logic

**When to use**:
- Services with mutable state
- Request-scoped services
- Short-lived objects

## Best Practices

### Keep services stateless

❌ **Don't**: Store mutable state in singleton services
```typescript
@singleton()
export class BadService {
  private cachedUsers: User[] = []; // BAD - shared state

  public async addUser(user: User) {
    this.cachedUsers.push(user); // Will affect all requests
  }
}
```

✅ **Do**: Keep services stateless or use transient lifecycle
```typescript
@singleton()
export class GoodService {
  public async addUser(user: User) {
    return UserModel.create(user); // Stateless
  }
}
```

### Dependencies are resolved from types

With `emitDecoratorMetadata` enabled, tsyringe automatically resolves dependencies from parameter types. No `@inject()` needed for concrete classes.

```typescript
@singleton()
export class GoodService {
  constructor(
    private readonly userRepo: UserRepository,  // Auto-resolved
    loggerFactory: LoggerFactory,               // Auto-resolved
  ) {}

  public async getUser(id: string) {
    return this.userRepo.findById(id);
  }
}
```

### Use descriptive service names

```typescript
// Good names
UserService
ChallengeManagementService
EmailNotificationService
AuthenticationService

// Bad names
DataService
Manager
Helper
Util
```

## Logger Factory Pattern

### Using the logger factory

The repo has a `LoggerFactory` singleton. Use it to create contextual loggers:

```typescript
import { singleton } from 'tsyringe';
import { LoggerFactory } from '@~/features/logger/logger.factory';
import type { iWithLogger } from '@~/features/logger/logger.types';

@singleton()
export class MyService implements iWithLogger {
  public readonly logger: iWithLogger['logger'];

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.create('my-service');
  }

  public async performAction() {
    this.logger.info('Starting action', { timestamp: Date.now() });
    
    try {
      // Do something
      this.logger.info('Action completed successfully');
    } catch (error) {
      this.logger.error('Action failed', { error });
      throw error;
    }
  }
}
```

### Benefits of logger factory

- Consistent logging format across services
- Contextual logger names for filtering
- Centralized configuration
- Auto-resolved from constructor type

## Advanced Service Patterns

### Service with caching

```typescript
import { singleton } from 'tsyringe';
import { LoggerFactory } from '@~/features/logger/logger.factory';
import { CacheService } from './cache.service';
import type { iWithLogger } from '@~/features/logger/logger.types';

@singleton()
export class ChallengeService implements iWithLogger {
  public readonly logger: iWithLogger['logger'];

  constructor(
    loggerFactory: LoggerFactory,
    private readonly cache: CacheService,
  ) {
    this.logger = loggerFactory.create('challenge-service');
  }

  public async getChallenge(id: string): Promise<Challenge | null> {
    // Try cache first
    const cached = await this.cache.get<Challenge>(`challenge:${id}`);
    if (cached) {
      this.logger.debug('Cache hit', { challengeId: id });
      return cached;
    }

    // Fetch from database
    this.logger.debug('Cache miss, fetching from DB', { challengeId: id });
    const challenge = await ChallengeModel.findById(id);
    
    if (challenge) {
      await this.cache.set(`challenge:${id}`, challenge, { ttl: 300 });
    }

    return challenge;
  }
}
```

### Service with transaction support

```typescript
import { singleton } from 'tsyringe';
import { LoggerFactory } from '@~/features/logger/logger.factory';
import { UserService } from '@~/features/user/user.service';
import { ProfileService } from './profile.service';
import mongoose from 'mongoose';
import type { iWithLogger } from '@~/features/logger/logger.types';

@singleton()
export class UserRegistrationService implements iWithLogger {
  public readonly logger: iWithLogger['logger'];

  constructor(
    loggerFactory: LoggerFactory,
    private readonly userService: UserService,
    private readonly profileService: ProfileService,
  ) {
    this.logger = loggerFactory.create('user-registration');
  }

  public async registerUser(data: RegistrationData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create user and profile atomically
      const user = await this.userService.create(data, { session });
      const profile = await this.profileService.create(
        { userId: user._id, ...data.profile },
        { session }
      );

      await session.commitTransaction();
      this.logger.info('User registered successfully', { userId: user._id });

      return { user, profile };
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('User registration failed', { error });
      throw error;
    } finally {
      session.endSession();
    }
  }
}
```

### Service with event emission

The EventBus uses a typed `Listener<T>` pattern. Listeners are **ONLY defined in the events module** and imported by other features, ensuring clean dependencies.

#### Defining a Listener

Create listeners in `apps/server/src/features/events/listeners/`:

```typescript
// features/events/listeners/orders.listeners.ts
import { Listener } from '../listener.class';

export const OrderCreatedListener = new Listener<{ orderId: string; userId: string }>('ORDER_CREATED');
export const OrderCancelledListener = new Listener<{ orderId: string; reason: string }>('ORDER_CANCELLED');
```

The `Listener<TPayload>` class uses phantom typing to carry the payload type at compile time.

#### Emitting events

```typescript
import { singleton } from 'tsyringe';
import { EventBus } from '@~/features/events/event-bus';
import { OrderCreatedListener } from '@~/features/events/listeners/orders.listeners';
import { LoggerFactory } from '@~/features/logger/logger.factory';
import type { iWithLogger } from '@~/features/logger/logger.types';

@singleton()
export class OrderService implements iWithLogger {
  public readonly logger: iWithLogger['logger'];

  constructor(
    loggerFactory: LoggerFactory,
    private readonly eventBus: EventBus,
  ) {
    this.logger = loggerFactory.create('order-service');
  }

  public async createOrder(data: CreateOrderInput) {
    const order = await OrderModel.create(data);
    
    this.logger.info('Order created', { orderId: order._id });
    
    // Emit event - payload is type-checked against OrderCreatedListener
    this.eventBus.emit(OrderCreatedListener, { 
      orderId: order._id.toString(), 
      userId: data.userId,
    });
    
    return order;
  }
}
```

#### Subscribing to events

```typescript
import { singleton } from 'tsyringe';
import { EventBus } from '@~/features/events/event-bus';
import { OrderCreatedListener } from '@~/features/events/listeners/orders.listeners';
import { LoggerFactory } from '@~/features/logger/logger.factory';
import type { iWithLogger } from '@~/features/logger/logger.types';

@singleton()
export class NotificationService implements iWithLogger {
  public readonly logger: iWithLogger['logger'];

  constructor(
    loggerFactory: LoggerFactory,
    private readonly eventBus: EventBus,
  ) {
    this.logger = loggerFactory.create('notification-service');
    this.setupListeners();
  }

  private setupListeners() {
    // payload is automatically typed as { orderId: string; userId: string }
    this.eventBus.on(OrderCreatedListener, async (payload) => {
      this.logger.info('Sending order confirmation', { orderId: payload.orderId });
      await this.sendOrderConfirmation(payload.userId, payload.orderId);
    });
  }

  private async sendOrderConfirmation(userId: string, orderId: string) {
    // Send email/notification
  }
}
```

#### Using ListenerPayload type helper

The `ListenerPayload<T>` type extracts the payload type from a Listener:

```typescript
import type { Listener, ListenerPayload } from '@~/features/events/listener.class';

// Define handler that works with any listener
interface iEventHandler<TListener extends Listener<unknown>> {
  listensTo: TListener[];
  handle: (payload: ListenerPayload<TListener>) => Promise<void>;
}
```
