import { z } from 'zod';

import { loggerFactory } from '@~/lib/logging/logger';

import { REQUEST_MODES } from '../generation/generation-config';
import type { RequestMode } from '../generation/generation-config';
import { mergeModelCapabilities, readModelCapabilities } from './model-capabilities';
import type { iModelCapabilities, iModelProviderOption } from './model-capabilities';
import { normalizeOpenAiCompatibleBaseUrl } from './openai-compatible-endpoint';

export const PROVIDER_KIND_SCHEMA = z.enum(['koboldcpp', 'openrouter', 'openai-compatible', 'unknown']);
export const PROVIDER_KINDS = PROVIDER_KIND_SCHEMA.enum;
export type ProviderKind = z.infer<typeof PROVIDER_KIND_SCHEMA>;

export function isKoboldCppModel(model: string) {
  return model.trim().toLowerCase().startsWith('koboldcpp/');
}

export interface iConnectionHealthRequest {
  endpoint: string;
  apiKey: string;
  requestMode: RequestMode;
  model?: string;
  openRouterProvider?: string;
}

export interface iConnectionHealthResult {
  providerName: string | null;
  providerKind: ProviderKind;
  models: iProviderModelOption[];
  currentModel: string | null;
  contextSize: number | null;
  modelContextSizes: Record<string, number>;
  modelCapabilities: Record<string, iModelCapabilities>;
  modelProviders: iModelProviderOption[];
}

export interface iProviderModelOption {
  label: string;
  value: string;
}

interface iFetchJsonResult {
  isOk: boolean;
  status: number;
  data: unknown;
}

interface iParsedFetchJsonResult<T> {
  isOk: boolean;
  status: number;
  data: T | null;
}

type JsonFetcher = (url: string, init?: RequestInit) => Promise<iFetchJsonResult>;

interface iEndpointCandidates {
  baseUrl: string;
  modelsUrl: string;
  koboldModelUrl: string;
  koboldContextUrl: string;
  koboldPublicContextUrl: string;
  propsUrl: string;
  serviceInfoUrl: string;
  modelEndpointsUrl: string | null;
}

const PROVIDER_KIND_LABELS = {
  [PROVIDER_KINDS.koboldcpp]: 'KoboldCpp',
  [PROVIDER_KINDS.openrouter]: 'OpenRouter',
  [PROVIDER_KINDS['openai-compatible']]: 'OpenAI-compatible',
  [PROVIDER_KINDS.unknown]: 'Unknown provider',
} satisfies Record<ProviderKind, string>;
const PROVIDER_HEALTH_LOGGER = loggerFactory.getLogger('provider.health');

function buildEndpointCandidates(endpoint: string, model?: string): iEndpointCandidates {
  const openAiBaseUrl = normalizeOpenAiCompatibleBaseUrl(endpoint);
  const baseUrl = openAiBaseUrl.slice(0, -'/v1'.length);
  const isOpenRouter = openAiBaseUrl.toLowerCase().includes('openrouter.ai/api');
  const modelPath = model
    ?.trim()
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return {
    baseUrl: openAiBaseUrl,
    modelsUrl: `${openAiBaseUrl}/models`,
    koboldModelUrl: `${baseUrl}/api/v1/model`,
    koboldContextUrl: `${baseUrl}/api/extra/true_max_context_length`,
    koboldPublicContextUrl: `${baseUrl}/api/v1/config/max_context_length`,
    propsUrl: `${baseUrl}/props`,
    serviceInfoUrl: `${baseUrl}/.well-known/serviceinfo`,
    modelEndpointsUrl: isOpenRouter && modelPath ? `${openAiBaseUrl}/models/${modelPath}/endpoints` : null,
  };
}

function buildHealthHeaders(apiKey: string) {
  const headers = new Headers();

  if (apiKey.trim()) {
    headers.set('Authorization', `Bearer ${apiKey.trim()}`);
  }

  return headers;
}

async function fetchJson(url: string, init?: RequestInit): Promise<iFetchJsonResult> {
  const response = await fetch(url, init);
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return {
      isOk: response.ok,
      status: response.status,
      data: (await response.json()) as unknown,
    };
  }

  return {
    isOk: response.ok,
    status: response.status,
    data: await response.text(),
  };
}

