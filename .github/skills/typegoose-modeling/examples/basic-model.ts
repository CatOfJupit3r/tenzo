// Example: Basic Typegoose model with @prop decorator
// Location: apps/server/src/db/models/example.model.ts

import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import type { DocumentType } from '@typegoose/typegoose';

import { idProp } from '../prop';

@modelOptions({
  schemaOptions: {
    collection: 'examples',
    timestamps: true,
  },
})
class ExampleClass {
  // ObjectId field with auto-generation using idProp helper
  @idProp()
  public _id!: string;

  // Required string field
  @prop({ required: true })
  public name!: string;

  // String field with index
  @prop({ required: true, index: true })
  public ownerId!: string;

  // Optional string field with max length
  @prop({ maxlength: 500 })
  public description?: string;

  // Boolean field with default
  @prop({ default: false })
  public archived!: boolean;

  // Date field
  @prop({ default: () => new Date() })
  public lastModified!: Date;

  // Timestamps (added by Mongoose automatically)
  public createdAt!: Date;
  public updatedAt!: Date;
}

// Export the model and type
export const ExampleModel = getModelForClass(ExampleClass);
export type ExampleDoc = DocumentType<ExampleClass>;
