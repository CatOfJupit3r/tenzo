import { it, expect, describe } from 'vitest';

import { app } from '../helpers/instance';

describe('Index Test Suite', () => {
  it('GET /health from oRPC returns 200 when called as REST', async () => {
    const res = await app.request('/health', {
      method: 'GET',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'OK' });
  });
});
