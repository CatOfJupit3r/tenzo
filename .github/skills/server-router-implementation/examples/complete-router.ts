// Example: Server router implementation with error handling
// Location: apps/server/src/routers/example.router.ts

import { publicProcedure, protectedProcedure } from '@~/lib/orpc';
import { base } from './base';
import { exampleContract } from '@startername/shared/contract';
import { ExampleModel } from '@~/db/models/example.model';
import { ERROR_CODES } from '@startername/shared/enums/errors';
import { ORPCNotFoundError, ORPCForbiddenError } from '@~/lib/orpc-error-wrapper';
import { ObjectIdString } from '@~/db/helpers';

export const exampleRouter = base.example.router({
  // Public procedure - no authentication
  listPublicExamples: publicProcedure
    .use(exampleContract.listPublicExamples)
    .handler(async ({ input }) => {
      const { limit = 20, offset = 0, search } = input;

      const query: any = { archived: false, visibility: 'PUBLIC' };
      if (search) {
        query.name = { $regex: search, $options: 'i' };
      }

      const [examples, total] = await Promise.all([
        ExampleModel.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(offset)
          .lean(),
        ExampleModel.countDocuments(query),
      ]);

      return { examples, total };
    }),

  // Protected procedure - requires authentication
  createExample: protectedProcedure
    .use(exampleContract.createExample)
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const example = await ExampleModel.create({
        _id: ObjectIdString(),
        name: input.name,
        description: input.description,
        ownerId: userId,
        archived: false,
      });

      return example;
    }),

  // Protected procedure with access control
  getExample: protectedProcedure
    .use(exampleContract.getExample)
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const example = await ExampleModel.findById(input.id);

      // Use NOT_FOUND if user can't see it (prevents information leakage)
      if (!example) {
        throw ORPCNotFoundError(ERROR_CODES.EXAMPLE_NOT_FOUND);
      }

      // If private and not the owner, hide its existence
      if (example.visibility === 'PRIVATE' && example.ownerId !== userId) {
        throw ORPCNotFoundError(ERROR_CODES.EXAMPLE_NOT_FOUND);
      }

      return example;
    }),

  // Protected procedure with permission check
  updateExample: protectedProcedure
    .use(exampleContract.updateExample)
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const example = await ExampleModel.findById(input.id);

      if (!example) {
        throw ORPCNotFoundError(ERROR_CODES.EXAMPLE_NOT_FOUND);
      }

      // Use FORBIDDEN only when user can see but can't modify
      if (example.ownerId !== userId) {
        throw ORPCForbiddenError(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      }

      // Update fields
      if (input.name) example.name = input.name;
      if (input.description !== undefined) example.description = input.description;

      await example.save();

      return example;
    }),

  // Protected procedure with deletion (soft delete)
  deleteExample: protectedProcedure
    .use(exampleContract.deleteExample)
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const example = await ExampleModel.findById(input.id);

      if (!example || example.ownerId !== userId) {
        throw ORPCNotFoundError(ERROR_CODES.EXAMPLE_NOT_FOUND);
      }

      // Soft delete by archiving
      example.archived = true;
      await example.save();

      return { success: true };
    }),
});
