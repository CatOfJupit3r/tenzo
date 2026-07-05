// Example: Creating an oRPC contract with input/output schemas
// Location: packages/shared/src/contract/example.contract.ts

import { oc } from '@orpc/server';
import z from 'zod';
import { authProcedure } from './base';

// Define reusable schemas
const exampleSchema = z.object({
  _id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  createdAt: z.string(),
});

// Export the contract router
export const exampleContract = oc.router({
  // Public endpoint - no authentication required
  listPublicExamples: oc
    .route({
      method: 'GET',
      path: '/examples',
      summary: 'List all public examples',
      description: 'Retrieves a paginated list of public examples with optional filtering',
    })
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
      })
    )
    .output(
      z.object({
        examples: z.array(exampleSchema),
        total: z.number(),
      })
    ),

  // Protected endpoint - requires authentication
  createExample: oc
    .route({
      method: 'POST',
      path: '/examples',
      summary: 'Create a new example',
      description: 'Creates a new example owned by the authenticated user',
    })
    .input(
      z.object({
        name: z.string().min(1, 'Name is required'),
        description: z.string().max(500).optional(),
      })
    )
    .output(exampleSchema)
    .use(authProcedure),  // This makes it require authentication

  // Protected endpoint with ID parameter
  getExample: oc
    .route({
      method: 'GET',
      path: '/examples/:id',
      summary: 'Get example by ID',
      description: 'Retrieves a single example by its ID. User must be the owner or the example must be public.',
    })
    .input(
      z.object({
        id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format'),
      })
    )
    .output(exampleSchema)
    .use(authProcedure),

  // Protected endpoint for updates
  updateExample: oc
    .route({
      method: 'PATCH',
      path: '/examples/:id',
      summary: 'Update an example',
      description: 'Updates an example. User must be the owner.',
    })
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().max(500).optional(),
      })
    )
    .output(exampleSchema)
    .use(authProcedure),

  // Protected endpoint for deletion
  deleteExample: oc
    .route({
      method: 'DELETE',
      path: '/examples/:id',
      summary: 'Delete an example',
      description: 'Soft deletes an example by marking it as archived. User must be the owner.',
    })
    .input(
      z.object({
        id: z.string(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
      })
    )
    .use(authProcedure),
});
