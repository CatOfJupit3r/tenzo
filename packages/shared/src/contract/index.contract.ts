import { oc } from '@orpc/contract';
import z from 'zod';

const healthCheck = oc
  .route({
    path: '/health',
    method: 'GET',
  })
  .output(
    z.object({
      status: z.string(),
    }),
  );

const metrics = oc
  .route({
    path: '/metrics',
    method: 'GET',
  })
  .output(
    z.object({
      totalUsers: z.number().int().nonnegative(),
      activeSessions: z.number().int().nonnegative(),
    }),
  );

const indexContract = oc.router({
  healthCheck,
  metrics,
});

export default indexContract;
