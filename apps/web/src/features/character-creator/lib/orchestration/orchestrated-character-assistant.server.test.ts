import { EventType } from '@tanstack/ai';
import type { ModelMessage, StreamChunk, UIMessage } from '@tanstack/ai';
import { describe, expect, it, vi } from 'vitest';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import {
  CHARACTER_ASSISTANT_FOCUS_KINDS,
  CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA,
} from '../assistant/character-assistant-contracts';
import { DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING, GENERATION_PROVIDERS } from '../generation/generation-config';
import { createCharacterEditProposal } from '../proposals/character-edit-proposal';
import { AGENT_ROLES } from '../provider/agent-role-contracts';
import { PROVIDER_KINDS } from '../provider/provider-health';
import { AGENT_ROUTES } from './agent-orchestration-contracts';
import {
  AGENT_ORCHESTRATION_EVENT_NAMES,
  AGENT_ORCHESTRATION_METRICS_EVENT_SCHEMA,
  AGENT_ORCHESTRATION_PROPOSAL_EVENT_SCHEMA,
} from './agent-orchestration-events';
import type { iAgentRoleExecutionUsage, iAgentRoleExecutor } from './agent-role-executor.server';
import { createOrchestratedCharacterAssistantService } from './orchestrated-character-assistant.server';

const PROSE = [
  'Mira is a meticulous railway cartographer whose charcoal coat always carries a trace of brass dust.',
  'She maps abandoned night lines by hand and keeps each corrected route folded inside a weathered field journal.',
  'A cracked compass hangs at her throat, more memorial than instrument, while ink stains mark both gloves.',
  'Her quiet precision hides a practical courage that appears whenever stranded travelers need a safe path home.',
].join(' ');

function createPayload(message: string) {
  const card = createEmptyCharacterCard();
  return CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA.parse({
    provider: GENERATION_PROVIDERS.koboldcpp,
    providerKind: PROVIDER_KINDS.koboldcpp,
    endpoint: 'http://localhost:5001',
    apiKey: 'local-key',
    model: 'koboldcpp/local',
    maxTokens: 1_000,
    temperature: 0.8,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    topK: 0,
    minP: 0,
    characterId: 'character-1',
    card,
    focus: { kind: CHARACTER_ASSISTANT_FOCUS_KINDS.field, fieldKey: 'description' },
    messages: [{ role: 'user', content: message }],
    fieldShouldAllowAssistantEditing: DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING,
    localCapabilities: ['structured-output', 'tool-calling'],
  });
}

function createExecution<T>(
  value: T,
  role: keyof typeof AGENT_ROLES,
  usageOverrides: Partial<iAgentRoleExecutionUsage> = {},
) {
  return {
    value,
    runId: 'run-1',
    roleCallId: `call-${role}`,
    role: AGENT_ROLES[role],
    modelId: 'koboldcpp/local',
    providerId: PROVIDER_KINDS.koboldcpp,
    usage: {
      inputTokens: 10,
      outputTokens: 10,
      totalTokens: 20,
      costUsd: 0,
      latencyMs: 10,
      retryCount: 0,
      ...usageOverrides,
    },
  };
}

