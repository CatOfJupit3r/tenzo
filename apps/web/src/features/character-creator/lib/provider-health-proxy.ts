import { createServerFn } from '@tanstack/react-start';
import z from 'zod';

import { probeProviderMetadataWithProxyFetcher } from './provider-health';

const providerHealthInputSchema = z.object({
  endpoint: z.string().trim().min(1),
  apiKey: z.string(),
  requestMode: z.enum(['proxy', 'browser']),
});

export const requestProviderHealthProxy = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => providerHealthInputSchema.parse(data))
  .handler(async ({ data, signal }) =>
    probeProviderMetadataWithProxyFetcher(data, async (url, init) => {
      const response = await fetch(url, {
        ...init,
        signal,
      });
      const contentType = response.headers.get('content-type') ?? '';

      return {
        isOk: response.ok,
        status: response.status,
        data: contentType.includes('application/json') ? ((await response.json()) as unknown) : await response.text(),
      };
    }),
  );