const OPTIONAL_TRIMMED_STRING_SCHEMA = z
  .string()
  .transform((value) => value.trim() || undefined)
  .optional()
  .catch(() => undefined);
const POSITIVE_INTEGER_SCHEMA = z
  .number()
  .finite()
  .positive()
  .transform((value) => Math.floor(value));
const OPTIONAL_POSITIVE_INTEGER_SCHEMA = z
  .number()
  .finite()
  .positive()
  .transform((value) => Math.floor(value))
  .optional()
  .catch(() => undefined);
const SUPPORTED_PARAMETERS_SCHEMA = z
  .array(z.string())
  .optional()
  .catch(() => undefined);

const PROVIDER_MODEL_ENTRY_SCHEMA = z.union([
  z.string().trim().min(1),
  z
    .object({
      id: OPTIONAL_TRIMMED_STRING_SCHEMA,
      model_name: OPTIONAL_TRIMMED_STRING_SCHEMA,
      name: OPTIONAL_TRIMMED_STRING_SCHEMA,
      context_length: OPTIONAL_POSITIVE_INTEGER_SCHEMA,
      context_window: OPTIONAL_POSITIVE_INTEGER_SCHEMA,
      max_context_length: OPTIONAL_POSITIVE_INTEGER_SCHEMA,
      supported_parameters: SUPPORTED_PARAMETERS_SCHEMA,
    })
    .passthrough(),
]);
type iProviderModelEntry = z.infer<typeof PROVIDER_MODEL_ENTRY_SCHEMA>;

const OPENAI_MODELS_RESPONSE_SCHEMA = z.union([
  z.array(PROVIDER_MODEL_ENTRY_SCHEMA),
  z
    .object({
      data: z.array(PROVIDER_MODEL_ENTRY_SCHEMA).optional(),
      models: z.array(PROVIDER_MODEL_ENTRY_SCHEMA).optional(),
    })
    .passthrough(),
]);
type iOpenAiModelsResponse = z.infer<typeof OPENAI_MODELS_RESPONSE_SCHEMA>;

const OPENROUTER_ENDPOINT_SCHEMA = z
  .object({
    tag: OPTIONAL_TRIMMED_STRING_SCHEMA,
    provider_name: OPTIONAL_TRIMMED_STRING_SCHEMA,
    supported_parameters: SUPPORTED_PARAMETERS_SCHEMA,
  })
  .passthrough();
