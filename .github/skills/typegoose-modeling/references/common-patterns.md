# Enums & Common Patterns

## Using enums in models

Define shared enums using the `z.enum` pattern:

```typescript
// In packages/shared/src/enums/visibility.ts
import z from 'zod';

export const visibilitySchema = z.enum(['PUBLIC', 'PRIVATE', 'UNLISTED']);
export const VISIBILITY = visibilitySchema.enum;
export type Visibility = z.infer<typeof visibilitySchema>;
```

Use in models with `enum` option:

```typescript
import { prop, modelOptions } from '@typegoose/typegoose';
import { VISIBILITY, type Visibility } from '@startername/shared/enums/visibility';

@modelOptions({ schemaOptions: { collection: 'challenges' } })
class ChallengeClass {
  @prop({
    required: true,
    enum: Object.values(VISIBILITY),
    default: VISIBILITY.PUBLIC,
  })
  public visibility!: Visibility;
}
```

## Timestamps

Enable automatic `createdAt` and `updatedAt`:

```typescript
import { prop, modelOptions } from '@typegoose/typegoose';
import { idProp } from '../prop';

@modelOptions({
  schemaOptions: {
    collection: 'entities',
    timestamps: true,  // Enables timestamps
  },
})
class EntityClass {
  @idProp()
  public _id!: string;

  @prop({ required: true })
  public name!: string;

  // Declare without decorators—Mongoose populates automatically
  public createdAt!: Date;
  public updatedAt!: Date;
}
```

## References to other documents

Use string IDs for references—no Mongoose ref field needed:

```typescript
// Simple reference
@prop({ required: true, index: true })
public userId!: string;

@prop({ required: true })
public creatorId!: string;

// Optional reference
@prop()
public parentChallengeId?: string;
```

## Optional fields

**Option 1: Undefined (preferred)**
```typescript
@prop()
public optionalField?: string;
// Can be undefined
```

**Option 2: Null**
```typescript
@prop({ default: null })
public optionalField!: string | null;
// Can be null but not undefined
```

**Option 3: Default value**
```typescript
@prop({ default: 'DEFAULT' })
public field!: string;
// Always has a value
```

## Collections naming

Always use plural, lowercase collection names:

```typescript
@modelOptions({
  schemaOptions: {
    collection: 'users',          // ✓ GOOD
    collection: 'User',           // ✗ BAD (singular, capitalized)
    collection: 'user_documents', // ✗ BAD (underscores instead of plural)
  },
})
class UserClass {
  // ...
}
```

## Exporting models and types

Always export both:

```typescript
import { getModelForClass } from '@typegoose/typegoose';
import type { DocumentType } from '@typegoose/typegoose';

export const UserModel = getModelForClass(UserClass);
export type UserDoc = DocumentType<UserClass>;
```

Provides:
- `UserModel` - Runtime Mongoose model for queries
- `UserDoc` - TypeScript type for type-safe operations

## Array patterns

**Empty by default:**
```typescript
@prop({ type: () => [String], default: [] })
public tags!: string[];

@prop({ type: () => [TagClass], default: [] })
public embeddedTags!: TagClass[];
```

**Always present:**
```typescript
@prop({ type: () => [String], required: true })
public tags!: string[];  // Required, must be array
```

**Optional:**
```typescript
@prop({ type: () => [String] })
public tags?: string[];  // May not exist
```
