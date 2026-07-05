# Architecture Best Practices

## Keep business logic outside models

Models should be pure data structures—move logic to services.

❌ **Don't: Add methods to model classes**
```typescript
class ChallengeClass {
  @prop({ required: true })
  public title!: string;

  public async addParticipant(userId: string) {  // BAD
    this.participants.push({ userId });
    await this.save();
  }

  public getStatus() {  // BAD
    if (this.participants.length === 0) return 'EMPTY';
    return 'ACTIVE';
  }
}
```

✅ **Do: Use stateless services**
```typescript
// In apps/server/src/features/challenge/challenge.service.ts
import { errorCodes } from '@startername/shared';
import { ORPCNotFoundError } from '@~/lib/orpc-error-wrapper';

export class ChallengeService {
  async addParticipant(challengeId: string, userId: string) {  // GOOD
    const challenge = await ChallengeModel.findById(challengeId);
    if (!challenge) throw ORPCNotFoundError(errorCodes.CHALLENGE_NOT_FOUND);

    challenge.participants.push({ userId });
    await challenge.save();
    return challenge;
  }

  getStatus(challenge: ChallengeDoc) {  // Pure function
    return challenge.participants.length === 0 ? 'EMPTY' : 'ACTIVE';
  }
}
```

Benefits:
- Testable without database
- Reusable across endpoints
- Clear separation of concerns
- Easier debugging

## Share schema fragments

Reuse nested structures across models:

```typescript
import { prop, modelOptions } from '@typegoose/typegoose';

// In apps/server/src/db/schemas/common.ts
export class AuditableClass {
  @prop({ required: true })
  public createdBy!: string;

  @prop({ required: true })
  public lastModifiedBy!: string;

  @prop({ required: true })
  public lastModifiedAt!: Date;
}

export class TimestampedClass {
  public createdAt!: Date;
  public updatedAt!: Date;
}

// In models
@modelOptions({ schemaOptions: { collection: 'challenges', timestamps: true } })
class ChallengeClass extends AuditableClass {
  @prop({ required: true })
  public title!: string;

  public createdAt!: Date;
  public updatedAt!: Date;
}

@modelOptions({ schemaOptions: { collection: 'submissions' } })
class SubmissionClass extends AuditableClass {
  @prop({ required: true })
  public challengeId!: string;

  public createdAt!: Date;
}
```

Benefits:
- DRY - Define common fields once
- Consistent schema across models
- Easy to update shared structure

## Export type-safe helpers

Export functions for safe type access:

```typescript
// In challenge.model.ts
export const ChallengeModel = getModelForClass(ChallengeClass);
export type ChallengeDoc = DocumentType<ChallengeClass>;

// Type-safe getter
export async function getChallengeOrThrow(id: string): Promise<ChallengeDoc> {
  const challenge = await ChallengeModel.findById(id);
  if (!challenge) throw ORPCNotFoundError(errorCodes.CHALLENGE_NOT_FOUND);
  return challenge;
}

// In router/service
const challenge = await getChallengeOrThrow(challengeId);
// TypeScript knows challenge is ChallengeDoc, never null
```

## Validation schema separation

Keep Zod validation schemas separate from models:

```typescript
// In models
export const UserModel = getModelForClass(UserClass);
export type UserDoc = DocumentType<UserClass>;

// In packages/shared/src/schemas/user.schema.ts
import z from 'zod';

export const createUserInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// In router
const { data: input } = await createUserInputSchema.parseAsync(req.body);
const user = new UserModel(input);
await user.save();
```

Benefits:
- Models stay focused on structure
- Validation logic is separately testable
- Reuse validation across REST/RPC/APIs
