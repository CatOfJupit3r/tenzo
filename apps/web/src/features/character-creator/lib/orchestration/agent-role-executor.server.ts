import { chat, EventType } from '@tanstack/ai';
import type { AnyTextAdapter, ModelMessage, TokenUsage, UIMessage } from '@tanstack/ai';
import type { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import { logAgentRoleCall } from '../evaluation/agent-run-observability';
import type { iAgentRoleCallEvent } from '../evaluation/agent-run-observability';
import type { iGenerateValidatedObject } from '../generation/structured-output.server';
import { generateValidatedObject } from '../generation/structured-output.server';
import { createAgentRoleModelOptions, createCharacterTextAdapter } from '../generation/tanstack-ai-text-generation';
import type { iCharacterChat } from '../generation/tanstack-ai-text-generation';
import { AGENT_ROLES } from '../provider/agent-role-contracts';
import type { AgentRole, iAgentRoleProfile } from '../provider/agent-role-contracts';
import type { ModelCapability } from '../provider/model-capabilities';
import { normalizeOpenAiCompatibleBaseUrl } from '../provider/openai-compatible-endpoint';
import { buildOpenRouterPolicyCatalog } from '../provider/openrouter-policy-catalog';
import { PROVIDER_KINDS } from '../provider/provider-health';
import { createProviderPolicyCatalogCache } from '../provider/provider-policy-catalog-cache';
import type { iProviderPolicyCatalogCache } from '../provider/provider-policy-catalog-cache';
import {
  PROVIDER_POLICY_FAILURE_REASONS,
  PROVIDER_POLICY_CATALOG_SCHEMA,
  resolveProviderPolicy,
} from '../provider/provider-policy-resolver';
import type {
  ProviderPolicyFailureReason,
  ProviderPolicyResolution,
  iProviderPolicyCatalog,
} from '../provider/provider-policy-resolver';
import { getAgentRolePrompt } from './agent-role-prompts';

export interface iAgentRolePolicyCatalogFetchOptions {
  endpoint: string;
  apiKey: string;
  modelId: string;
  now: Date;
}

export type iAgentRolePolicyCatalogFetcher = (
  options: iAgentRolePolicyCatalogFetchOptions,
) => Promise<iProviderPolicyCatalog | null>;

export interface iAgentRoleExecutorDependencies {
  cache?: iProviderPolicyCatalogCache;
  fetchPolicyCatalog?: iAgentRolePolicyCatalogFetcher;
  fetchJson?: (url: string, init?: RequestInit) => Promise<Response>;
  createAdapter?: (options: { endpoint: string; apiKey: string; model: string }) => AnyTextAdapter;
  generateValidatedObject?: iGenerateValidatedObject;
  chat?: iCharacterChat;
  now?: () => Date;
  generateUuid?: () => string;
  logAgentRoleCall?: (event: iAgentRoleCallEvent) => void;
}

export interface iAgentRoleCallOptions {
  profile: iAgentRoleProfile;
  endpoint: string;
  apiKey?: string;
  runId?: string;
  roleCallId?: string;
  prompt?: string;
  messages?: Array<ModelMessage | UIMessage>;
  systemPrompt?: string;
  localCapabilities?: readonly ModelCapability[];
  abortSignal?: AbortSignal;
}

export interface iStructuredAgentRoleCallOptions<T> extends iAgentRoleCallOptions {
  schema: z.ZodType<T>;
  schemaDescription?: string;
}

export interface iProseAgentRoleCallOptions extends iAgentRoleCallOptions {}

export interface iAgentRoleExecutionUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  retryCount: number;
}

export interface iAgentRoleExecutionResult<T> {
  value: T;
  runId: string;
  roleCallId: string;
  role: AgentRole;
  modelId: string;
  providerId: string;
  usage: iAgentRoleExecutionUsage;
}

export interface iAgentRoleExecutor {
  executeStructured: <T>(options: iStructuredAgentRoleCallOptions<T>) => Promise<iAgentRoleExecutionResult<T>>;
  executeProse: (options: iProseAgentRoleCallOptions) => Promise<iAgentRoleExecutionResult<string>>;
}

export type AgentRoleExecutionErrorCode =
  | 'invalid-request'
  | 'policy-ineligible'
  | 'policy-catalog-unavailable'
  | 'generation-failed'
  | 'budget-exceeded';

export class AgentRoleExecutionError extends Error {
  readonly code: AgentRoleExecutionErrorCode;

