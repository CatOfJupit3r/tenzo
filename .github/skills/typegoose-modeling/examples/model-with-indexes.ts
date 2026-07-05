// Example: Typegoose model with compound indexes
// Location: apps/server/src/db/models/indexed-example.model.ts

import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose';
import type { DocumentType } from '@typegoose/typegoose';

import { idProp } from '../prop';

// Compound indexes are defined at the class level with @index decorator
@index({ ownerId: 1, createdAt: -1 }) // Index for querying user's items by date
@index({ status: 1, archived: 1 }) // Index for filtering by status and archived
@index({ userId: 1, itemId: 1 }, { unique: true }) // Unique compound index
@modelOptions({
  schemaOptions: {
    collection: 'indexed_examples',
    timestamps: true,
  },
})
class IndexedExampleClass {
  @idProp()
  public _id!: string;

  // Single field indexes can be defined in the decorator
  @prop({ required: true, index: true })
  public ownerId!: string;

  @prop({ required: true, unique: true })
  public itemId!: string;

  @prop({ required: true, index: true })
  public userId!: string;

  @prop({ required: true, enum: ['ACTIVE', 'PENDING', 'COMPLETED'] })
  public status!: 'ACTIVE' | 'PENDING' | 'COMPLETED';

  @prop({ default: false })
  public archived!: boolean;

  public createdAt!: Date;
  public updatedAt!: Date;
}

export const IndexedExampleModel = getModelForClass(IndexedExampleClass);
export type IndexedExampleDoc = DocumentType<IndexedExampleClass>;

// The resulting indexes:
// 1. ownerId (single field, ascending)
// 2. itemId (single field, unique, ascending)
// 3. userId (single field, ascending)
// 4. { ownerId: 1, createdAt: -1 } (compound)
// 5. { status: 1, archived: 1 } (compound)
// 6. { userId: 1, itemId: 1 } (compound, unique)
