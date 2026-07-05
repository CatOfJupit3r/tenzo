---
name: server-error-handling
description: Handle errors correctly in server handlers using custom error wrappers and access control patterns. Use when implementing error handling, access control, permission checks, deciding between NOT_FOUND/FORBIDDEN/UNAUTHORIZED, adding new error codes, or handling edge cases and validation failures.
---

# Server Error Handling

**See [examples/error-handling-patterns.ts](examples/error-handling-patterns.ts) for complete examples of all access control patterns.**

## Core principle

All errors must use custom error wrappers from `apps/server/src/lib/orpc-error-wrapper.ts` with error codes from `packages/shared/src/enums/errors.enums.ts`. Never throw raw errors or use undefined error codes.

Error wrappers accept typed error codes and optional additional data:
```typescript
function errorWrapper(code: ErrorCodesType, additionalData?: Record<string, unknown>)
```

## Error wrapper types

### ORPCUnauthorizedError
**When to use**: User is not authenticated

```typescript
import { ORPCUnauthorizedError } from '@~/lib/orpc-error-wrapper';
import { errorCodes } from '@startername/shared';

if (!context.session) {
  throw ORPCUnauthorizedError(errorCodes.UNAUTHORIZED);
}
```

### ORPCNotFoundError
**When to use**: Resource not found OR user has no access to it

This prevents information leakage by not revealing whether a resource exists when the user shouldn't see it.

```typescript
import { ORPCNotFoundError } from '@~/lib/orpc-error-wrapper';
import { errorCodes } from '@startername/shared';

const challenge = await ChallengeModel.findById(challengeId);
if (!challenge || (challenge.visibility === 'PRIVATE' && challenge.creatorId !== userId)) {
  throw ORPCNotFoundError(errorCodes.CHALLENGE_NOT_FOUND);
}
```

### ORPCForbiddenError
**When to use**: User is authenticated and can see the resource, but lacks sufficient permissions

Only use when the user has some level of access but is restricted by permissions.

```typescript
import { ORPCForbiddenError } from '@~/lib/orpc-error-wrapper';
import { errorCodes } from '@startername/shared';

const community = await CommunityModel.findById(communityId);
if (!community) {
  throw ORPCNotFoundError(errorCodes.COMMUNITY_NOT_FOUND);
}

// User can see the community but can't delete it
if (community.ownerId !== userId) {
  throw ORPCForbiddenError(errorCodes.INSUFFICIENT_PERMISSIONS);
}
```

### ORPCBadRequestError
**When to use**: Invalid input format or malformed request

```typescript
import { ORPCBadRequestError } from '@~/lib/orpc-error-wrapper';
import { errorCodes } from '@startername/shared';

if (!isValidEmail(email)) {
  throw ORPCBadRequestError(errorCodes.INVALID_EMAIL_FORMAT);
}
```

### ORPCUnprocessableContentError
**When to use**: Valid input but semantically invalid operation

```typescript
import { ORPCUnprocessableContentError } from '@~/lib/orpc-error-wrapper';
import { errorCodes } from '@startername/shared';

const challenge = await ChallengeModel.findById(challengeId);
if (challenge.status === 'COMPLETED') {
  throw ORPCUnprocessableContentError(errorCodes.CHALLENGE_ALREADY_COMPLETED);
}
```

### ORPCInternalServerError
**When to use**: Unexpected server errors

```typescript
import { ORPCInternalServerError } from '@~/lib/orpc-error-wrapper';

try {
  await someOperation();
} catch (error) {
  logger.error('Operation failed', { error });
  throw ORPCInternalServerError();
}
```

Note: `ORPCInternalServerError` accepts an **optional** error code (unlike other wrappers). Use without code for truly unexpected errors, or with a code for expected error scenarios.

```typescript
// Optional error code:
throw ORPCInternalServerError(errorCodes.PUBLIC_CODE_GENERATION_FAILED);
```

## Access control patterns

### Pattern 1: Public vs Private resources

```typescript
const resource = await ResourceModel.findById(id);

// NOT_FOUND for both "doesn't exist" and "no access"
if (!resource || (resource.visibility === 'PRIVATE' && resource.ownerId !== userId)) {
  throw ORPCNotFoundError(errorCodes.RESOURCE_NOT_FOUND);
}

// User can see it; now check permissions
if (resource.ownerId !== userId) {
  throw ORPCForbiddenError(errorCodes.INSUFFICIENT_PERMISSIONS);
}
```

### Pattern 2: Role-based access

```typescript
const user = await UserModel.findById(userId);
const resource = await ResourceModel.findById(resourceId);

if (!resource) {
  throw ORPCNotFoundError(errorCodes.RESOURCE_NOT_FOUND);
}

// Check if user has required role
if (user.role !== 'ADMIN' && resource.ownerId !== userId) {
  throw ORPCForbiddenError(errorCodes.INSUFFICIENT_PERMISSIONS);
}
```

### Pattern 3: Community membership

```typescript
const community = await CommunityModel.findById(communityId);
if (!community) {
  throw ORPCNotFoundError(errorCodes.COMMUNITY_NOT_FOUND);
}

const member = community.members.find((m) => m.userId === userId);

// Not a member - hide existence
if (!member) {
  throw ORPCNotFoundError(errorCodes.COMMUNITY_NOT_FOUND);
}

// Member but wrong role
if (member.role !== 'ADMIN') {
  throw ORPCForbiddenError(errorCodes.INSUFFICIENT_PERMISSIONS);
}
```

## Adding new error codes

### 1. Define the error in enums

Add to `packages/shared/src/enums/errors.enums.ts`. The codes and messages are automatically generated from the `errors` enum object, so just add a new key-value pair:

```typescript
const myFeatureErrors = {
  MY_NEW_ERROR: 'Clear, user-friendly error message',
  ANOTHER_ERROR: 'Another descriptive message',
} as const;

const allErrors = {
  ...userErrors,
  ...myFeatureErrors,
  // ...other categories
} as const;
```

### 2. Use the error code in your handler/service

```typescript
import { errorCodes } from '@startername/shared';
import { ORPCBadRequestError } from '@~/lib/orpc-error-wrapper';

if (someCondition) {
  throw ORPCBadRequestError(errorCodes.MY_NEW_ERROR);
}
```

### 3. Type safety

The pattern ensures full type safety:
- `errorCodes` keys are typed as `ErrorCodesType`
- Messages are automatically looked up in `errorMessages`
- IDE autocomplete works for all codes

## Decision guide

```
User authenticated? → No → ORPCUnauthorizedError
              ↓
            Yes
              ↓
Resource exists? → No → ORPCNotFoundError
              ↓
            Yes
              ↓
User can see it? → No → ORPCNotFoundError (prevent info leak)
              ↓
            Yes
              ↓
Has permissions? → No → ORPCForbiddenError
              ↓
            Yes → Proceed
```

## Common mistakes

**Don't reveal resource existence**: Use `NOT_FOUND` for both "doesn't exist" and "user can't access" cases to prevent information leakage.

**Always use error codes**: Never throw raw errors or use undefined error codes. All codes must be defined in `packages/shared/src/enums/errors.ts`.