  readonly reasons: readonly ProviderPolicyFailureReason[];

  readonly role: AgentRole | null;

  readonly modelId: string | null;

  constructor(
    message: string,
    options: {
      code: AgentRoleExecutionErrorCode;
      reasons?: readonly ProviderPolicyFailureReason[];
      role?: AgentRole | null;
      modelId?: string | null;
      cause?: unknown;
    },
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = options.code === 'policy-ineligible' ? 'AgentRolePolicyError' : 'AgentRoleExecutionError';
    this.code = options.code;

    this.reasons = options.reasons ?? [];

    this.role = options.role ?? null;

    this.modelId = options.modelId ?? null;
  }
}

export type AgentRolePolicyError = AgentRoleExecutionError;
export const AgentRolePolicyError = AgentRoleExecutionError;

function toNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function readUsage(usage: TokenUsage | undefined) {
  const inputTokens = toNonNegativeInteger(usage?.promptTokens);
  const outputTokens = toNonNegativeInteger(usage?.completionTokens);
  const totalTokens = toNonNegativeInteger(usage?.totalTokens ?? inputTokens + outputTokens);
  return { inputTokens, outputTokens, totalTokens };
}

function buildGenerationSettings(profile: iAgentRoleProfile) {
  return {
    maxTokens: profile.budget.maximumOutputTokens,
    temperature: profile.temperature,
    topP: profile.topP,
    frequencyPenalty: 0,
    presencePenalty: 0,
    topK: 0,
    minP: 0,
  };
}

function buildMessages(prompt?: string, messages?: Array<ModelMessage | UIMessage>): Array<ModelMessage | UIMessage> {
  if (messages) return messages;
  if (prompt?.trim()) return [{ role: 'user', content: prompt }];
  throw new AgentRoleExecutionError('Agent role input requires a prompt or messages.', {
    code: 'invalid-request',
  });
}

function buildSystemPrompts(role: AgentRole, systemPrompt?: string): string[] {
  return [getAgentRolePrompt(role), ...(systemPrompt?.trim() ? [systemPrompt] : [])];
}

function getProviderId(profile: iAgentRoleProfile, resolution: ProviderPolicyResolution): string {
  if (resolution.isLocal) return PROVIDER_KINDS.koboldcpp;
  return resolution.routing?.only.join(',') ?? PROVIDER_KINDS.openrouter;
}

function getEndpointPricing(catalog: iProviderPolicyCatalog | null, profile: iAgentRoleProfile, providerId: string) {
  if (!catalog || providerId === PROVIDER_KINDS.koboldcpp) return { prompt: 0, completion: 0 };
  const model = catalog.models.find((candidate) => candidate.modelId === profile.modelId);
  const providerSlugs = new Set(providerId.split(',').filter(Boolean));
  const endpoints = model?.endpoints.filter((candidate) => providerSlugs.has(candidate.providerSlug)) ?? [];
  return {
    prompt: Math.max(0, ...endpoints.map((endpoint) => endpoint.promptPricePerMillionUsd)),
    completion: Math.max(0, ...endpoints.map((endpoint) => endpoint.completionPricePerMillionUsd)),
  };
}

function estimateCost(
  usage: { inputTokens: number; outputTokens: number },
  catalog: iProviderPolicyCatalog | null,
  profile: iAgentRoleProfile,
  providerId: string,
) {
  const pricing = getEndpointPricing(catalog, profile, providerId);
  return usage.inputTokens * (pricing.prompt / 1_000_000) + usage.outputTokens * (pricing.completion / 1_000_000);
}

function createBudgetError(
  profile: iAgentRoleProfile,
  usage: iAgentRoleExecutionUsage,
): AgentRoleExecutionError | null {
  const violations = [
    ...(usage.inputTokens > profile.budget.maximumInputTokens ? ['input token budget'] : []),
    ...(usage.outputTokens > profile.budget.maximumOutputTokens ? ['output token budget'] : []),
    ...(usage.costUsd > profile.budget.maximumCostUsd ? ['cost budget'] : []),
    ...(usage.latencyMs > profile.budget.maximumLatencyMs ? ['latency budget'] : []),
  ];
  if (violations.length === 0) return null;
  return new AgentRoleExecutionError(
    `Agent role "${profile.role}" exceeded its ${violations.join(', ')}. Reduce the role scope or choose a profile with a larger budget.`,
    { code: 'budget-exceeded', role: profile.role, modelId: profile.modelId },
  );
}

