# Service Patterns Reference

Complete examples of common service patterns in the codebase.

## Request-Scoped Service with Logger

Services that may hold request-specific state use `@injectable()`:

```typescript
import { injectable } from 'tsyringe';
import { LoggerFactory } from '@~/features/logger/logger.factory';
import type { iWithLogger } from '@~/features/logger/logger.types';

@injectable()
export class UserService implements iWithLogger {
  public readonly logger: iWithLogger['logger'];

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.create('user-service');
  }

  public async getUser(userId: string): Promise<User | null> {
    this.logger.info('Fetching user', { userId });
    
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        this.logger.warn('User not found', { userId });
        return null;
      }
      
      return user;
    } catch (error) {
      this.logger.error('Failed to fetch user', { userId, error });
      throw error;
    }
  }
}
```

## Singleton Service (Shared Across Requests)

Stateless services that can be shared use `@singleton()`:

```typescript
import { singleton } from 'tsyringe';
import { LoggerFactory } from '@~/features/logger/logger.factory';
import { EmailService } from './email.service';
import type { iWithLogger } from '@~/features/logger/logger.types';

@singleton()
export class NotificationService implements iWithLogger {
  public readonly logger: iWithLogger['logger'];

  constructor(
    loggerFactory: LoggerFactory,
    private readonly emailService: EmailService,  // Auto-resolved from type
  ) {
    this.logger = loggerFactory.create('notification-service');
  }

  public async notifyUser(userId: string, message: string): Promise<void> {
    this.logger.info('Sending notification', { userId });
    
    const user = await UserModel.findById(userId);
    if (!user) {
      this.logger.warn('Cannot notify non-existent user', { userId });
      return;
    }

    await this.emailService.send({
      to: user.email,
      subject: 'Notification',
      body: message,
    });

    this.logger.info('Notification sent', { userId, email: user.email });
  }
}
```

## Service with Multiple Dependencies

```typescript
import { singleton } from 'tsyringe';
import { LoggerFactory } from '@~/features/logger/logger.factory';
import { CacheService } from './cache.service';
import { DatabaseService } from '@~/db/database.service';
import type { iWithLogger } from '@~/features/logger/logger.types';

@singleton()
export class ChallengeService implements iWithLogger {
  public readonly logger: iWithLogger['logger'];

  constructor(
    loggerFactory: LoggerFactory,
    private readonly cache: CacheService,
    private readonly db: DatabaseService,
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
    const challenge = await this.db.challenges.findById(id);
    
    if (challenge) {
      await this.cache.set(`challenge:${id}`, challenge, { ttl: 300 });
    }

    return challenge;
  }
}
```

## Stateless vs Stateful Services

### Stateless Service (Singleton - preferred)

Most services should be stateless singletons:

```typescript
import { singleton } from 'tsyringe';

@singleton()
export class HashService {
  public async hash(password: string): Promise<string> {
    // Stateless operation
    return await bcrypt.hash(password, 10);
  }

  public async compare(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }
}

// No registration needed - @singleton() handles it
```

### Stateful Service (Transient)

Use transient lifecycle when services maintain state per operation:

```typescript
import { injectable } from 'tsyringe';
import { Lifecycle, container } from 'tsyringe';

@injectable()
export class TransactionService {
  private operations: Operation[] = [];

  public addOperation(op: Operation): void {
    this.operations.push(op);
  }

  public async commit(): Promise<void> {
    // Execute all operations
    for (const op of this.operations) {
      await op.execute();
    }
    this.operations = [];
  }

  public rollback(): void {
    this.operations = [];
  }
}

// In container.ts - explicit registration for transient lifecycle
container.register(TransactionService, { useClass: TransactionService }, {
  lifecycle: Lifecycle.Transient,
});
```

## Service Testing

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { container } from 'tsyringe';
import { UserService } from './user.service';
import { LoggerFactory } from '@~/features/logger/logger.factory';

describe('UserService', () => {
  let service: UserService;
  let mockLogger: iWithLogger['logger'];

  beforeEach(() => {
    // Setup mocks
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const mockLoggerFactory = {
      create: vi.fn().mockReturnValue(mockLogger),
      global: vi.fn().mockReturnValue(mockLogger),
    };

    // Register mock (overrides @singleton() registration)
    container.register(LoggerFactory, { useValue: mockLoggerFactory });

    // Resolve service
    service = container.resolve(UserService);
  });

  afterEach(() => {
    container.clearInstances();
  });

  it('should fetch user by id', async () => {
    const user = await service.getUser('123');
    
    expect(user).toBeDefined();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Fetching user',
      { userId: '123' }
    );
  });
});
```
