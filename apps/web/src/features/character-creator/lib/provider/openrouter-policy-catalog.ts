import { z } from 'zod';

import { MODEL_CAPABILITIES, readModelCapabilities } from './model-capabilities';
import type { iProviderPolicyCatalog } from './provider-policy-resolver';

const OPTIONAL_STRING_SCHEMA = z.string().trim().min(1).optional();
const OPENROUTER_POLICY_MODEL_SCHEMA = z
  .object({
    id: z.string().trim().min(1),
    top_provider: z.object({ is_moderated: z.boolean() }).passthrough(),
  })
  .passthrough();
const OPENROUTER_POLICY_MODELS_RESPONSE_SCHEMA = z
  .object({ data: z.array(OPENROUTER_POLICY_MODEL_SCHEMA) })
  .passthrough();

export const OPENROUTER_ZDR_ENDPOINT_SCHEMA = z
  .object({
    model_id: OPTIONAL_STRING_SCHEMA,
    tag: OPTIONAL_STRING_SCHEMA,
    supported_parameters: z.array(z.string()).optional(),
    status: z.number().int().optional(),
    pricing: z
      .object({
        prompt: OPTIONAL_STRING_SCHEMA,
        completion: OPTIONAL_STRING_SCHEMA,
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
export const OPENROUTER_ZDR_ENDPOINTS_RESPONSE_SCHEMA = z
  .object({ data: z.array(OPENROUTER_ZDR_ENDPOINT_SCHEMA).catch([]) })
  .passthrough();

function readPricePerMillion(value: string | undefined): number | null {
  if (value === undefined) return null;
  const price = Number(value) * 1_000_000;
  return Number.isFinite(price) && price >= 0 ? price : null;
}

export function buildOpenRouterPolicyCatalog(
  modelsPayload: unknown,
  zdrPayload: unknown,
  selectedModel: string,
  now: Date,
): iProviderPolicyCatalog | null {
  const modelsResult = OPENROUTER_POLICY_MODELS_RESPONSE_SCHEMA.safeParse(modelsPayload);
  const zdrResult = OPENROUTER_ZDR_ENDPOINTS_RESPONSE_SCHEMA.safeParse(zdrPayload);
  if (!modelsResult.success || !zdrResult.success) return null;

  const model = modelsResult.data.data.find((candidate) => candidate.id === selectedModel);
  if (!model) return null;
  const endpoints = zdrResult.data.data.flatMap((endpoint) => {
    if (endpoint.model_id !== selectedModel) return [];
    const providerSlug = endpoint.tag?.split('/')[0];
    const capabilities = readModelCapabilities(endpoint.supported_parameters);
    const promptPricePerMillionUsd = readPricePerMillion(endpoint.pricing?.prompt);
    const completionPricePerMillionUsd = readPricePerMillion(endpoint.pricing?.completion);
    if (!providerSlug || !capabilities || promptPricePerMillionUsd === null || completionPricePerMillionUsd === null) {
      return [];
    }

    return [
      {
        providerSlug,
        isZeroDataRetention: true,
        doesCollectData: false,
        isAvailable: endpoint.status === 0,
        supportedCapabilities: Object.values(MODEL_CAPABILITIES).filter((capability) => capabilities[capability]),
        promptPricePerMillionUsd,
        completionPricePerMillionUsd,
      },
    ];
  });

  return {
    fetchedAt: now.toISOString(),
    models: [{ modelId: selectedModel, isModerated: model.top_provider.is_moderated, endpoints }],
  };
}