async function defaultFetchPolicyCatalog(
  options: iAgentRolePolicyCatalogFetchOptions,
  fetchJson: (url: string, init?: RequestInit) => Promise<Response>,
): Promise<iProviderPolicyCatalog | null> {
  const baseUrl = normalizeOpenAiCompatibleBaseUrl(options.endpoint);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.apiKey.trim()) headers.Authorization = `Bearer ${options.apiKey.trim()}`;
  const [modelsResponse, endpointsResponse] = await Promise.all([
    fetchJson(`${baseUrl}/models`, { headers }),
    fetchJson(`${baseUrl}/endpoints/zdr`, { headers }),
  ]);
  if (!modelsResponse.ok || !endpointsResponse.ok) return null;
  const [modelsPayload, endpointsPayload] = await Promise.all([modelsResponse.json(), endpointsResponse.json()]);
  return buildOpenRouterPolicyCatalog(modelsPayload, endpointsPayload, options.modelId, options.now);
}

function isCancellation(error: unknown, signal?: AbortSignal) {
  return signal?.aborted === true || (error instanceof Error && error.name === 'AbortError');
}

function toFailureReason(error: unknown): ProviderPolicyFailureReason | null {
  if (error instanceof AgentRoleExecutionError && error.reasons.length > 0) return error.reasons[0] ?? null;
  return null;
}

function createDefaultDependencies(): Required<
  Pick<
    iAgentRoleExecutorDependencies,
    'cache' | 'createAdapter' | 'generateValidatedObject' | 'chat' | 'now' | 'generateUuid' | 'logAgentRoleCall'
  >
> &
  Pick<iAgentRoleExecutorDependencies, 'fetchPolicyCatalog' | 'fetchJson'> {
  return {
    cache: createProviderPolicyCatalogCache(),
    createAdapter: createCharacterTextAdapter,
    generateValidatedObject,
    chat: (options) => chat(options),
    now: () => new Date(),
    generateUuid,
    logAgentRoleCall,
    fetchPolicyCatalog: undefined,
    fetchJson: async (url, init) => fetch(url, init),
  };
}

function createPolicyError(profile: iAgentRoleProfile, resolution: ProviderPolicyResolution): AgentRolePolicyError {
  const reasons = resolution.failures.map((failure) => failure.reason);
  const reasonText = reasons.length > 0 ? reasons.join(', ') : 'unknown policy failure';
  return new AgentRolePolicyError(
    `Agent role "${profile.role}" cannot run model "${profile.modelId}": ${reasonText}. Configure an eligible unmoderated ZDR endpoint with the required capabilities and price.`,
    { code: 'policy-ineligible', reasons, role: profile.role, modelId: profile.modelId },
  );
}

