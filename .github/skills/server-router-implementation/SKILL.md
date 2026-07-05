---
name: server-router-implementation
description: Implement oRPC router handlers on the server following contract definitions. Use when implementing API endpoints, connecting contracts to business logic, handling authenticated routes, registering new routers, or implementing business logic in handlers.
---

# Server Router Implementation

**See [examples/complete-router.ts](examples/complete-router.ts) for a complete example with CRUD operations and error handling.**

## Core concepts

Routers in `apps/server/src/routers` mirror the contract namespace and use `publicProcedure` or `protectedProcedure` based on authentication requirements.

## Step-by-step procedure

### 1. Create the router file

Create a new file in `apps/server/src/routers/<namespace>.router.ts`.

**See [examples/complete-router.ts](examples/complete-router.ts) for a complete example with CRUD operations and error handling.**

Basic structure:

```typescript
import { publicProcedure, protectedProcedure } from '@~/lib/orpc';
import { base } from './base';
import { myNamespaceContract } from '@startername/shared/contract';

export const myNamespaceRouter = base.myNamespace.router({
  myPublicProcedure: publicProcedure
    .use(myNamespaceContract.myPublicProcedure)
    .handler(async ({ input, context }) => {
      // Public handler - no authentication required
      const result = await processData(input);
      return { result };
    }),

  myProtectedProcedure: protectedProcedure
    .use(myNamespaceContract.myProtectedProcedure)
    .handler(async ({ input, context }) => {
      // Protected handler - context.session contains user info
      const userId = context.session.user.id;
      const result = await processForUser(input, userId);
      return { result };
    }),
});
```

### 2. Choose the right procedure type

#### Public procedure

Use for endpoints that don't require authentication:

```typescript
publicProcedure
  .use(contract.listPublicChallenges)
  .handler(async ({ input }) => {
    const challenges = await ChallengeModel
      .find({ visibility: VISIBILITY.PUBLIC, archived: false })
      .limit(input.limit)
      .skip(input.offset);
    
    return { challenges };
  });
```

#### Protected procedure

Use for endpoints that require authentication. Access user info via `context.session`:

```typescript
import { errorCodes } from '@startername/shared';
import { ORPCNotFoundError } from '@~/lib/orpc-error-wrapper';

protectedProcedure
  .use(contract.getUserProfile)
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id;
    
    const profile = await UserProfileModel.findOne({ userId });
    if (!profile) {
      throw ORPCNotFoundError(errorCodes.PROFILE_NOT_FOUND);
    }
    
    return profile;
  });
```

### 3. Access context properties

The context object provides:

- `context.session` (protected procedures only): Better Auth session with user info
  - `context.session.user.id`: User ID
  - `context.session.user.email`: User email
  - Additional fields defined in Better Auth schema

```typescript
protectedProcedure
  .use(contract.createChallenge)
  .handler(async ({ input, context }) => {
    const creatorId = context.session.user.id;
    
    const challenge = await ChallengeModel.create({
      ...input,
      creatorId,
      _id: ObjectIdString(),
    });
    
    return challenge;
  });
```

### 4. Use services via dependency injection

Resolve services using `resolve` or `GETTERS`:

```typescript
import { resolve } from '@~/di';
import { TOKENS } from '@~/di/tokens';
import { GETTERS } from './di-getter';

protectedProcedure
  .use(contract.notifyUser)
  .handler(async ({ input, context }) => {
    // Using resolve
    const notificationService = resolve(TOKENS.NotificationService);
    await notificationService.send(input.userId, input.message);
    
    // Using GETTERS (if defined)
    const emailService = GETTERS.emailService();
    await emailService.sendEmail(input.email, input.subject);
    
    return { success: true };
  });
```

### 5. Implement access control

Follow the access control patterns from the error handling skill:

```typescript
import { errorCodes } from '@startername/shared';
import { ORPCNotFoundError, ORPCForbiddenError } from '@~/lib/orpc-error-wrapper';

protectedProcedure
  .use(contract.updateChallenge)
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id;
    
    const challenge = await ChallengeModel.findById(input.challengeId);
    
    // Use NOT_FOUND if user can't see it at all
    if (!challenge || (challenge.visibility === VISIBILITY.PRIVATE && challenge.creatorId !== userId)) {
      throw ORPCNotFoundError(errorCodes.CHALLENGE_NOT_FOUND);
    }
    
    // Use FORBIDDEN if user can see it but can't edit
    if (challenge.creatorId !== userId) {
      throw ORPCForbiddenError(errorCodes.INSUFFICIENT_PERMISSIONS);
    }
    
    // Update the challenge
    Object.assign(challenge, input.updates);
    await challenge.save();
    
    return challenge;
  });
```

### 6. Register the router

Add your router to `apps/server/src/routers/index.ts`:

```typescript
import { myNamespaceRouter } from './my-namespace.router';

export const appRouter = oc.router({
  // ...existing routers
  myNamespace: myNamespaceRouter,
});
```

**See [references/advanced-patterns.md](references/advanced-patterns.md) for pagination, filtering, transactions, query optimization, testing patterns, and best practices.**
