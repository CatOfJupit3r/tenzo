import { z } from 'zod';

import { REQUEST_MODES } from './generation-config';
import type { RequestMode } from './generation-config';
import { normalizeOpenAiCompatibleBaseUrl } from './openai-compatible-endpoint';

export const PROVIDER_KIND_SCHEMA = z.enum(['koboldcpp', 'openai-compatible', 'unknown']);
export const PROVIDER_KINDS = PROVIDER_KIND_SCHEMA.enum;
export type ProviderKind = z.infer<typeof PROVIDER_KIND_SCHEMA>;

export interface iConnectionHealthRequest {
  endpoint: string;
  apiKey: string;
  requestMode: RequestMode;
}

export interface iConnectionHealthResult {
  providerName: string | null;
  providerKind: ProviderKind;
  models: string[];
  currentModel: string | null;
  contextSize: number | null;
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
}

const PROVIDER_KIND_LABELS = {
  [PROVIDER_KINDS.koboldcpp]: 'KoboldCpp',
  [PROVIDER_KINDS['openai-compatible']]: 'OpenAI-compatible',
  [PROVIDER_KINDS.unknown]: 'Unknown provider',
} satisfies Record<ProviderKind, string>;

function buildEndpointCandidates(endpoint: string): iEndpointCandidates {
  const baseUrl = normalizeOpenAiCompatibleBaseUrl(endpoint);

  return {
    baseUrl,
    modelsUrl: `${baseUrl}/v1/models`,
    koboldModelUrl: `${baseUrl}/api/v1/model`,
    koboldContextUrl: `${baseUrl}/api/extra/true_max_context_length`,
    koboldPublicContextUrl: `${baseUrl}/api/v1/config/max_context_length`,
    propsUrl: `${baseUrl}/props`,
    serviceInfoUrl: `${baseUrl}/.well-known/serviceinfo`,
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

function extractModels(payload: unknown): string[] {
  const discoveredModels = new Set<string>();

  const pushModel = (value: unknown) => {
    const normalized = readString(value);
    if (normalized) {
      discoveredModels.add(normalized);
    }
  };

  if (Array.isArray(payload)) {
    payload.forEach((entry) => {
      if (entry && typeof entry === 'object') {
        pushModel(Reflect.get(entry, 'id'));
        pushModel(Reflect.get(entry, 'name'));
        pushModel(Reflect.get(entry, 'model_name'));
      } else {
        pushModel(entry);
      }
    });
  }

  if (payload && typeof payload === 'object') {
    const data = Reflect.get(payload, 'data');
    if (Array.isArray(data)) {
      data.forEach((entry) => {
        if (entry && typeof entry === 'object') {
          pushModel(Reflect.get(entry, 'id'));
          pushModel(Reflect.get(entry, 'name'));
          pushModel(Reflect.get(entry, 'model_name'));
        } else {
          pushModel(entry);
        }
      });
    }

    const models = Reflect.get(payload, 'models');
    if (Array.isArray(models)) {
      models.forEach(pushModel);
    }
  }

  return [...discoveredModels];
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
  const candidates = buildEndpointCandidates(request.endpoint);
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
  ] = await Promise.all([
    jsonFetcher(candidates.modelsUrl, requestInit).catch(() => null),
    jsonFetcher(candidates.koboldModelUrl, requestInit).catch(() => null),
    jsonFetcher(candidates.koboldContextUrl, requestInit).catch(() => null),
    jsonFetcher(candidates.koboldPublicContextUrl, requestInit).catch(() => null),
    jsonFetcher(candidates.propsUrl, requestInit).catch(() => null),
    jsonFetcher(candidates.serviceInfoUrl, requestInit).catch(() => null),
  ]);

  const models = modelsResponse?.isOk ? extractModels(modelsResponse.data) : [];
  const currentModel =
    (koboldModelResponse?.isOk ? extractCurrentModel(koboldModelResponse.data) : null) ?? models[0] ?? null;
  const contextSize =
    (koboldContextResponse?.isOk ? extractContextSize(koboldContextResponse.data) : null) ??
    (koboldPublicContextResponse?.isOk ? extractContextSize(koboldPublicContextResponse.data) : null) ??
    (propsResponse?.isOk ? extractContextSize(propsResponse.data) : null);

  const detectedModels = currentModel && !models.includes(currentModel) ? [currentModel, ...models] : models;
  const providerName = serviceInfoResponse?.isOk ? extractProviderName(serviceInfoResponse.data) : null;
  const hasKoboldMetadata =
    koboldModelResponse?.isOk === true ||
    koboldContextResponse?.isOk === true ||
    koboldPublicContextResponse?.isOk === true;
  const isKoboldCpp = (providerName?.toLowerCase().includes('koboldcpp') ?? false) || hasKoboldMetadata;
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
    } else if (hasOpenAiSurface) {
      resolvedProviderName = PROVIDER_KIND_LABELS[PROVIDER_KINDS['openai-compatible']];
    }
  }

  let providerKind: ProviderKind = PROVIDER_KINDS.unknown;

  if (isKoboldCpp) {
    providerKind = PROVIDER_KINDS.koboldcpp;
  } else if (hasOpenAiSurface) {
    providerKind = PROVIDER_KINDS['openai-compatible'];
  }

  return {
    providerName: resolvedProviderName,
    providerKind,
    models: detectedModels,
    currentModel,
    contextSize,
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
