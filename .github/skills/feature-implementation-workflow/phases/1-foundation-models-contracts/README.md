---
name: feature-foundation-models-contracts
description: Phase 1 of full-stack feature development - establish data models and API contracts. Use when starting a new feature, defining data structures, or planning backend integration. Triggers after requirements are clear but before implementation begins.
---

# Phase 1: Foundation (Data Models & Contracts)

Establish the foundation for your feature by creating data models and defining API contracts. This phase drives contract-first development, ensuring the backend and frontend work from a shared source of truth.

## Prerequisites

- Read `.github/copilot-instructions.md` for workspace context
- Understood the feature requirements
- Identified the data models needed
- Planned the API contracts

## Step 1: Review Existing Models

Check `apps/server/src/db/models/` to understand related entities and avoid duplication:

```typescript
// Example: Review existing models before adding new ones
const userFields = {
  _id: string,
  email: string,
  username: string,
};

const challengeFields = {
  _id: string,
  creatorId: string,
  title: string,
  steps: ChallengeStep[],
};
```

**See also**: `references/data-modeling-checklist.md`

## Step 2: Create Typegoose Models

Use the **typegoose-modeling** skill to create models in `apps/server/src/db/models/`:

```typescript
// apps/server/src/db/models/feature.model.ts
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import type { DocumentType } from '@typegoose/typegoose';
import { ObjectIdString } from '../helpers';

@modelOptions({
  schemaOptions: {
    collection: 'features',
    timestamps: true,
  },
  options: {
    indexes: [
      { fields: { ownerId: 1, createdAt: -1 } },
    ],
  },
})
class FeatureClass {
  @prop({ default: () => ObjectIdString() })
  public _id!: string;

  @prop({ required: true, index: true })
  public ownerId!: string;

  @prop({ required: true })
  public name!: string;

  @prop({ default: false })
  public archived!: boolean;
}

export const FeatureModel = getModelForClass(FeatureClass);
export type FeatureDoc = DocumentType<FeatureClass>;
```

## Step 3: Define oRPC Contracts

Use the **orpc-contract-creation** skill to create contracts in `packages/shared/src/contract/`:

```typescript
// packages/shared/src/contract/feature.contract.ts
import { oc } from '@orpc/server';
import z from 'zod';
import { authProcedure } from './base';

export const featureContract = oc.router({
  getFeature: oc
    .route({
      method: 'GET',
      path: '/features/:id',
      summary: 'Get feature by ID',
      description: 'Retrieves a feature with all its details',
    })
    .input(z.object({ id: z.string() }))
    .output(z.object({
      _id: z.string(),
      ownerId: z.string(),
      name: z.string(),
      archived: z.boolean(),
    }))
    .use(authProcedure),

  createFeature: oc
    .route({
      method: 'POST',
      path: '/features',
      summary: 'Create a new feature',
      description: 'Creates a feature owned by the authenticated user',
    })
    .input(z.object({ name: z.string().min(1) }))
    .output(z.object({
      _id: z.string(),
      ownerId: z.string(),
      name: z.string(),
    }))
    .use(authProcedure),
});
```

## Step 4: Export Contracts

Add to `packages/shared/src/contract/index.ts`:

```typescript
import { featureContract } from './feature.contract';

export const CONTRACT = oc.router({
  // ...existing contracts
  feature: featureContract,
});
```

## Step 5: Add Error Codes

Define error codes in `packages/shared/src/enums/errors.enums.ts`:

```typescript
// Add to the relevant error category (or create new category)
const featureErrors = {
  FEATURE_NOT_FOUND: 'Feature not found',
  FEATURE_NAME_REQUIRED: 'Feature name is required',
} as const;

// Update allErrors
const allErrors = {
  ...userErrors,
  ...featureErrors,
  // ...other categories
} as const;

// These are already exported as:
export const errorCodes = Object.fromEntries(Object.keys(allErrors).map((key) => [key, key])) as {
  [K in keyof typeof allErrors]: K;
};

export type ErrorCodesType = keyof typeof allErrors;
export const errorMessages: Record<ErrorCodesType, string> = allErrors;
```

Then use in handlers:
```typescript
import { errorCodes } from '@startername/shared';
import { ORPCNotFoundError } from '@~/lib/orpc-error-wrapper';

throw ORPCNotFoundError(errorCodes.FEATURE_NOT_FOUND);
```

## Step 6: Verify Contracts

```bash
pnpm run check-types
```

## Next Phase

Proceed to **Phase 2: Backend Implementation** when models and contracts are type-checking correctly.

See also:
- `references/schema-design-checklist.md` for data structure validation
- `references/contract-patterns.md` for contract design patterns
- Full example in `examples/feature-model.ts`

