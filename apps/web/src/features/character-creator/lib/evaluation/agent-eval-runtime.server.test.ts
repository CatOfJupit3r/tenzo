import { EventType } from '@tanstack/ai';
import type { StreamChunk } from '@tanstack/ai';
import { describe, expect, it, vi } from 'vitest';

import { AGENT_ORCHESTRATION_EVENT_NAMES } from '../orchestration/agent-orchestration-events';
import type { iOrchestratedCharacterAssistantOptions } from '../orchestration/orchestrated-character-assistant.server';
import { AGENT_EVAL_CORPUS } from './agent-eval-corpus';
import { AGENT_EVAL_PIPELINES, createAgentEvalRuntime } from './agent-eval-runtime.server';
import type { iAgentEvalExecutionProfile } from './agent-eval-runtime.server';

const PROFILE = {
  id: 'baseline-euryale',
  pipeline: AGENT_EVAL_PIPELINES['single-agent'],
  providerKind: 'openrouter',
  endpoint: 'https://openrouter.ai/api/v1',
  modelId: 'sao10k/l3.1-euryale-70b',
  allowedProviderSlug: 'deepinfra',
  localCapabilities: ['structured-output', 'tool-calling'],
  qualityProfile: 'balanced',
  maximumOutputTokens: 2_000,
  temperature: 0.8,
  topP: 1,
  promptPricePerMillionUsd: 0.85,
  completionPricePerMillionUsd: 1.45,
  seed: null,
} satisfies iAgentEvalExecutionProfile;

async function* createCompletedStream(actualCostUsd?: number): AsyncGenerator<StreamChunk> {
  yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'message-1', delta: 'Concise answer.' } as StreamChunk;
  yield {
    type: EventType.TOOL_CALL_END,
    toolCallId: 'tool-1',
    toolCallName: 'propose_character_fields',
    state: 'output-available',
  } as StreamChunk;
  if (actualCostUsd !== undefined) {
    yield {
      type: EventType.CUSTOM,
      name: AGENT_ORCHESTRATION_EVENT_NAMES.metrics,
      value: {
        runId: 'run-1',
        roleCallCount: 4,
        inputTokens: 1_000,
        outputTokens: 500,
        costUsd: actualCostUsd,
        latencyMs: 400,
      },
    } as StreamChunk;
  }
  yield {
    type: EventType.RUN_FINISHED,
    threadId: 'thread-1',
    runId: 'run-1',
    finishReason: 'stop',
    usage: { promptTokens: 1_000, completionTokens: 500, totalTokens: 1_500 },
  } as StreamChunk;
}

describe('agent eval runtime', () => {
  it('runs the frozen baseline through the single-agent stream and records content-safe metadata', async () => {
    const streamSingleAgentNative = vi.fn(() => createCompletedStream());
    const runtime = createAgentEvalRuntime({
      streamSingleAgentNative,
      streamSingleAgentStructured: vi.fn(),
      streamOrchestrated: vi.fn(),
      verifySingleAgentPolicy: vi.fn(),
    });

    const result = await runtime.runCase({ evalCase: AGENT_EVAL_CORPUS[0], profile: PROFILE, apiKey: 'secret-key' });

    expect(streamSingleAgentNative).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      profileId: PROFILE.id,
      assistantText: 'Concise answer.',
      usage: { inputTokens: 1_000, outputTokens: 500, costUsd: 0.001575 },
      toolOutcomes: [{ toolName: 'propose_character_fields', outcome: 'completed' }],
      isPolicyEligible: true,
      errorCategory: null,
    });
    expect(JSON.stringify(result)).not.toContain('secret-key');
  });

  it('dispatches candidate profiles through the orchestrated stream with replaceable role assignments', async () => {
    let orchestratedOptions: iOrchestratedCharacterAssistantOptions | undefined;
    const streamOrchestrated = vi.fn((options: iOrchestratedCharacterAssistantOptions) => {
      orchestratedOptions = options;
      return createCompletedStream(0.0042);
    });
    const runtime = createAgentEvalRuntime({
      streamSingleAgentNative: vi.fn(),
      streamSingleAgentStructured: vi.fn(),
      streamOrchestrated,
      verifySingleAgentPolicy: vi.fn(),
    });
    const profile = {
      ...PROFILE,
      pipeline: AGENT_EVAL_PIPELINES.orchestrated,
      id: 'specialized-candidate',
      roleAssignments: {},
    } satisfies iAgentEvalExecutionProfile;

    const result = await runtime.runCase({ evalCase: AGENT_EVAL_CORPUS[4], profile, apiKey: 'secret-key' });

    expect(streamOrchestrated).toHaveBeenCalledOnce();
    expect(orchestratedOptions).toMatchObject({
      roleAssignments: profile.roleAssignments,
      payload: { model: PROFILE.modelId, openRouterProvider: PROFILE.allowedProviderSlug },
    });
    expect(result.usage.costUsd).toBe(0.0042);
  });

  it('captures generation failures as artifacts so a tournament can continue', async () => {
    const runtime = createAgentEvalRuntime({
      streamSingleAgentNative: vi.fn(() => {
        throw new Error('provider unavailable');
      }),
      streamSingleAgentStructured: vi.fn(),
      streamOrchestrated: vi.fn(),
      verifySingleAgentPolicy: vi.fn(),
    });

    const result = await runtime.runCase({ evalCase: AGENT_EVAL_CORPUS[0], profile: PROFILE, apiKey: 'secret-key' });

    expect(result).toMatchObject({
      assistantText: '',
      proposedFields: {},
      isPolicyEligible: true,
      errorCategory: 'Error',
    });
  });
});
