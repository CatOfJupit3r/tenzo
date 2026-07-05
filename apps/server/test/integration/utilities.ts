import type { InjectionToken } from 'tsyringe';
import { container } from 'tsyringe';

import { auth } from '../helpers/instance';

type UserData = NonNullable<Prettify<Parameters<typeof auth.api.signUpEmail>[0]>>['body'];

// Resolve function that mimics @hono/tsyringe's c.var.resolve
function resolve<T>(token: InjectionToken<T>): T {
  return container.resolve(token);
}

// ============================================================================
// User Creation Utilities
// ============================================================================

export function createRandomUser() {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return {
    email: `userapi-${randomSuffix}@example.com`,
    name: `Test User ${randomSuffix}`,
    password: 'password123',
  } satisfies UserData;
}

export async function createUser(newUser: UserData = createRandomUser()) {
  const {
    headers,
    response: { user },
  } = await auth.api.signUpEmail({
    body: newUser,
    returnHeaders: true,
  });

  const cookie = headers.getSetCookie()[0];

  const getSession = await auth.api.getSession({
    headers: {
      cookie,
    },
  });

  if (!getSession?.session) throw new Error('Failed to create user session');
  const { session } = getSession;

  return {
    cookie,
    session,
    user,
    ctx: () => ({
      context: {
        session: {
          user,
          session,
        },
        resolve,
      },
    }),
  };
}
