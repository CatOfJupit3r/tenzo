import { Hono } from 'hono';
import { describeRoute, validator } from 'hono-openapi';
import z from 'zod';

import { AuthService } from '@~/features/auth/auth.service';
import type { iRequestContext } from '@~/features/logger/logger.types';

const nonContractRouter = new Hono<iRequestContext>();

nonContractRouter.get(
  'dev-tools/impersonate/:userId',
  describeRoute({
    summary: 'Impersonate a user by userId',
    description: 'Creates a session for the specified userId for development purposes',
    tags: ['Dev Tools'],
  }),
  validator('param', z.object({ userId: z.string().min(1) })),
  async (c) => {
    if (process.env.NODE_ENV === 'production') return c.notFound();

    const { userId } = c.req.valid('param');

    const auth = c.var.resolve(AuthService).getInstance();
    const { headers, response } = await auth.api.devImpersonateUser({
      body: { userId },
      returnHeaders: true,
    });

    if (!response) {
      return c.json({ error: 'Failed to create impersonation session' }, 500);
    }

    // Transfer all Set-Cookie headers from Better Auth response
    const match = headers.get('set-cookie')?.match(/better-auth\.session_token=([^;]+);/);
    const token = match ? match[1] : null;
    if (!token) return c.json({ error: 'No session cookie set in impersonation response' }, 500);

    c.header('set-cookie', `better-auth.session_token=${token}; Path=/; HttpOnly`, { append: true });

    return c.json({
      message: `Impersonation session created for userId: ${userId}`,
      session: response.session,
      user: response.user,
    });
  },
);

export default nonContractRouter;
