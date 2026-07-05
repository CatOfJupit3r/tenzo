# Server Router Advanced Patterns

## Query Optimization

### Use indexes effectively

```typescript
// Ensure model has appropriate indexes
const challenges = await ChallengeModel
  .find({
    creatorId: userId,  // indexed
    visibility: VISIBILITY.PUBLIC,  // part of compound index
    archived: false,  // part of compound index
  })
  .sort({ createdAt: -1 });  // part of compound index
```

### Select only needed fields

```typescript
const users = await UserModel
  .find({ role: 'ADMIN' })
  .select('_id email username')  // Only fetch these fields
  .lean();  // Return plain objects, faster
```

### Populate relations sparingly

```typescript
// Bad - N+1 queries
const challenges = await ChallengeModel.find();
for (const challenge of challenges) {
  challenge.creator = await UserModel.findById(challenge.creatorId);
}

// Good - single query
const challenges = await ChallengeModel
  .find()
  .populate('creatorId', '_id email username');
```

## Advanced Patterns

### Pagination

```typescript
publicProcedure
  .use(contract.listItems)
  .handler(async ({ input }) => {
    const { limit = 20, offset = 0, sort = 'recent' } = input;
    
    const sortOptions = {
      recent: { createdAt: -1 },
      popular: { participantCount: -1 },
    };
    
    const items = await ItemModel
      .find({ archived: false })
      .sort(sortOptions[sort])
      .limit(limit)
      .skip(offset);
    
    const total = await ItemModel.countDocuments({ archived: false });
    
    return {
      items,
      pagination: { limit, offset, total },
    };
  });
```

### Filtering and search

```typescript
publicProcedure
  .use(contract.searchChallenges)
  .handler(async ({ input }) => {
    const query: any = { archived: false };
    
    if (input.search) {
      query.$text = { $search: input.search };
    }
    
    if (input.category) {
      query.category = input.category;
    }
    
    if (input.visibility) {
      query.visibility = input.visibility;
    } else {
      query.visibility = VISIBILITY.PUBLIC;
    }
    
    const challenges = await ChallengeModel.find(query);
    
    return { challenges };
  });
```

### Creating with embedded documents

```typescript
protectedProcedure
  .use(contract.createChallenge)
  .handler(async ({ input, context }) => {
    const creatorId = context.session.user.id;
    
    const challenge = await ChallengeModel.create({
      _id: ObjectIdString(),
      title: input.title,
      description: input.description,
      creatorId,
      visibility: input.visibility ?? VISIBILITY.PUBLIC,
      steps: input.steps.map((step, index) => ({
        _id: ObjectIdString(),
        title: step.title,
        description: step.description,
        order: index,
      })),
      participants: [
        {
          userId: creatorId,
          role: PARTICIPANT_ROLE.CREATOR,
          joinedAt: new Date(),
        },
      ],
    });
    
    return challenge;
  });
```

### Updating nested arrays

```typescript
protectedProcedure
  .use(contract.updateChallengeStep)
  .handler(async ({ input, context }) => {
    const challenge = await ChallengeModel.findById(input.challengeId);
    
    if (!challenge) {
      throw ORPCNotFoundError(ERROR_CODES.CHALLENGE_NOT_FOUND);
    }
    
    if (challenge.creatorId !== context.session.user.id) {
      throw ORPCForbiddenError(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    }
    
    const step = challenge.steps.find((s) => s._id === input.stepId);
    if (!step) {
      throw ORPCNotFoundError(ERROR_CODES.STEP_NOT_FOUND);
    }
    
    // Update the step
    Object.assign(step, input.updates);
    await challenge.save();
    
    return challenge;
  });
```

### Transaction pattern

```typescript
import { startSession } from 'mongoose';

protectedProcedure
  .use(contract.transferOwnership)
  .handler(async ({ input, context }) => {
    const session = await startSession();
    session.startTransaction();
    
    try {
      const challenge = await ChallengeModel.findById(input.challengeId).session(session);
      const user = await UserModel.findById(input.newOwnerId).session(session);
      
      if (!challenge || !user) {
        throw ORPCNotFoundError(ERROR_CODES.RESOURCE_NOT_FOUND);
      }
      
      challenge.creatorId = user._id;
      await challenge.save({ session });
      
      await session.commitTransaction();
      return challenge;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  });
```

## Testing Handlers

### Unit test pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { myNamespaceRouter } from './my-namespace.router';

describe('myNamespace.myProcedure', () => {
  beforeEach(() => {
    // Setup mocks
  });

  it('should return data for valid input', async () => {
    const result = await myNamespaceRouter.myProcedure({
      input: { id: '123' },
      context: { session: mockSession },
    });

    expect(result).toMatchObject({ id: '123' });
  });

  it('should throw NOT_FOUND for invalid id', async () => {
    await expect(
      myNamespaceRouter.myProcedure({
        input: { id: 'invalid' },
        context: { session: mockSession },
      })
    ).rejects.toThrow(ORPCNotFoundError);
  });
});
```

## Best Practices

### Keep handlers thin

❌ **Don't**: Put complex business logic in handlers
```typescript
handler: async ({ input, context }) => {
  // 100 lines of business logic
  // Complex calculations
  // Multiple database operations
  return result;
}
```

✅ **Do**: Delegate to services
```typescript
handler: async ({ input, context }) => {
  const service = resolve(TOKENS.ChallengeService);
  return service.createChallenge(input, context.session.user.id);
}
```

### Validate early

```typescript
handler: async ({ input, context }) => {
  // Validate first
  if (!input.email) {
    throw ORPCBadRequestError(ERROR_CODES.MISSING_EMAIL);
  }
  
  // Then proceed with business logic
  const result = await processEmail(input.email);
  return result;
}
```

### Log appropriately

```typescript
handler: async ({ input, context }) => {
  const logger = loggerFactory.create('ChallengeRouter');
  
  logger.info('Creating challenge', {
    userId: context.session.user.id,
    title: input.title,
  });
  
  try {
    const challenge = await createChallenge(input);
    logger.info('Challenge created', { challengeId: challenge._id });
    return challenge;
  } catch (error) {
    logger.error('Failed to create challenge', { error });
    throw ORPCInternalServerError();
  }
}
```
