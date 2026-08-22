import { EventType } from '@tanstack/ai';
import type { AnyTextAdapter, StreamChunk, TokenUsage } from '@tanstack/ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { iAgentRoleCallEvent } from '../evaluation/agent-run-observability';
import type { iGenerateValidatedObject, iGenerateValidatedObjectOptions } from '../generation/structured-output.server';
import type { iCharacterChatOptions } from '../generation/tanstack-ai-text-generation';
import { AGENT_ROLES } from '../provider/agent-role-contracts';
import type { iAgentRoleProfile } from '../provider/agent-role-contracts';
import { MODEL_CAPABILITIES } from '../provider/model-capabilities';
import { PROVIDER_KINDS } from '../provider/provider-health';
import { createProviderPolicyCatalogCache } from '../provider/provider-policy-catalog-cache';
import type { iProviderPolicyCatalog } from '../provider/provider-policy-resolver';
import { AgentRolePolicyError, createAgentRoleExecutor } from './agent-role-executor.server';
import type { iAgentRoleCallOptions, iAgentRoleExecutorDependencies } from './agent-role-executor.server';

const NOW = new Date('2026-08-21T00:00:00.000Z');
const ENDPOINT = 'https://openrouter.ai/api';
const EMPTY_ADAPTER = {} as AnyTextAdapter;

function createProfile(overrides: Partial<iAgentRoleProfile> = {}): iAgentRoleProfile {
  return {
    id: 'role-test',
    role: AGENT_ROLES.critic,
    providerKind: PROVIDER_KINDS.openrouter,
    modelId: 'test/unmoderated',
    allowedProviderSlugs: ['eligible-provider'],
    requiredCapabilities: [MODEL_CAPABILITIES['structured-output']],
    temperature: 0.4,
    topP: 0.9,
    budget: {
      maximumCalls: 2,
      maximumInputTokens: 2_000,
      maximumOutputTokens: 400,
      maximumCostUsd: 1,
      maximumLatencyMs: 10_000,
    },
    maximumPromptPricePerMillionUsd: 2,
    maximumCompletionPricePerMillionUsd: 4,
    ...overrides,
  };
}

function createCatalog(
  overrides: Partial<iProviderPolicyCatalog['models'][number]['endpoints'][number]> = {},
  fetchedAt = NOW.toISOString(),
): iProviderPolicyCatalog {
  return {
    fetchedAt,
    models: [
      {
        modelId: 'test/unmoderated',
        isModerated: false,
        endpoints: [
          {
            providerSlug: 'eligible-provider',
            isZeroDataRetention: true,
            doesCollectData: false,
            isAvailable: true,
            supportedCapabilities: [MODEL_CAPABILITIES['structured-output']],
            promptPricePerMillionUsd: 1,
            completionPricePerMillionUsd: 2,
            ...overrides,
          },
        ],
      },
    ],
  };
}

function createDependencies(catalog: iProviderPolicyCatalog, overrides: Partial<iAgentRoleExecutorDependencies> = {}) {
  const logs: iAgentRoleCallEvent[] = [];
  const generationCalls: Array<Record<string, unknown>> = [];
  const fetchCalls: iAgentRoleCallOptions[] = [];
  const dependencies: iAgentRoleExecutorDependencies = {
    cache: createProviderPolicyCatalogCache(),
    now: () => NOW,
    generateUuid: (() => {
      let count = 0;
      return () => {
        count += 1;
        return `id-${count}`;
      };
    })(),
    fetchPolicyCatalog: async (options) => {
      fetchCalls.push({ profile: createProfile(), endpoint: options.endpoint, apiKey: options.apiKey });
      return catalog;
    },
    createAdapter: () => EMPTY_ADAPTER,
    generateValidatedObject: (async <T>(options: iGenerateValidatedObjectOptions<T>) => {
      generationCalls.push({ modelOptions: options.modelOptions });
      return { accepted: true } as T;
    }) as iGenerateValidatedObject,
    logAgentRoleCall: (event) => logs.push(event),
    ...overrides,
  };
  return { dependencies, logs, generationCalls, fetchCalls };
}

function callOptions(
  profile: iAgentRoleProfile,
  overrides: Partial<iAgentRoleCallOptions> = {},
): iAgentRoleCallOptions {
  return {
    profile,
    endpoint: ENDPOINT,
    apiKey: 'test-key',
    prompt: 'bounded role input',
    ...overrides,
  };
}

