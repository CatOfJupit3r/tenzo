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
import type { iProseJob } from './agent-orchestration-contracts';
import {
  AGENT_ORCHESTRATION_EVENT_NAMES,
  AGENT_ORCHESTRATION_METRICS_EVENT_SCHEMA,
  AGENT_ORCHESTRATION_PROPOSAL_EVENT_SCHEMA,
} from './agent-orchestration-events';
import type { iAgentRoleExecutionUsage, iAgentRoleExecutor } from './agent-role-executor.server';
import {
  createOrchestratedCharacterAssistantService,
  createStrictSlotResultSchema,
  createTargetedRepairJob,
  parseProseResult,
  readRequiredMacros,
  shouldUseModelIntentRouter,
} from './orchestrated-character-assistant.server';

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
  it('requires persistent card macros without preserving fillable generation slots', () => {
    expect(
      readRequiredMacros('# {{char}}\n{{gen:identity:one line}}\nRelationship to {{ user }}: {{GEN:bond}}'),
    ).toEqual(['{{char}}', '{{ user }}']);
  });

  it('uses model intent routing only for advice-like prompts', () => {
    expect(shouldUseModelIntentRouter('Haunted botanical archivist trading memories for impossible seeds.')).toBe(
      false,
    );
    expect(shouldUseModelIntentRouter('Create a haunted botanical archivist.')).toBe(false);
    expect(shouldUseModelIntentRouter('How can I make the greeting more inviting?')).toBe(true);
  });

  it('renders strict prose slots into the app-owned template skeleton', () => {
    const job: iProseJob = {
      id: 'prose-description',
      fieldKeys: ['description'],
      purposes: ['Describe the character.'],
      ownedFacts: [],
      allowedEchoes: [],
      forbiddenRestatements: [],
      relevantContext: [],
      styleBible: [],
      requiredMacros: ['{{char}}', '{{user}}'],
      strictTemplates: {
        description: '# {{char}}\nIdentity: {{gen:identity}}\nRelationship: {{gen:relationship}} with {{user}}',
      },
      maximumOutputTokens: 400,
      dependsOnJobIds: [],
    };

    expect(
      parseProseResult(
        job,
        '<slot name="identity">A haunted botanical archivist.</slot>\n<slot name="relationship">Trades memories</slot>',
      ).fields.description,
    ).toBe('# {{char}}\nIdentity: A haunted botanical archivist.\nRelationship: Trades memories with {{user}}');

    expect(
      parseProseResult(job, '<slot name="relationship">Trades memories</slot>', {
        description:
          '# {{char}}\nIdentity: A haunted botanical archivist.\nRelationship: {{gen:relationship}} with {{user}}',
      }).fields.description,
    ).toBe('# {{char}}\nIdentity: A haunted botanical archivist.\nRelationship: Trades memories with {{user}}');

    expect(
      createTargetedRepairJob(job, {
        description: '# {{char}}\nIdentity: {{gen:identity}}\nRelationship: {{gen:relationship}} with {{user}}',
      }).strictTemplates.description,
    ).toBe('{{gen:identity}}\n{{gen:relationship}}');

    const repairJob = createTargetedRepairJob(job, {
      description:
        '# {{char}}\nIdentity: A haunted botanical archivist.\nRelationship: {{gen:relationship}} with {{user}}',
    });
    expect(
      parseProseResult(repairJob, 'Trades memories', {
        description:
          '# {{char}}\nIdentity: A haunted botanical archivist.\nRelationship: {{gen:relationship}} with {{user}}',
      }).fields.description,
    ).toBe('# {{char}}\nIdentity: A haunted botanical archivist.\nRelationship: Trades memories with {{user}}');

    expect(
      parseProseResult(
        repairJob,
        '# {{char}}\nIdentity: A haunted botanical archivist.\nRelationship: Trades memories with {{user}}',
        {
          description: '# {{char}}\nIdentity: {{gen:identity}}\nRelationship: {{gen:relationship}} with {{user}}',
        },
      ).fields.description,
    ).toBe('# {{char}}\nIdentity: A haunted botanical archivist.\nRelationship: Trades memories with {{user}}');

    expect(
      parseProseResult(
        createTargetedRepairJob(job, {
          description: '# {{char}}\nIdentity: {{gen:identity}}\nRelationship: {{gen:relationship}} with {{user}}',
        }),
        'A complete response without the strict skeleton',
        {
          description: '# {{char}}\nIdentity: {{gen:identity}}\nRelationship: {{gen:relationship}} with {{user}}',
        },
      ).fields.description,
    ).toBe('# {{char}}\nIdentity: {{gen:identity}}\nRelationship: {{gen:relationship}} with {{user}}');
  });

  it('does not assign raw prose to a multi-slot strict repair', () => {
    const job: iProseJob = {
      id: 'prose-description',
      fieldKeys: ['description'],
      purposes: ['Describe the character.'],
      ownedFacts: [],
      allowedEchoes: [],
      forbiddenRestatements: [],
      relevantContext: [],
      styleBible: [],
      requiredMacros: [],
      strictTemplates: {
        description: 'Identity: {{gen:identity}}\nRelationship: {{gen:relationship}}',
      },
      maximumOutputTokens: 400,
      dependsOnJobIds: [],
    };

    expect(
      parseProseResult(
        createTargetedRepairJob(job, {
          description: 'Identity: {{gen:identity}}\nRelationship: {{gen:relationship}}',
        }),
        'Ambiguous prose for two slots',
        { description: 'Identity: {{gen:identity}}\nRelationship: {{gen:relationship}}' },
      ).fields.description,
    ).toBe('Identity: {{gen:identity}}\nRelationship: {{gen:relationship}}');
  });

  it('requires and normalizes every key in a structured strict-slot result', () => {
    const schema = createStrictSlotResultSchema('{{gen:Identity}}\n{{gen:relationship:how they regard the user}}');

    expect(schema.parse({ identity: 'An archivist.', relationship: 'A wary client.' })).toEqual({
      identity: 'An archivist.',
      relationship: 'A wary client.',
    });
    expect(schema.safeParse({ identity: 'An archivist.' }).success).toBe(false);
  });

  it('unwraps accidental slot markup from a field without a strict template', () => {
    const job: iProseJob = {
      id: 'prose-personality',
      fieldKeys: ['personality'],
      purposes: ['Define personality.'],
      ownedFacts: [],
      allowedEchoes: [],
      forbiddenRestatements: [],
      relevantContext: [],
      styleBible: [],
      requiredMacros: [],
      strictTemplates: {},
      maximumOutputTokens: 400,
      dependsOnJobIds: [],
    };

    expect(
      parseProseResult(job, '[<slot name="personality">Quiet, exacting, and curious.</slot>]').fields.personality,
    ).toBe('Quiet, exacting, and curious.');
    expect(parseProseResult(job, '{"personality":"Quiet, exacting, and curious."}').fields.personality).toBe(
      'Quiet, exacting, and curious.',
    );
  });

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
      if (options.profile.role === AGENT_ROLES['content-planner']) {
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
            styleBible: ['Specific, grounded prose.'],
          },
          'content-planner',
          { costUsd: 0.02 },
        ) as never;
      }
      throw new Error(`Unexpected structured role ${options.profile.role}.`);
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

    expect(roles).toEqual([AGENT_ROLES['content-planner']]);
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
      roleCallCount: 2,
      inputTokens: 20,
      outputTokens: 20,
      costUsd: 0.05,
      latencyMs: 20,
    });
    expect(JSON.stringify(metricsChunk)).not.toContain('Mira');
    expect(JSON.stringify(metricsChunk)).not.toContain('apiKey');
  });
});
