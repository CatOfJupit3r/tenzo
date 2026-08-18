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

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function readPositiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function extractModels(payload: unknown): iProviderModelOption[] {
  const discoveredModels = new Map<string, iProviderModelOption>();

  const pushModel = (entry: unknown) => {
    if (entry && typeof entry === 'object') {
      const canonicalName =
        readString(Reflect.get(entry, 'id')) ??
        readString(Reflect.get(entry, 'model_name')) ??
        readString(Reflect.get(entry, 'name'));
      if (!canonicalName) {
        return;
      }

      const previewLabel = readString(Reflect.get(entry, 'name'));
      discoveredModels.set(canonicalName, {
        label: previewLabel && previewLabel !== canonicalName ? `${previewLabel} (${canonicalName})` : canonicalName,
        value: canonicalName,
      });
      return;
    }

    const canonicalName = readString(entry);
    if (canonicalName) {
      discoveredModels.set(canonicalName, { label: canonicalName, value: canonicalName });
    }
  };

  if (Array.isArray(payload)) {
    payload.forEach(pushModel);
  }

  if (payload && typeof payload === 'object') {
    const data = Reflect.get(payload, 'data');
    if (Array.isArray(data)) {
      data.forEach(pushModel);
    }

    const models = Reflect.get(payload, 'models');
    if (Array.isArray(models)) {
      models.forEach(pushModel);
    }
  }

  return [...discoveredModels.values()];
}

function extractModelContextSizes(payload: unknown) {
  const modelContextSizes: Record<string, number> = {};
  let candidates: unknown[] = [];

  if (Array.isArray(payload)) {
    candidates = payload;
  } else if (payload && typeof payload === 'object') {
    const data = Reflect.get(payload, 'data');
    candidates = Array.isArray(data) ? data : [];
  }

  candidates.forEach((entry: unknown) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }

    const model = readString(Reflect.get(entry, 'id')) ?? readString(Reflect.get(entry, 'name'));
    const contextSize =
      readPositiveInteger(Reflect.get(entry, 'context_length')) ??
      readPositiveInteger(Reflect.get(entry, 'context_window')) ??
      readPositiveInteger(Reflect.get(entry, 'max_context_length'));

    if (model && contextSize) {
      modelContextSizes[model] = contextSize;
    }
  });

  return modelContextSizes;
}

function extractModelCapabilities(payload: unknown) {
  const modelCapabilities: Record<string, iModelCapabilities> = {};
  let candidates: unknown[] = [];

  if (Array.isArray(payload)) {
    candidates = payload;
  } else if (payload && typeof payload === 'object') {
    const data = Reflect.get(payload, 'data');
    candidates = Array.isArray(data) ? data : [];
  }

  candidates.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }

    const model = readString(Reflect.get(entry, 'id')) ?? readString(Reflect.get(entry, 'name'));
    const capabilities = readModelCapabilities(Reflect.get(entry, 'supported_parameters'));
    if (model && capabilities) {
      modelCapabilities[model] = capabilities;
    }
  });

  return modelCapabilities;
}

function extractModelProviders(payload: unknown): iModelProviderOption[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const data = Reflect.get(payload, 'data');
  if (!data || typeof data !== 'object') {
    return [];
  }

  const endpoints = Reflect.get(data, 'endpoints');
  if (!Array.isArray(endpoints)) {
    return [];
  }

  const providers = new Map<string, { name: string; capabilities: iModelCapabilities[] }>();
  endpoints.forEach((endpoint) => {
    if (!endpoint || typeof endpoint !== 'object') {
      return;
    }

    const tag = readString(Reflect.get(endpoint, 'tag'));
    const slug = tag?.split('/')[0] ?? null;
    const name = readString(Reflect.get(endpoint, 'provider_name'));
    const capabilities = readModelCapabilities(Reflect.get(endpoint, 'supported_parameters'));
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

function extractCurrentModel(payload: unknown) {
  if (payload && typeof payload === 'object') {
    const result = Reflect.get(payload, 'result');
    const nestedResult = result && typeof result === 'object' ? Reflect.get(result, 'result') : undefined;

    return readString(nestedResult) ?? readString(result) ?? readString(Reflect.get(payload, 'model'));
  }

  return readString(payload);
}

function extractContextSize(payload: unknown) {
  if (payload && typeof payload === 'object') {
    const defaultGenerationSettings = Reflect.get(payload, 'default_generation_settings');
    if (defaultGenerationSettings && typeof defaultGenerationSettings === 'object') {
      const nCtx = readPositiveInteger(Reflect.get(defaultGenerationSettings, 'n_ctx'));
      if (nCtx) {
        return nCtx;
      }
    }

    return readPositiveInteger(Reflect.get(payload, 'value'));
  }

  return readPositiveInteger(payload);
}

function extractProviderName(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const software = Reflect.get(payload, 'software');
  if (software && typeof software === 'object') {
    return readString(Reflect.get(software, 'name'));
  }

  return readString(Reflect.get(payload, 'result'));
}

async function probeProviderMetadataWithFetcher(request: iConnectionHealthRequest, jsonFetcher: JsonFetcher) {
  const candidates = buildEndpointCandidates(request.endpoint, request.model);
  const headers = buildHealthHeaders(request.apiKey);
  const requestInit = {
    method: 'GET',
    headers,
  } satisfies RequestInit;

  const [
    modelsResponse,
    koboldModelResponse,
    koboldContextResponse,
    koboldPublicContextResponse,
    propsResponse,
    serviceInfoResponse,
    modelEndpointsResponse,
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
    model: readString(request.model) ?? undefined,
    attemptedProbeCount: attemptedProbeResults.length,
    successfulProbeCount: successfulProbeCategories.length,
    successfulProbeCategories,
    failedProbeCount: attemptedProbeResults.length - successfulProbeCategories.length,
  });

  const models = modelsResponse?.isOk ? extractModels(modelsResponse.data) : [];
  const modelContextSizes = modelsResponse?.isOk ? extractModelContextSizes(modelsResponse.data) : {};
  const modelCapabilities = modelsResponse?.isOk ? extractModelCapabilities(modelsResponse.data) : {};
  const modelProviders = modelEndpointsResponse?.isOk ? extractModelProviders(modelEndpointsResponse.data) : [];
  const currentModel = koboldModelResponse?.isOk ? extractCurrentModel(koboldModelResponse.data) : null;
  const endpointContextSize =
    (koboldContextResponse?.isOk ? extractContextSize(koboldContextResponse.data) : null) ??
    (koboldPublicContextResponse?.isOk ? extractContextSize(koboldPublicContextResponse.data) : null) ??
    (propsResponse?.isOk ? extractContextSize(propsResponse.data) : null);
  const selectedModel = readString(request.model) ?? currentModel;
  const selectedModelCapabilities = mergeModelCapabilities(modelProviders.map((provider) => provider.capabilities));
  if (selectedModel && selectedModelCapabilities) {
    modelCapabilities[selectedModel] = selectedModelCapabilities;
  }
  const contextSize = endpointContextSize ?? (selectedModel ? (modelContextSizes[selectedModel] ?? null) : null);

  const detectedModels =
    currentModel && !models.some((model) => model.value === currentModel)
      ? [{ label: currentModel, value: currentModel }, ...models]
      : models;
  const providerName = serviceInfoResponse?.isOk ? extractProviderName(serviceInfoResponse.data) : null;
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
