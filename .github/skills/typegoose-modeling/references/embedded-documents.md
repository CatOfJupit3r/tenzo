# Embedded Documents & Nested Objects

Create reusable nested structures using the standard `@prop` decorator with explicit type declarations.

## Single nested object

Use `@prop({ type: () => Class })` for single nested objects:

```typescript
import { prop, modelOptions, getModelForClass } from '@typegoose/typegoose';
import { idProp } from '../prop';

class AddressClass {
  @prop({ required: true })
  public street!: string;

  @prop({ required: true })
  public city!: string;

  @prop({ required: true })
  public zipCode!: string;
}

@modelOptions({ schemaOptions: { collection: 'users' } })
class UserClass {
  @idProp()
  public _id!: string;

  @prop({ type: () => AddressClass })
  public homeAddress?: AddressClass;  // Optional single object

  @prop({ type: () => AddressClass, required: true })
  public workAddress!: AddressClass;  // Required single object
}
```

## Array of embedded documents

Use `@prop({ type: () => [Class] })` for arrays:

```typescript
class AddressClass {
  @prop({ required: true })
  public street!: string;
}

class UserClass {
  @prop({ type: () => [AddressClass], default: [] })
  public addresses!: AddressClass[];  // Always typed and initialized
}
```

## Accessing nested fields

TypeScript fully infers nested types:

```typescript
const user = await UserModel.findById(userId);

// TypeScript knows these are typed
user.homeAddress?.city        // string | undefined
user.addresses[0].street      // string
user.addresses.map(a => a.city)  // string[]
```

## Arrays of primitives

Use explicit type declarations for primitive arrays:

```typescript
// String array
@prop({ type: () => [String], default: [] })
public tags!: string[];

// Number array
@prop({ type: () => [Number], default: [] })
public scores!: number[];

// Boolean array
@prop({ type: () => [Boolean], default: [] })
public flags!: boolean[];
```

## Deeply nested structures

Nest as many levels as needed:

```typescript
class PhoneClass {
  @prop({ required: true })
  public number!: string;

  @prop({ enum: ['MOBILE', 'HOME', 'WORK'], default: 'MOBILE' })
  public type!: string;
}

class ContactClass {
  @prop({ required: true })
  public email!: string;

  @prop({ type: () => [PhoneClass], default: [] })
  public phones!: PhoneClass[];
}

class UserClass {
  @prop({ type: () => ContactClass })
  public contact!: ContactClass;  // contact.phones[0].number access
}
```

## Optional vs required nested

```typescript
// Optional (may not exist)
@prop({ type: () => MetadataClass })
public metadata?: MetadataClass;

// Required but can be null
@prop({ type: () => MetadataClass, default: null })
public metadata!: MetadataClass | null;

// Required, always present
@prop({ type: () => MetadataClass, default: () => new MetadataClass() })
public metadata!: MetadataClass;
```

## Shared schema fragments

Reuse nested structures across multiple models:

```typescript
// In apps/server/src/db/schemas/common.ts
export class GeoPointClass {
  @prop({ required: true })
  public latitude!: number;

  @prop({ required: true })
  public longitude!: number;
}

// In models
class VenueClass {
  @prop({ type: () => GeoPointClass })
  public location!: GeoPointClass;
}

class EventClass {
  @prop({ type: () => GeoPointClass })
  public coordinates!: GeoPointClass;
}
```
