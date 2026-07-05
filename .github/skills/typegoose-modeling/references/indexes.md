# Indexes & Query Optimization

Use indexes to optimize frequently queried field combinations.

## Single-field indexes

Add `index: true` to frequently queried fields:

```typescript
import { prop } from '@typegoose/typegoose';

@prop({ required: true, index: true })
public ownerId!: string;

@prop({ required: true, index: true })
public email!: string;
```

## Unique constraints

Use `unique: true` for fields requiring uniqueness:

```typescript
@prop({ required: true, unique: true })
public email!: string;

@prop({ required: true, unique: true })
public username!: string;
```

## Compound indexes

Use `@index` decorator for multi-field indexes optimizing common query patterns:

```typescript
import { index, modelOptions, prop } from '@typegoose/typegoose';
import { idProp } from '../prop';

@index({ ownerId: 1, createdAt: -1 })        // Sort by date descending
@index({ visibility: 1, archived: 1 })       // Filter both
@index({ visibility: 1, archived: 1, createdAt: -1 })  // Filter + sort
@modelOptions({
  schemaOptions: { collection: 'challenges' },
})
class ChallengeClass {
  @idProp()
  public _id!: string;

  @prop({ required: true })
  public ownerId!: string;

  @prop({ required: true, enum: ['PUBLIC', 'PRIVATE'] })
  public visibility!: string;

  @prop({ default: false })
  public archived!: boolean;

  public createdAt!: Date;
}
```

## Index ordering matters

Field order in compound indexes affects query performance:

```typescript
// For query: find({ visibility: 'PUBLIC', archived: false }).sort({ createdAt: -1 })
// Use this order: filter fields first, then sort field
@index({ visibility: 1, archived: 1, createdAt: -1 })  ✓ GOOD

// NOT this (sort field first is slower)
@index({ createdAt: -1, visibility: 1, archived: 1 })  ✗ SLOWER
```

## Ascending vs descending

- `1` = ascending (useful for exact matches, range queries)
- `-1` = descending (useful for sorting, latest-first queries)

```typescript
// Find user's challenges, newest first
@index({ userId: 1, createdAt: -1 })

// Find archived items by date range
@index({ archived: 1, createdAt: 1 })
```

## Avoiding redundant indexes

DON'T create multiple single-field indexes when one compound index handles them:

```typescript
// ✗ BAD: Three separate indexes
@prop({ index: true })
public visibility!: string;

@prop({ index: true })
public archived!: boolean;

@prop({ index: true })
public createdAt!: Date;

// ✓ GOOD: One compound index covers all
@index({ visibility: 1, archived: 1, createdAt: -1 })
```

## TTL indexes (automatic expiration)

For documents that should auto-delete after a time:

```typescript
import { index, prop } from '@typegoose/typegoose';

@index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
class SessionClass {
  @prop({ required: true })
  public expiresAt!: Date;
}
// Deletes when expiresAt time is reached
```
