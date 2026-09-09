import { createServerFn } from '@tanstack/react-start';
import z from 'zod';

import { MEDIA_TYPES } from '@~/lib/media-type-enums';

import { REQUEST_MODE_SCHEMA } from '../generation/generation-config';
import { probeProviderMetadataWithProxyFetcher } from './provider-health';

const providerHealthInputSchema = z.object({
  endpoint: z.string().trim().min(1),
  apiKey: z.string(),
  requestMode: REQUEST_MODE_SCHEMA,
  model: z.string().optional(),
  openRouterProvider: z.string().optional(),
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
        data: contentType.includes(MEDIA_TYPES.JSON) ? ((await response.json()) as unknown) : await response.text(),
      };
    }),
  );
