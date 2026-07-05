---
name: orpc-contract-creation
description: Create new oRPC contracts in packages/shared following project conventions. Use when adding new API endpoints, defining RPC procedures, extending existing contract namespaces, or creating fully typed client-server communication contracts.
---

# oRPC Contract Creation

**See [examples/complete-contract.ts](examples/complete-contract.ts) for a complete example with multiple procedures.**

## How it works

oRPC contracts are the single source of truth for both REST/OpenAPI and RPC layers. They live in `packages/shared/src/contract/` and must be properly typed with Zod schemas.

## Step-by-step procedure

### 1. Define the contract file

Create a new file in `packages/shared/src/contract/<namespace>.contract.ts`.

**See [examples/complete-contract.ts](examples/complete-contract.ts) for a complete example with multiple procedures.**

Basic structure:

```typescript
import { oc } from '@orpc/server';
import z from 'zod';
import { authProcedure } from './base';

export const myNamespaceContract = oc.router({
  myProcedure: oc
    .route({
      method: 'POST',
      path: '/my-namespace/my-procedure',
      summary: 'Brief one-line description',
      description: 'Detailed description of what this endpoint does',
    })
    .input(
      z.object({
        param: z.string(),
      })
    )
    .output(
      z.object({
        result: z.string(),
      })
    )
    // Add authProcedure for authenticated routes
    .use(authProcedure),
});
```

### 2. Choose the right procedure type

- **Public routes**: Don't add `.use(authProcedure)` - these are accessible without authentication
- **Authenticated routes**: Add `.use(authProcedure)` - these require a valid session and expose `auth: "USER"` metadata

### 3. Use shared schemas for reuse

Define common schemas in `packages/shared/src/schemas/` and import them:

```typescript
import { paginationInputSchema, paginationOutputSchema } from '../schemas/pagination';

export const listItemsContract = oc
  .route({
    method: 'GET',
    path: '/items',
    summary: 'List items with pagination',
  })
  .input(paginationInputSchema)
  .output(
    z.object({
      items: z.array(itemSchema),
      pagination: paginationOutputSchema,
    })
  );
```

### 4. Export the contract

Add your new contract to `packages/shared/src/contract/index.ts`:

```typescript
import { oc } from '@orpc/server';
import { myNamespaceContract } from './my-namespace.contract';

export const CONTRACT = oc.router({
  // ...existing contracts
  myNamespace: myNamespaceContract,
});
```

### 5. Validate the contract

Run type checking to ensure everything compiles:

```bash
pnpm run check-types
```

## Contract conventions

### Naming
- Use camelCase for procedure names: `getUserProfile`, `listChallenges`
- Use kebab-case for URL paths: `/user-profile`, `/list-challenges`
- Namespace contracts match their domain: `userContract`, `challengeContract`

### Documentation
- Always include `summary` (one line, used in OpenAPI docs)
- Always include `description` (detailed explanation of behavior)
- Document edge cases and special behaviors in the description

### Input/Output schemas
- Use explicit Zod schemas for all inputs and outputs
- Never use `.passthrough()` or `.any()` - be explicit about shape
- Validate at the contract level, not just in handlers

### Error responses
- Contracts don't define error schemas - these are handled by error wrappers
- All error codes must be defined in `packages/shared/src/enums/errors.enums.ts`
- Handlers use custom error wrappers from `apps/server/src/lib/orpc-error-wrapper.ts`
- Import error codes via: `import { errorCodes } from '@startername/shared';`

## Common patterns

### Pagination
```typescript
.input(
  z.object({
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
  })
)
```

### ID parameters
```typescript
.input(
  z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format'),
  })
)
```

### Optional filters
```typescript
.input(
  z.object({
    search: z.string().optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  })
)
```