describe('agent role executor', () => {
  it('revalidates an eligible remote catalog and applies immutable routing', async () => {
    const harness = createDependencies(createCatalog());
    const executor = createAgentRoleExecutor(harness.dependencies);
    const result = await executor.executeStructured({
      ...callOptions(createProfile()),
      schema: z.object({ accepted: z.boolean() }),
      runId: 'run-1',
      roleCallId: 'call-1',
    });

    expect(result.value).toEqual({ accepted: true });
    expect(harness.fetchCalls).toHaveLength(1);
    expect(harness.generationCalls[0]?.modelOptions).toEqual({
      maxTokens: 400,
      temperature: 0.4,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      provider: {
        only: ['eligible-provider'],
        allowFallbacks: false,
        dataCollection: 'deny',
        zdr: true,
        requireParameters: true,
      },
    });
    expect(harness.logs[0]).toMatchObject({ outcome: 'completed', providerId: 'eligible-provider' });
    expect(JSON.stringify(harness.logs)).not.toContain('bounded role input');
  });

  it('fails closed for an ineligible remote endpoint before generation', async () => {
    const harness = createDependencies(createCatalog({ doesCollectData: true }));
    const executor = createAgentRoleExecutor(harness.dependencies);

    await expect(
      executor.executeStructured({
        ...callOptions(createProfile()),
        schema: z.object({ accepted: z.boolean() }),
      }),
    ).rejects.toBeInstanceOf(AgentRolePolicyError);
    expect(harness.generationCalls).toHaveLength(0);
    expect(harness.logs[0]).toMatchObject({ outcome: 'failed', policyFailureReason: 'endpoint-data-collecting' });
  });

  it('requires an explicit schema for structured calls', async () => {
    const harness = createDependencies(createCatalog());
    const executor = createAgentRoleExecutor(harness.dependencies);

    await expect(
      executor.executeStructured({
        ...callOptions(createProfile()),
        schema: undefined as never,
      }),
    ).rejects.toMatchObject({ code: 'invalid-request' });
    expect(harness.generationCalls).toHaveLength(0);
  });

  it('uses fresh cache metadata and refreshes after the TTL', async () => {
    let now = NOW;
    let fetchCount = 0;
    const cache = createProviderPolicyCatalogCache();
    const harness = createDependencies(createCatalog(), {
      cache,
      now: () => now,
      fetchPolicyCatalog: async () => {
        fetchCount += 1;
        return createCatalog({}, now.toISOString());
      },
    });
    const executor = createAgentRoleExecutor(harness.dependencies);
    const options = {
      ...callOptions(createProfile()),
      schema: z.object({ accepted: z.boolean() }),
    };

    await executor.executeStructured(options);
    await executor.executeStructured(options);
    expect(fetchCount).toBe(1);

    now = new Date(NOW.getTime() + 5 * 60_000 + 1);
    await executor.executeStructured(options);
    expect(fetchCount).toBe(2);
  });

  it('allows local profiles only when their declared capabilities are present', async () => {
    const harness = createDependencies(createCatalog());
    const executor = createAgentRoleExecutor(harness.dependencies);
    const profile = createProfile({
      providerKind: PROVIDER_KINDS.koboldcpp,
      modelId: 'koboldcpp/local',
      allowedProviderSlugs: [],
      requiredCapabilities: [MODEL_CAPABILITIES['structured-output']],
    });

    await executor.executeStructured({
      ...callOptions(profile, { endpoint: 'http://localhost:5001', apiKey: '' }),
      schema: z.object({ accepted: z.boolean() }),
      localCapabilities: [MODEL_CAPABILITIES['structured-output']],
    });
    expect(harness.fetchCalls).toHaveLength(0);

    await expect(
      executor.executeStructured({
        ...callOptions(profile, { endpoint: 'http://localhost:5001', apiKey: '' }),
        schema: z.object({ accepted: z.boolean() }),
        localCapabilities: [],
      }),
    ).rejects.toBeInstanceOf(AgentRolePolicyError);
  });

  it('parses structured output with the caller schema', async () => {
    const harness = createDependencies(createCatalog(), {
      generateValidatedObject: (async <T>(_options: iGenerateValidatedObjectOptions<T>) =>
        ({ accepted: 'not-a-boolean' }) as T) as iGenerateValidatedObject,
    });
    const executor = createAgentRoleExecutor(harness.dependencies);

    await expect(
      executor.executeStructured({
        ...callOptions(createProfile()),
        schema: z.object({ accepted: z.boolean() }),
      }),
    ).rejects.toThrow();
  });

  it('retries transient provider failures and records the retry count', async () => {
    let attempt = 0;
    const generate = vi.fn(async (options: iGenerateValidatedObjectOptions<{ accepted: boolean }>) => {
      attempt += 1;
      options.onUsage?.({
        promptTokens: attempt === 1 ? 3 : 4,
        completionTokens: attempt === 1 ? 2 : 3,
        totalTokens: attempt === 1 ? 5 : 7,
      } as TokenUsage);
      if (attempt === 1) {
        throw Object.assign(new Error('Rate limited with 429.'), { retryAfter: 0, status: 429 });
      }
      return { accepted: true };
    });
    const harness = createDependencies(createCatalog(), {
      generateValidatedObject: generate as iGenerateValidatedObject,
    });
    const executor = createAgentRoleExecutor(harness.dependencies);

    const result = await executor.executeStructured({
      ...callOptions(createProfile()),
      schema: z.object({ accepted: z.boolean() }),
    });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.usage.retryCount).toBe(1);
    expect(result.usage).toMatchObject({ inputTokens: 7, outputTokens: 5, totalTokens: 12 });
    expect(harness.logs[0]).toMatchObject({ outcome: 'completed', retryCount: 1 });
  });

  it('records content-free critic finding counts', async () => {
    const harness = createDependencies(createCatalog(), {
      generateValidatedObject: (async <T>(_options: iGenerateValidatedObjectOptions<T>) =>
        [{ finding: 'one' }, { finding: 'two' }] as T) as iGenerateValidatedObject,
    });
    const executor = createAgentRoleExecutor(harness.dependencies);

    await executor.executeStructured({
      ...callOptions(createProfile()),
      schema: z.array(z.object({ finding: z.string() })),
    });

    expect(harness.logs[0]).toMatchObject({ role: AGENT_ROLES.critic, qualityFindingCount: 2 });
    expect(JSON.stringify(harness.logs)).not.toContain('finding');
  });

  it('estimates multi-provider routing cost conservatively', async () => {
    const baseCatalog = createCatalog();
    const catalog: iProviderPolicyCatalog = {
      ...baseCatalog,
      models: [
        {
          ...baseCatalog.models[0],
          endpoints: [
            ...baseCatalog.models[0].endpoints,
            {
              providerSlug: 'expensive-provider',
              isZeroDataRetention: true,
              doesCollectData: false,
              isAvailable: true,
              supportedCapabilities: [MODEL_CAPABILITIES['structured-output']],
              promptPricePerMillionUsd: 3,
              completionPricePerMillionUsd: 4,
            },
          ],
        },
      ],
    };
    const harness = createDependencies(catalog, {
      generateValidatedObject: (async <T>(options: iGenerateValidatedObjectOptions<T>) => {
        options.onUsage?.({
          promptTokens: 1_000_000,
          completionTokens: 1_000_000,
          totalTokens: 2_000_000,
        } as TokenUsage);
        return { accepted: true } as T;
      }) as iGenerateValidatedObject,
    });
    const executor = createAgentRoleExecutor(harness.dependencies);
    const result = await executor.executeStructured({
      ...callOptions(
        createProfile({
          allowedProviderSlugs: [],
          maximumPromptPricePerMillionUsd: 5,
          maximumCompletionPricePerMillionUsd: 5,
          budget: {
            ...createProfile().budget,
            maximumInputTokens: 2_000_000,
            maximumOutputTokens: 2_000_000,
            maximumCostUsd: 10,
          },
        }),
      ),
      schema: z.object({ accepted: z.boolean() }),
    });

    expect(result.usage.costUsd).toBe(7);
    expect(result.providerId).toBe('eligible-provider,expensive-provider');
  });

  it('rejects empty prose as a generation failure', async () => {
    const harness = createDependencies(createCatalog(), {
      chat: () =>
        (async function* emptyStream(): AsyncGenerator<StreamChunk> {
          yield { type: EventType.RUN_FINISHED } as StreamChunk;
        })(),
    });
    const executor = createAgentRoleExecutor(harness.dependencies);

    await expect(
      executor.executeProse({
        ...callOptions(createProfile({ role: AGENT_ROLES['prose-worker'], requiredCapabilities: [] })),
      }),
    ).rejects.toMatchObject({ code: 'generation-failed' });
    expect(harness.logs[0]).toMatchObject({ outcome: 'failed' });
  });

  it('rejects results that exceed the role budget and logs failure', async () => {
    const harness = createDependencies(createCatalog(), {
      generateValidatedObject: (async <T>(options: iGenerateValidatedObjectOptions<T>) => {
        options.onUsage?.({ promptTokens: 2_001, completionTokens: 1, totalTokens: 2_002 } as TokenUsage);
        return { accepted: true } as T;
      }) as iGenerateValidatedObject,
    });
    const executor = createAgentRoleExecutor(harness.dependencies);

    await expect(
      executor.executeStructured({
        ...callOptions(createProfile()),
        schema: z.object({ accepted: z.boolean() }),
      }),
    ).rejects.toMatchObject({ code: 'budget-exceeded' });
    expect(harness.logs[0]).toMatchObject({ outcome: 'failed', policyFailureReason: null });
  });

  it('collects raw prose without tools or structured output', async () => {
    let chatOptions: iCharacterChatOptions | undefined;
    const stream = (async function* streamChunks(): AsyncGenerator<StreamChunk> {
      yield { type: EventType.TEXT_MESSAGE_CONTENT, delta: 'raw prose' } as StreamChunk;
      yield {
        type: EventType.RUN_FINISHED,
        usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
      } as StreamChunk;
    })();
    const harness = createDependencies(createCatalog(), {
      chat: (options) => {
        chatOptions = options;
        return stream;
      },
    });
    const executor = createAgentRoleExecutor(harness.dependencies);

    const result = await executor.executeProse({
      ...callOptions(createProfile({ role: AGENT_ROLES['prose-worker'], requiredCapabilities: [] })),
      isRepair: true,
    });

    expect(result.value).toBe('raw prose');
    expect(chatOptions?.tools).toBeUndefined();
    expect(chatOptions && 'outputSchema' in chatOptions).toBe(false);
    expect(harness.logs[0]).toMatchObject({
      inputTokens: 3,
      outputTokens: 2,
      outcome: 'completed',
      repairCount: 1,
    });
  });
});
