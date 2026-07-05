# Property Decorators Reference

This project uses the standard `@prop` decorator from Typegoose with automatic type inference enabled via `emitDecoratorMetadata`, plus a convenience `@idProp` helper for `_id` fields.

## The `@idProp` Helper

For `_id` fields with auto-generated ObjectId strings, use the `idProp` helper from `../prop`:

```typescript
import { prop, modelOptions, getModelForClass } from '@typegoose/typegoose';
import { idProp } from '../prop';

@modelOptions({ schemaOptions: { collection: 'users' } })
class UserClass {
  @idProp({ required: true })
  public _id!: string;

  @prop({ required: true })
  public name!: string;
}
```

This is equivalent to:
```typescript
@prop({ required: true, default: () => ObjectIdString() })
public _id!: string;
```

## Basic Usage

With `emitDecoratorMetadata` enabled, Typegoose automatically infers types from TypeScript annotations:

```typescript
import { prop, modelOptions, getModelForClass } from '@typegoose/typegoose';

@modelOptions({ schemaOptions: { collection: 'users' } })
class UserClass {
  @prop({ required: true })
  public name!: string;  // Type automatically inferred as String

  @prop({ required: true })
  public age!: number;   // Type automatically inferred as Number

  @prop({ default: false })
  public isActive!: boolean;  // Type automatically inferred as Boolean

  @prop()
  public createdAt!: Date;  // Type automatically inferred as Date
}
```

## Common Options

All standard Typegoose/Mongoose options are supported:

```typescript
// Required field
@prop({ required: true })
public name!: string;

// Default value
@prop({ default: '' })
public bio!: string;

// Default with function (for dynamic values)
@prop({ default: () => new Date() })
public createdAt!: Date;

// Unique constraint
@prop({ required: true, unique: true })
public email!: string;

// Index
@prop({ required: true, index: true })
public userId!: string;

// Combined options
@prop({ required: true, unique: true, index: true })
public slug!: string;

// String constraints
@prop({ maxlength: 500 })
public description!: string;

// Number constraints
@prop({ min: 0, max: 100 })
public score!: number;

// Enum values
@prop({ enum: ['ACTIVE', 'INACTIVE', 'PENDING'], default: 'PENDING' })
public status!: string;
```

## Optional Fields

```typescript
// Optional (can be undefined)
@prop()
public nickname?: string;

// Nullable (can be null)
@prop({ default: null })
public deletedAt!: Date | null;
```

## Arrays

```typescript
// Array of primitives
@prop({ type: () => [String], default: [] })
public tags!: string[];

@prop({ type: () => [Number], default: [] })
public scores!: number[];

// Array of embedded documents
@prop({ type: () => [AddressClass], default: [] })
public addresses!: AddressClass[];
```

## Embedded Documents

```typescript
class AddressClass {
  @prop({ required: true })
  public street!: string;

  @prop({ required: true })
  public city!: string;
}

class UserClass {
  @prop({ type: () => AddressClass })
  public homeAddress?: AddressClass;

  @prop({ type: () => [AddressClass], default: [] })
  public addresses!: AddressClass[];
}
```

## Mixed/Dynamic Data

For unstructured data, use `allowMixed`:

```typescript
import { prop, Severity } from '@typegoose/typegoose';

@prop({ type: () => Object, allowMixed: Severity.ALLOW })
public metadata?: Record<string, unknown>;
```

## When to Specify Type Explicitly

While types are usually inferred automatically, specify `type` explicitly for:

1. **Arrays** - Always use `type: () => [ItemType]`
2. **Embedded documents** - Use `type: () => EmbeddedClass`
3. **Mixed data** - Use `type: () => Object` with `allowMixed`

```typescript
// Arrays require explicit type
@prop({ type: () => [String], default: [] })
public tags!: string[];

// Embedded documents require explicit type
@prop({ type: () => AddressClass })
public address?: AddressClass;
```
