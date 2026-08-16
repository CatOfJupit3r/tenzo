import { describe, expect, it, vi } from 'vitest';

import { createOpenRouterErrorPreservingHttpClient } from './openrouter-stream-error';

describe('OpenRouter stream errors', () => {
  it('preserves metadata that the OpenRouter SDK otherwise strips', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          'data: {"error":{"code":400,"message":"Provider returned error","metadata":{"provider_name":"Example","raw":"invalid tool arguments"}}}\n\n',
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      );

    const response = await createOpenRouterErrorPreservingHttpClient().request(new Request('https://openrouter.test'));

    await expect(response.text()).resolves.toContain(
      'Provider returned error | code: 400 | provider_name: Example | invalid tool arguments',
    );
    fetchMock.mockRestore();
  });
});