export function createAgentRoleExecutor(providedDependencies: iAgentRoleExecutorDependencies = {}): iAgentRoleExecutor {
  const defaults = createDefaultDependencies();
  const dependencies = {
    ...defaults,
    ...providedDependencies,
    cache: providedDependencies.cache ?? defaults.cache,
    createAdapter: providedDependencies.createAdapter ?? defaults.createAdapter,
    generateValidatedObject: providedDependencies.generateValidatedObject ?? defaults.generateValidatedObject,
    chat: providedDependencies.chat ?? defaults.chat,
    now: providedDependencies.now ?? defaults.now,
    generateUuid: providedDependencies.generateUuid ?? defaults.generateUuid,
    logAgentRoleCall: providedDependencies.logAgentRoleCall ?? defaults.logAgentRoleCall,
  };

  const resolveForCall = async (
    profile: iAgentRoleProfile,
    endpoint: string,
    apiKey: string,
    localCapabilities?: readonly ModelCapability[],
  ) => {
    const now = dependencies.now();
    let catalog: iProviderPolicyCatalog | null = null;
    const isLocal = profile.providerKind === PROVIDER_KINDS.koboldcpp;
    if (!isLocal) {
      const cacheKey = `${normalizeOpenAiCompatibleBaseUrl(endpoint)}::${profile.modelId}`;
      catalog = dependencies.cache.get(cacheKey, now);
      if (!catalog) {
        try {
          const fetchedCatalog = dependencies.fetchPolicyCatalog
            ? await dependencies.fetchPolicyCatalog({ endpoint, apiKey, modelId: profile.modelId, now })
            : await defaultFetchPolicyCatalog(
                { endpoint, apiKey, modelId: profile.modelId, now: dependencies.now() },
                dependencies.fetchJson ?? (async (url, init) => fetch(url, init)),
              );
          if (fetchedCatalog) {
            catalog = PROVIDER_POLICY_CATALOG_SCHEMA.parse(fetchedCatalog);
            dependencies.cache.set(cacheKey, catalog);
          }
        } catch (error) {
          throw new AgentRoleExecutionError(
            `Agent role policy metadata could not be refreshed for model "${profile.modelId}". Check the OpenRouter catalog and API key, then retry.`,
            {
              code: 'policy-catalog-unavailable',
              reasons: [PROVIDER_POLICY_FAILURE_REASONS['catalog-missing']],
              role: profile.role,
              modelId: profile.modelId,
              cause: error,
            },
          );
        }
      }
    }

    const resolution = resolveProviderPolicy({
      profile,
      catalog,
      localCapabilities,
      now: dependencies.now(),
    });
    return { catalog, resolution };
  };

  const executeStructured = async <T>(
    options: iStructuredAgentRoleCallOptions<T>,
  ): Promise<iAgentRoleExecutionResult<T>> => {
    const { profile, schema } = options;
    if (profile.role === AGENT_ROLES['prose-worker']) {
      throw new AgentRoleExecutionError('Prose workers must use raw prose execution.', {
        code: 'invalid-request',
        role: profile.role,
        modelId: profile.modelId,
      });
    }
    if (!schema) {
      throw new AgentRoleExecutionError('Structured agent roles require an explicit output schema.', {
        code: 'invalid-request',
        role: profile.role,
        modelId: profile.modelId,
      });
    }
    const runId = options.runId ?? dependencies.generateUuid();
    const roleCallId = options.roleCallId ?? dependencies.generateUuid();
    const startedAt = performance.now();
    let catalog: iProviderPolicyCatalog | null = null;
    let providerId: string = profile.providerKind;
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let resolution: ProviderPolicyResolution | null = null;
    try {
      const resolved = await resolveForCall(profile, options.endpoint, options.apiKey ?? '', options.localCapabilities);
      catalog = resolved.catalog;
      resolution = resolved.resolution;
      providerId = getProviderId(profile, resolution);
      if (!resolution.isEligible) throw createPolicyError(profile, resolution);
      const adapter = (dependencies.createAdapter ?? createCharacterTextAdapter)({
        endpoint: options.endpoint,
        apiKey: options.apiKey ?? '',
        model: profile.modelId,
      });
      const generatedValue = await (dependencies.generateValidatedObject ?? generateValidatedObject)({
        adapter,
        schema,
        schemaDescription: options.schemaDescription ?? `Structured output for ${profile.role}.`,
        system: buildSystemPrompts(profile.role, options.systemPrompt).join('\n\n'),
        prompt: options.prompt,
        messages: options.messages,
        modelOptions: createAgentRoleModelOptions(options.endpoint, buildGenerationSettings(profile), resolution),
        abortSignal: options.abortSignal,
        onUsage: (nextUsage) => {
          usage = readUsage(nextUsage);
        },
      });
      const value = schema.parse(generatedValue);
      const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
      const executionUsage = {
        ...usage,
        costUsd: estimateCost(usage, catalog, profile, providerId),
        latencyMs,
        retryCount: 0,
      };
      const budgetError = createBudgetError(profile, executionUsage);
      if (budgetError) throw budgetError;
      dependencies.logAgentRoleCall({
        runId,
        roleCallId,
        role: profile.role,
        modelId: profile.modelId,
        providerId,
        outcome: 'completed',
        retryCount: 0,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: executionUsage.costUsd,
        latencyMs,
        qualityFindingCount: 0,
        repairCount: 0,
        policyFailureReason: null,
      });
      return {
        value,
        runId,
        roleCallId,
        role: profile.role,
        modelId: profile.modelId,
        providerId,
        usage: executionUsage,
      };
    } catch (error) {
      const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
      const policyFailureReason = toFailureReason(error);
      dependencies.logAgentRoleCall({
        runId,
        roleCallId,
        role: profile.role,
        modelId: profile.modelId,
        providerId,
        outcome: isCancellation(error, options.abortSignal) ? 'cancelled' : 'failed',
        retryCount: 0,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: estimateCost(usage, catalog, profile, providerId),
        latencyMs,
        qualityFindingCount: 0,
        repairCount: 0,
        policyFailureReason,
      });
      if (error instanceof AgentRoleExecutionError) throw error;
      throw new AgentRoleExecutionError(`Agent role "${profile.role}" generation failed.`, {
        code: 'generation-failed',
        role: profile.role,
        modelId: profile.modelId,
        cause: error,
      });
    }
  };

  const executeProse = async (options: iProseAgentRoleCallOptions): Promise<iAgentRoleExecutionResult<string>> => {
    const { profile } = options;
    if (profile.role !== AGENT_ROLES['prose-worker']) {
      throw new AgentRoleExecutionError('Only prose-worker profiles may use raw prose execution.', {
        code: 'invalid-request',
        role: profile.role,
        modelId: profile.modelId,
      });
    }
    const runId = options.runId ?? dependencies.generateUuid();
    const roleCallId = options.roleCallId ?? dependencies.generateUuid();
    const startedAt = performance.now();
    let catalog: iProviderPolicyCatalog | null = null;
    let providerId: string = profile.providerKind;
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    try {
      const resolved = await resolveForCall(profile, options.endpoint, options.apiKey ?? '', options.localCapabilities);
      catalog = resolved.catalog;
      providerId = getProviderId(profile, resolved.resolution);
      if (!resolved.resolution.isEligible) throw createPolicyError(profile, resolved.resolution);
      const adapter = (dependencies.createAdapter ?? createCharacterTextAdapter)({
        endpoint: options.endpoint,
        apiKey: options.apiKey ?? '',
        model: profile.modelId,
      });
      const abortController = new AbortController();
      const abort = () => abortController.abort(options.abortSignal?.reason);
      if (options.abortSignal?.aborted) abort();
      else options.abortSignal?.addEventListener('abort', abort, { once: true });
      const stream = (dependencies.chat ?? ((chatOptions) => chat(chatOptions)))({
        adapter,
        messages: buildMessages(options.prompt, options.messages),
        systemPrompts: buildSystemPrompts(profile.role, options.systemPrompt),
        modelOptions: createAgentRoleModelOptions(
          options.endpoint,
          buildGenerationSettings(profile),
          resolved.resolution,
        ),
        abortController,
        stream: true,
      });
      let value = '';
      try {
        for await (const chunk of stream) {
          if (chunk.type === EventType.TEXT_MESSAGE_CONTENT && chunk.delta) value += chunk.delta;
          if (chunk.type === EventType.RUN_FINISHED && chunk.usage) usage = readUsage(chunk.usage);
          if (chunk.type === EventType.RUN_ERROR) throw new Error(chunk.message);
        }
      } finally {
        options.abortSignal?.removeEventListener('abort', abort);
      }
      const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
      const executionUsage = {
        ...usage,
        costUsd: estimateCost(usage, catalog, profile, providerId),
        latencyMs,
        retryCount: 0,
      };
      if (!value.trim()) {
        throw new AgentRoleExecutionError(`Agent role "${profile.role}" returned empty prose.`, {
          code: 'generation-failed',
          role: profile.role,
          modelId: profile.modelId,
        });
      }
      const budgetError = createBudgetError(profile, executionUsage);
      if (budgetError) throw budgetError;
      dependencies.logAgentRoleCall({
        runId,
        roleCallId,
        role: profile.role,
        modelId: profile.modelId,
        providerId,
        outcome: 'completed',
        retryCount: 0,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: executionUsage.costUsd,
        latencyMs,
        qualityFindingCount: 0,
        repairCount: 0,
        policyFailureReason: null,
      });
      return {
        value,
        runId,
        roleCallId,
        role: profile.role,
        modelId: profile.modelId,
        providerId,
        usage: executionUsage,
      };
    } catch (error) {
      const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
      const policyFailureReason = toFailureReason(error);
      dependencies.logAgentRoleCall({
        runId,
        roleCallId,
        role: profile.role,
        modelId: profile.modelId,
        providerId,
        outcome: isCancellation(error, options.abortSignal) ? 'cancelled' : 'failed',
        retryCount: 0,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: estimateCost(usage, catalog, profile, providerId),
        latencyMs,
        qualityFindingCount: 0,
        repairCount: 0,
        policyFailureReason,
      });
      if (error instanceof AgentRoleExecutionError) throw error;
      throw new AgentRoleExecutionError(`Agent role "${profile.role}" generation failed.`, {
        code: 'generation-failed',
        role: profile.role,
        modelId: profile.modelId,
        cause: error,
      });
    }
  };

  return {
    executeStructured,
    executeProse,
  };
}