async function collect(stream: AsyncIterable<StreamChunk>) {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

describe('orchestrated character assistant stream', () => {
  it('answers advice with exactly one role call and no proposal', async () => {
    const executeStructured = vi
      .fn()
      .mockResolvedValue(
        createExecution(
          { route: AGENT_ROUTES.advice, answer: 'Use an opening action that leaves {{user}} room to respond.' },
          'intent-router',
        ),
      );
    const executor = { executeStructured, executeProse: vi.fn() } as iAgentRoleExecutor;
    const store = {
      getCard: () => createEmptyCharacterCard(),
      appendProposedCard: vi.fn(() => {
        throw new Error('Advice must not create a proposal.');
      }),
    };
    const payload = createPayload('How can I make the greeting inviting without controlling the user?');
    const chunks = await collect(
      createOrchestratedCharacterAssistantService({ executor, generateUuid: () => 'run-1' }).stream({
        payload,
        messages: payload.messages as Array<ModelMessage | UIMessage>,
        store,
      }),
    );

    expect(executeStructured).toHaveBeenCalledTimes(1);
    expect(executor.executeProse).not.toHaveBeenCalled();
    expect(store.appendProposedCard).not.toHaveBeenCalled();
    expect(chunks.some((chunk) => chunk.type === EventType.RUN_FINISHED)).toBe(true);
    const metricsChunk = chunks.find(
      (chunk) => chunk.type === EventType.CUSTOM && chunk.name === AGENT_ORCHESTRATION_EVENT_NAMES.metrics,
    );
    if (metricsChunk?.type !== EventType.CUSTOM) throw new Error('Metrics event was not emitted.');
    expect(AGENT_ORCHESTRATION_METRICS_EVENT_SCHEMA.parse(metricsChunk.value)).toEqual({
      runId: 'run-1',
      roleCallCount: 1,
      inputTokens: 10,
      outputTokens: 10,
      costUsd: 0,
      latencyMs: 10,
    });
  });

  it('submits a focused draft through the existing proposal store only after review', async () => {
    const payload = createPayload(
      'Create a complete description for Mira, a meticulous railway cartographer who maps abandoned night lines, carries a cracked compass, and quietly helps stranded travelers find safe routes home.',
    );
    const roles: string[] = [];
    const executeStructured: iAgentRoleExecutor['executeStructured'] = async (options) => {
      roles.push(options.profile.role);
      if (options.profile.role === AGENT_ROLES['intent-router']) {
        return createExecution({ route: AGENT_ROUTES['focused-edit'], answer: null }, 'intent-router', {
          costUsd: 0.01,
        }) as never;
      }
      if (options.profile.role === AGENT_ROLES.orchestrator) {
        return createExecution(
          {
            entries: [
              {
                fieldKey: 'description',
                purpose: 'Establish identity and durable facts.',
                ownedFactIds: ['user-prompt'],
                allowedEchoFactIds: [],
                forbiddenRestatements: [],
                relevantContext: [],
                requiredMacros: [],
                strictTemplate: null,
                depth: { minimumInformationUnits: 4, maximumOutputTokens: 1_000 },
                dependsOnFieldKeys: [],
              },
            ],
            coupledFieldGroups: [],
            styleBible: ['Specific, grounded prose.'],
          },
          'orchestrator',
          { costUsd: 0.02 },
        ) as never;
      }
      return createExecution([], 'critic', { costUsd: 0.04 }) as never;
    };
    const executor = {
      executeStructured,
      executeProse: vi.fn(async () => createExecution(PROSE, 'prose-worker', { costUsd: 0.03 })),
    } satisfies iAgentRoleExecutor;
    let projectedCard = structuredClone(payload.card);
    const appendProposedCard = vi.fn(({ proposedCard, toolCallId, summary }) => {
      const proposal = createCharacterEditProposal({
        characterId: payload.characterId,
        baseCard: projectedCard,
        proposedCard,
        toolCallId,
        summary,
      });
      projectedCard = structuredClone(proposedCard);
      return proposal;
    });
    const chunks = await collect(
      createOrchestratedCharacterAssistantService({ executor, generateUuid: () => 'run-1' }).stream({
        payload,
        messages: payload.messages as Array<ModelMessage | UIMessage>,
        store: { getCard: () => projectedCard, appendProposedCard },
      }),
    );

    expect(roles).toEqual([AGENT_ROLES['intent-router'], AGENT_ROLES.orchestrator, AGENT_ROLES.critic]);
    expect(appendProposedCard).toHaveBeenCalledTimes(1);
    expect(projectedCard.data.description).toBe(PROSE);
    expect(chunks.some((chunk) => chunk.type === EventType.TOOL_CALL_END)).toBe(true);
    expect(chunks.filter((chunk) => chunk.type === EventType.CUSTOM).length).toBeGreaterThan(1);
    const proposalChunk = chunks.find(
      (chunk) => chunk.type === EventType.CUSTOM && chunk.name === AGENT_ORCHESTRATION_EVENT_NAMES.proposal,
    );
    if (proposalChunk?.type !== EventType.CUSTOM) throw new Error('Proposal event was not emitted.');
    expect(AGENT_ORCHESTRATION_PROPOSAL_EVENT_SCHEMA.parse(proposalChunk.value)).toMatchObject({
      runId: 'run-1',
      proposedFieldCount: 1,
    });
    const metricsChunk = chunks.find(
      (chunk) => chunk.type === EventType.CUSTOM && chunk.name === AGENT_ORCHESTRATION_EVENT_NAMES.metrics,
    );
    if (metricsChunk?.type !== EventType.CUSTOM) throw new Error('Metrics event was not emitted.');
    expect(AGENT_ORCHESTRATION_METRICS_EVENT_SCHEMA.parse(metricsChunk.value)).toEqual({
      runId: 'run-1',
      roleCallCount: 4,
      inputTokens: 40,
      outputTokens: 40,
      costUsd: 0.1,
      latencyMs: 40,
    });
    expect(JSON.stringify(metricsChunk)).not.toContain('Mira');
    expect(JSON.stringify(metricsChunk)).not.toContain('apiKey');
  });
});
