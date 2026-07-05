// Example: Typegoose model with embedded documents
// Location: apps/server/src/db/models/embedded-example.model.ts

import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import type { DocumentType } from '@typegoose/typegoose';

import { idProp } from '../prop';

// Embedded document class for a single address
class AddressClass {
  @prop({ required: true })
  public street!: string;

  @prop({ required: true })
  public city!: string;

  @prop({ required: true })
  public zipCode!: string;

  @prop()
  public country?: string;
}

// Embedded document class for order items
class OrderItemClass {
  @idProp()
  public _id!: string;

  @prop({ required: true })
  public productId!: string;

  @prop({ required: true })
  public name!: string;

  @prop({ required: true, min: 1 })
  public quantity!: number;

  @prop({ required: true, min: 0 })
  public price!: number;
}

// Embedded document class for member info
class MemberClass {
  @prop({ required: true })
  public userId!: string;

  @prop({ required: true, enum: ['ADMIN', 'MEMBER', 'GUEST'] })
  public role!: 'ADMIN' | 'MEMBER' | 'GUEST';

  @prop({ default: () => new Date() })
  public joinedAt!: Date;
}

@modelOptions({
  schemaOptions: {
    collection: 'embedded_examples',
    timestamps: true,
  },
})
class EmbeddedExampleClass {
  @idProp()
  public _id!: string;

  @prop({ required: true })
  public name!: string;

  // Single embedded document (optional) - requires explicit type
  @prop({ type: () => AddressClass })
  public primaryAddress?: AddressClass;

  // Array of embedded documents - requires explicit type
  @prop({ type: () => [AddressClass], default: [] })
  public addresses!: AddressClass[];

  // Array of embedded documents with IDs
  @prop({ type: () => [OrderItemClass], default: [] })
  public items!: OrderItemClass[];

  // Array of embedded documents for team members
  @prop({ type: () => [MemberClass], default: [] })
  public members!: MemberClass[];

  public createdAt!: Date;
  public updatedAt!: Date;
}

export const EmbeddedExampleModel = getModelForClass(EmbeddedExampleClass);
export type EmbeddedExampleDoc = DocumentType<EmbeddedExampleClass>;

// Usage example:
// const doc = await EmbeddedExampleModel.create({
//   _id: ObjectIdString(),
//   name: 'Example',
//   primaryAddress: {
//     street: '123 Main St',
//     city: 'Springfield',
//     zipCode: '12345',
//   },
//   items: [
//     {
//       _id: ObjectIdString(),
//       productId: 'prod-123',
//       name: 'Widget',
//       quantity: 2,
//       price: 9.99,
//     },
//   ],
//   members: [
//     {
//       userId: 'user-123',
//       role: 'ADMIN',
//     },
//   ],
// });
