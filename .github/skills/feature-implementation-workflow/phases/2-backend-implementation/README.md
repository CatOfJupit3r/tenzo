---
name: feature-backend-implementation
description: Phase 2 of full-stack feature development - implement backend services and routers. Use after models and contracts are defined, or when building server-side handlers, business logic, and API endpoints.
---

# Phase 2: Backend Implementation

Implement the backend logic by creating services (if needed) and router handlers that implement your contracts.

## Prerequisites

- Completed Phase 1: Foundation (Models & Contracts)
- Contracts are type-checking correctly
- Data models are in place

## Step 1: Create Service (Optional)

Services encapsulate business logic and are useful when:
- Multiple routers need the same logic
- Business logic is complex
- You want to test logic independently

Use the **dependency-injection-setup** skill:

```typescript
// apps/server/src/features/feature/feature.service.ts
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '@~/di/tokens';
import { FeatureModel } from '@~/db/models/feature.model';
import type { LoggerFactory } from '@~/services/logger-factory';
import { errorCodes } from '@startername/shared';
import { ORPCNotFoundError } from '@~/lib/orpc-error-wrapper';

@injectable()
export class FeatureService {
  private readonly logger: ReturnType<LoggerFactory['create']>;

  constructor(
    @inject(TOKENS.LoggerFactory) private loggerFactory: LoggerFactory,
  ) {
    this.logger = this.loggerFactory.create('FeatureService');
  }

  public async findById(id: string) {
    return FeatureModel.findById(id);
  }

  public async create(name: string, ownerId: string) {
    this.logger.info('Creating feature', { name, ownerId });
    return FeatureModel.create({
      _id: ObjectIdString(),
      name,
      ownerId,
    });
  }
}
```

## Step 2: Implement Router Handlers

Use the **server-router-implementation** and **server-error-handling** skills:

```typescript
// apps/server/src/routers/feature.router.ts
import { protectedProcedure } from '@~/lib/orpc';
import { base } from './base';
import { featureContract } from '@startername/shared/contract';
import { FeatureModel } from '@~/db/models/feature.model';
import { errorCodes } from '@startername/shared';
import { ORPCNotFoundError, ORPCForbiddenError } from '@~/lib/orpc-error-wrapper';

export const featureRouter = base.feature.router({
  getFeature: protectedProcedure
    .use(featureContract.getFeature)
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      
      const feature = await FeatureModel.findById(input.id);
      // Use NOT_FOUND for both "doesn't exist" and "user can't access"
      if (!feature || feature.ownerId !== userId) {
        throw ORPCNotFoundError(errorCodes.FEATURE_NOT_FOUND);
      }
      
      return feature;
    }),

  createFeature: protectedProcedure
    .use(featureContract.createFeature)
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      
      const feature = await FeatureModel.create({
        _id: ObjectIdString(),
        name: input.name,
        ownerId: userId,
      });
      
      return feature;
    }),
});
```

## Step 3: Register Router

Add to `apps/server/src/routers/index.ts`:

```typescript
import { featureRouter } from './feature.router';

export const appRouter = oc.router({
  // ...existing routers
  feature: featureRouter,
});
```

## Step 4: Write Backend Tests

```typescript
// apps/server/test/features/feature.test.ts
import { describe, it, expect } from 'vitest';
import { featureRouter } from '@~/routers/feature.router';

describe('Feature endpoints', () => {
  it('should create a feature', async () => {
    const result = await featureRouter.createFeature({
      input: { name: 'Test Feature' },
      context: mockAuthContext,
    });

    expect(result.name).toBe('Test Feature');
  });
});
```

## Error Handling Best Practices

Use error codes from the **server-error-handling** skill:

```typescript
import { errorCodes } from '@startername/shared';
import { 
  ORPCNotFoundError, 
  ORPCForbiddenError,
  ORPCBadRequestError,
  ORPCInternalServerError 
} from '@~/lib/orpc-error-wrapper';

// Resource not found or user lacks access
throw ORPCNotFoundError(errorCodes.FEATURE_NOT_FOUND);

// User authenticated but lacks permissions
throw ORPCForbiddenError(errorCodes.INSUFFICIENT_PERMISSIONS);

// Invalid input
throw ORPCBadRequestError(errorCodes.INVALID_INPUT);

// Unexpected errors (optional error code)
throw ORPCInternalServerError();
```

## Key Checkpoints

- [ ] Router handlers implement all contract procedures
- [ ] Error codes are used consistently (no hardcoded strings)
- [ ] Access control is enforced (authorization checks)
- [ ] All errors use proper error wrappers with `errorCodes`
- [ ] Type-checking passes: `pnpm run check-types`
- [ ] Backend tests pass

## Next Phase

Proceed to **Phase 3: Frontend Queries & Mutations** when backend handlers are complete and tested.

See also:
- `server-error-handling` skill for error handling best practices
- `dependency-injection-setup` skill for service patterns
- `server-router-implementation` skill for routing patterns