const OPENROUTER_ENDPOINTS_RESPONSE_SCHEMA = z
  .object({
    data: z
      .object({
        endpoints: z.array(OPENROUTER_ENDPOINT_SCHEMA).catch([]),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
type iOpenRouterEndpointsResponse = z.infer<typeof OPENROUTER_ENDPOINTS_RESPONSE_SCHEMA>;

const KOBOLD_MODEL_RESPONSE_SCHEMA = z.union([
  z.string().transform((value) => value.trim()),
  z
    .object({
      result: z.union([
        OPTIONAL_TRIMMED_STRING_SCHEMA,
        z.object({ result: OPTIONAL_TRIMMED_STRING_SCHEMA }).passthrough(),
      ]),
      model: OPTIONAL_TRIMMED_STRING_SCHEMA,
    })
    .passthrough(),
]);
type iKoboldModelResponse = z.infer<typeof KOBOLD_MODEL_RESPONSE_SCHEMA>;

const CONTEXT_RESPONSE_SCHEMA = z.union([
  POSITIVE_INTEGER_SCHEMA,
  z
    .object({
      default_generation_settings: z.object({ n_ctx: OPTIONAL_POSITIVE_INTEGER_SCHEMA }).passthrough().optional(),
      value: OPTIONAL_POSITIVE_INTEGER_SCHEMA,
    })
    .passthrough(),
]);
type iContextResponse = z.infer<typeof CONTEXT_RESPONSE_SCHEMA>;

const SERVICE_INFO_RESPONSE_SCHEMA = z.union([
  z.string().transform((value) => value.trim()),
  z
    .object({
      software: z.object({ name: OPTIONAL_TRIMMED_STRING_SCHEMA }).passthrough().optional(),
      result: OPTIONAL_TRIMMED_STRING_SCHEMA,
    })
    .passthrough(),
]);
type iServiceInfoResponse = z.infer<typeof SERVICE_INFO_RESPONSE_SCHEMA>;

function parseProbeResult<T>(
  response: iFetchJsonResult | null,
  schema: z.ZodType<T>,
): iParsedFetchJsonResult<T> | null {
  if (!response) {
    return null;
  }

  const parsed = schema.safeParse(response.data);
  return {
    ...response,
    data: parsed.success ? parsed.data : null,
  };
}

function extractModels(payload: iOpenAiModelsResponse): iProviderModelOption[] {
  const discoveredModels = new Map<string, iProviderModelOption>();

  const pushModel = (entry: iProviderModelEntry) => {
    if (typeof entry === 'string') {
      discoveredModels.set(entry, { label: entry, value: entry });
      return;
    }

    const canonicalName = entry.id ?? entry.model_name ?? entry.name;
    if (canonicalName) {
      const previewLabel = entry.name;
      discoveredModels.set(canonicalName, {
        label: previewLabel && previewLabel !== canonicalName ? `${previewLabel} (${canonicalName})` : canonicalName,
        value: canonicalName,
      });
    }
  };

  if (Array.isArray(payload)) {
    payload.forEach(pushModel);
  }

  if (!Array.isArray(payload)) {
    payload.data?.forEach(pushModel);
    payload.models?.forEach(pushModel);
  }

  return [...discoveredModels.values()];
}

function extractModelContextSizes(payload: iOpenAiModelsResponse) {
  const modelContextSizes: Record<string, number> = {};
  const candidates = Array.isArray(payload) ? payload : (payload.data ?? []);

  candidates.forEach((entry) => {
    if (typeof entry === 'string') {
      return;
    }

    const model = entry.id ?? entry.name;
    const contextSize = entry.context_length ?? entry.context_window ?? entry.max_context_length;

    if (model && contextSize) {
      modelContextSizes[model] = contextSize;
    }
  });

  return modelContextSizes;
}

function extractModelCapabilities(payload: iOpenAiModelsResponse) {
  const modelCapabilities: Record<string, iModelCapabilities> = {};
  const candidates = Array.isArray(payload) ? payload : (payload.data ?? []);

  candidates.forEach((entry) => {
    if (typeof entry === 'string') {
      return;
    }

    const model = entry.id ?? entry.name;
    const capabilities = readModelCapabilities(entry.supported_parameters);
    if (model && capabilities) {
      modelCapabilities[model] = capabilities;
    }
  });

  return modelCapabilities;
}

function extractModelProviders(payload: iOpenRouterEndpointsResponse): iModelProviderOption[] {
  const endpoints = payload.data?.endpoints ?? [];

  const providers = new Map<string, { name: string; capabilities: iModelCapabilities[] }>();
  endpoints.forEach((endpoint) => {
    const { tag } = endpoint;
    const slug = tag?.split('/')[0] ?? null;
    const name = endpoint.provider_name;
    const capabilities = readModelCapabilities(endpoint.supported_parameters);
    if (!slug || !name || !capabilities) {
      return;
    }

    const existing = providers.get(slug);
    providers.set(slug, {
      name,
      capabilities: [...(existing?.capabilities ?? []), capabilities],
    });
  });

  return [...providers.entries()].flatMap(([slug, provider]) => {
    const capabilities = mergeModelCapabilities(provider.capabilities);
    return capabilities ? [{ slug, name: provider.name, capabilities }] : [];
  });
}

function extractCurrentModel(payload: iKoboldModelResponse) {
  if (typeof payload === 'string') {
    return payload || null;
  }

  const nestedResult = typeof payload.result === 'object' ? payload.result.result : undefined;
  return nestedResult ?? (typeof payload.result === 'string' ? payload.result : undefined) ?? payload.model ?? null;
}

function extractContextSize(payload: iContextResponse) {
  if (typeof payload === 'number') {
    return payload;
  }

  return payload.default_generation_settings?.n_ctx ?? payload.value ?? null;
}

function extractProviderName(payload: iServiceInfoResponse) {
  if (typeof payload === 'string') {
    return payload || null;
  }

  return payload.software?.name ?? payload.result ?? null;
}

async function probeProviderMetadataWithFetcher(request: iConnectionHealthRequest, jsonFetcher: JsonFetcher) {
  const candidates = buildEndpointCandidates(request.endpoint, request.model);
  const headers = buildHealthHeaders(request.apiKey);
  const requestInit = {
    method: 'GET',
    headers,
  } satisfies RequestInit;

  const [
    rawModelsResponse,
    rawKoboldModelResponse,
    rawKoboldContextResponse,
    rawKoboldPublicContextResponse,
    rawPropsResponse,
    rawServiceInfoResponse,
    rawModelEndpointsResponse,
  ] = await Promise.all([
    jsonFetcher(candidates.modelsUrl, requestInit).catch(() => null),
    jsonFetcher(candidates.koboldModelUrl, requestInit).catch(() => null),
    jsonFetcher(candidates.koboldContextUrl, requestInit).catch(() => null),
    jsonFetcher(candidates.koboldPublicContextUrl, requestInit).catch(() => null),
    jsonFetcher(candidates.propsUrl, requestInit).catch(() => null),
    jsonFetcher(candidates.serviceInfoUrl, requestInit).catch(() => null),
    candidates.modelEndpointsUrl
      ? jsonFetcher(candidates.modelEndpointsUrl, requestInit).catch(() => null)
      : Promise.resolve(null),
  ]);
  const modelsResponse = parseProbeResult(rawModelsResponse, OPENAI_MODELS_RESPONSE_SCHEMA);
  const koboldModelResponse = parseProbeResult(rawKoboldModelResponse, KOBOLD_MODEL_RESPONSE_SCHEMA);
  const koboldContextResponse = parseProbeResult(rawKoboldContextResponse, CONTEXT_RESPONSE_SCHEMA);
  const koboldPublicContextResponse = parseProbeResult(rawKoboldPublicContextResponse, CONTEXT_RESPONSE_SCHEMA);
  const propsResponse = parseProbeResult(rawPropsResponse, CONTEXT_RESPONSE_SCHEMA);
  const serviceInfoResponse = parseProbeResult(rawServiceInfoResponse, SERVICE_INFO_RESPONSE_SCHEMA);
  const modelEndpointsResponse = parseProbeResult(rawModelEndpointsResponse, OPENROUTER_ENDPOINTS_RESPONSE_SCHEMA);
  const requestedModel = OPTIONAL_TRIMMED_STRING_SCHEMA.parse(request.model);

  const probeResults = [
    { category: 'models', isAttempted: true, result: modelsResponse },
    { category: 'kobold-model', isAttempted: true, result: koboldModelResponse },
    { category: 'kobold-context', isAttempted: true, result: koboldContextResponse },
    { category: 'kobold-public-context', isAttempted: true, result: koboldPublicContextResponse },
    { category: 'properties', isAttempted: true, result: propsResponse },
    { category: 'service-info', isAttempted: true, result: serviceInfoResponse },
    { category: 'model-endpoints', isAttempted: candidates.modelEndpointsUrl !== null, result: modelEndpointsResponse },
  ] as const;
  const attemptedProbeResults = probeResults.filter((probe) => probe.isAttempted);
  const successfulProbeCategories = attemptedProbeResults
    .filter((probe) => probe.result?.isOk === true)
    .map((probe) => probe.category);
  PROVIDER_HEALTH_LOGGER.debug('Provider metadata probe completed', {
    operation: 'probe-provider-metadata',
    requestMode: request.requestMode,
    model: requestedModel,
    attemptedProbeCount: attemptedProbeResults.length,
    successfulProbeCount: successfulProbeCategories.length,
    successfulProbeCategories,
    failedProbeCount: attemptedProbeResults.length - successfulProbeCategories.length,
  });

  const models = modelsResponse?.isOk && modelsResponse.data ? extractModels(modelsResponse.data) : [];
  const modelContextSizes =
    modelsResponse?.isOk && modelsResponse.data ? extractModelContextSizes(modelsResponse.data) : {};
  const modelCapabilities =
    modelsResponse?.isOk && modelsResponse.data ? extractModelCapabilities(modelsResponse.data) : {};
  const modelProviders =
    modelEndpointsResponse?.isOk && modelEndpointsResponse.data
      ? extractModelProviders(modelEndpointsResponse.data)
      : [];
  const currentModel =
    koboldModelResponse?.isOk && koboldModelResponse.data ? extractCurrentModel(koboldModelResponse.data) : null;
  const endpointContextSize =
    (koboldContextResponse?.isOk && koboldContextResponse.data
      ? extractContextSize(koboldContextResponse.data)
      : null) ??
    (koboldPublicContextResponse?.isOk && koboldPublicContextResponse.data
      ? extractContextSize(koboldPublicContextResponse.data)
      : null) ??
    (propsResponse?.isOk && propsResponse.data ? extractContextSize(propsResponse.data) : null);
  const selectedModel = requestedModel ?? currentModel;
  const selectedModelCapabilities = mergeModelCapabilities(modelProviders.map((provider) => provider.capabilities));
  if (selectedModel && selectedModelCapabilities) {
    modelCapabilities[selectedModel] = selectedModelCapabilities;
  }
  const contextSize = endpointContextSize ?? (selectedModel ? (modelContextSizes[selectedModel] ?? null) : null);

  const detectedModels =
    currentModel && !models.some((model) => model.value === currentModel)
      ? [{ label: currentModel, value: currentModel }, ...models]
      : models;
  const providerName =
    serviceInfoResponse?.isOk && serviceInfoResponse.data ? extractProviderName(serviceInfoResponse.data) : null;
  const hasKoboldMetadata =
    koboldModelResponse?.isOk === true ||
    koboldContextResponse?.isOk === true ||
    koboldPublicContextResponse?.isOk === true;
  const isKoboldCpp = (providerName?.toLowerCase().includes('koboldcpp') ?? false) || hasKoboldMetadata;
  const isOpenRouter = candidates.baseUrl.toLowerCase().includes('openrouter.ai/api');
  const hasOpenAiSurface = Boolean(modelsResponse?.isOk);

  if (!isKoboldCpp && !hasOpenAiSurface && !contextSize) {
    const authHint = request.apiKey.trim() ? '' : ' Add an API key if the provider requires one.';
    const modeHint =
      request.requestMode === REQUEST_MODES.browser
        ? ' If this provider blocks browser CORS requests, enable the server proxy and retry.'
        : '';

    throw new Error(`Unable to infer models or context size from this endpoint.${authHint}${modeHint}`.trim());
  }

  let resolvedProviderName = providerName;

  if (!resolvedProviderName) {
    if (isKoboldCpp) {
      resolvedProviderName = PROVIDER_KIND_LABELS[PROVIDER_KINDS.koboldcpp];
    } else if (isOpenRouter) {
      resolvedProviderName = PROVIDER_KIND_LABELS[PROVIDER_KINDS.openrouter];
    } else if (hasOpenAiSurface) {
      resolvedProviderName = PROVIDER_KIND_LABELS[PROVIDER_KINDS['openai-compatible']];
    }
  }

  let providerKind: ProviderKind = PROVIDER_KINDS.unknown;

  if (isKoboldCpp) {
    providerKind = PROVIDER_KINDS.koboldcpp;
  } else if (isOpenRouter) {
    providerKind = PROVIDER_KINDS.openrouter;
  } else if (hasOpenAiSurface) {
    providerKind = PROVIDER_KINDS['openai-compatible'];
  }

  return {
    providerName: resolvedProviderName,
    providerKind,
    models: detectedModels,
    currentModel,
    contextSize,
    modelContextSizes,
    modelCapabilities,
    modelProviders,
  } satisfies iConnectionHealthResult;
}

export async function probeProviderMetadata(request: iConnectionHealthRequest) {
  return probeProviderMetadataWithFetcher(request, fetchJson);
}

export async function probeProviderMetadataWithProxyFetcher(
  request: iConnectionHealthRequest,
  jsonFetcher: JsonFetcher,
) {
  return probeProviderMetadataWithFetcher(request, jsonFetcher);
}
