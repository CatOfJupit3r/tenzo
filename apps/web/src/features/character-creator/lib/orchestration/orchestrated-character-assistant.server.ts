import { EventType } from '@tanstack/ai';
import type { ModelMessage, StreamChunk, TokenUsage, UIMessage } from '@tanstack/ai';
import type { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import { ASSISTANT_FINAL_RESPONSE_SCHEMA } from '../assistant/assistant-final-response';
import type { iCharacterAssistantStreamRequest, iChatTemplateRef } from '../assistant/character-assistant-contracts';
import {
  createCharacterAssistantActionHandlers,
  getAllowedCharacterAssistantTextFieldKeys,
} from '../assistant/character-assistant-tools';
import type { iCharacterAssistantProposalStore } from '../assistant/character-assistant-tools';
import { CHARACTER_TEXT_FIELD_KEYS, CHARACTER_TEXT_FIELD_KEY_SCHEMA } from '../cards/card-schema';
import type { CharacterTextFieldKey } from '../cards/card-schema';
import { TEMPLATE_MODES } from '../cards/field-templates';
import { parseRepairedJson } from '../generation/json-repair';
import { AGENT_ROLES } from '../provider/agent-role-contracts';
import type { AgentRole } from '../provider/agent-role-contracts';
import { PROVIDER_KINDS } from '../provider/provider-health';
import {
  AGENT_PROGRESS_PHASES,
  AGENT_ROUTE_DECISION_SCHEMA,
  CHARACTER_BRIEF_SCHEMA,
  CHARACTER_CONTENT_PLAN_SCHEMA,
  PROSE_JOB_RESULT_SCHEMA,
  QUALITY_FINDING_SCHEMA,
} from './agent-orchestration-contracts';
import type { AgentProgressPhase, iProseJob } from './agent-orchestration-contracts';
import {
  AGENT_ORCHESTRATION_EVENT_NAMES,
  AGENT_ORCHESTRATION_METRICS_EVENT_SCHEMA,
  AGENT_ORCHESTRATION_PROPOSAL_EVENT_SCHEMA,
} from './agent-orchestration-events';
import { createAgentOrchestrationService } from './agent-orchestration-service';
import type { iAgentOrchestrationCallResult } from './agent-orchestration-service';
import { createAgentRoleExecutor } from './agent-role-executor.server';
import type { iAgentRoleExecutionResult, iAgentRoleExecutor } from './agent-role-executor.server';
import { createAgentRoleProfiles } from './agent-role-profile-service';
import type { iAgentCallUsage, iAgentRunBudgetLimits } from './agent-run-budget';
import { createCharacterBriefService } from './character-brief-service';
import type { iCharacterBriefInput } from './character-brief-service';
import { createContentPlanService } from './content-plan-service';
import { createQualityGateService } from './quality-gate-service';

export interface iOrchestratedCharacterAssistantOptions {
  payload: iCharacterAssistantStreamRequest;
  messages: Array<ModelMessage | UIMessage>;
  store: iCharacterAssistantProposalStore;
  abortSignal?: AbortSignal;
  roleAssignments?: Partial<Record<AgentRole, { modelId: string; allowedProviderSlug: string }>>;
}

export interface iOrchestratedCharacterAssistantDependencies {
  executor: iAgentRoleExecutor;
  generateUuid: () => string;
}

interface iStreamEventQueue {
  push: (chunk: StreamChunk) => void;
  finish: () => void;
  read: () => Promise<StreamChunk | null>;
}

type StreamEventReader = (chunk: StreamChunk | null) => unknown;

const DEFAULT_DEPENDENCIES: iOrchestratedCharacterAssistantDependencies = {
  executor: createAgentRoleExecutor(),
  generateUuid,
};

function createStreamEventQueue(): iStreamEventQueue {
  const chunks: StreamChunk[] = [];
  const readers: StreamEventReader[] = [];
  let isFinished = false;

  return {
    push(chunk) {
      const reader = readers.shift();
      if (reader) reader(chunk);
      else chunks.push(chunk);
    },
    finish() {
      isFinished = true;
      readers.splice(0).forEach((reader) => reader(null));
    },
    async read() {
      const chunk = chunks.shift();
      if (chunk) return chunk;
      if (isFinished) return null;
      return new Promise((resolve) => {
        readers.push(resolve);
      });
    },
  };
}

function toCallUsage(result: iAgentRoleExecutionResult<unknown>): iAgentCallUsage {
  return {
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    costUsd: result.usage.costUsd,
    latencyMs: result.usage.latencyMs,
  };
}

function addTokenUsage(total: TokenUsage, result: iAgentRoleExecutionResult<unknown>) {
  total.promptTokens += result.usage.inputTokens;
  total.completionTokens += result.usage.outputTokens;
  total.totalTokens += result.usage.totalTokens;
}

interface iAgentRunMetrics {
  runId: string;
  roleCallCount: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

function addRoleMetrics(total: iAgentRunMetrics, result: iAgentRoleExecutionResult<unknown>) {
  total.inputTokens += result.usage.inputTokens;
  total.outputTokens += result.usage.outputTokens;
  total.costUsd += result.usage.costUsd;
  total.latencyMs += result.usage.latencyMs;
}

function emitRunMetrics(queue: iStreamEventQueue, metrics: iAgentRunMetrics) {
  queue.push({
    type: EventType.CUSTOM,
    name: AGENT_ORCHESTRATION_EVENT_NAMES.metrics,
    value: AGENT_ORCHESTRATION_METRICS_EVENT_SCHEMA.parse(metrics),
  });
}

function readMessageText(message: ModelMessage | UIMessage): string {
  if ('content' in message && typeof message.content === 'string') return message.content;
  if ('parts' in message && Array.isArray(message.parts)) {
    return message.parts
      .flatMap((part) =>
        part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'content' in part
          ? [String(part.content)]
          : [],
      )
      .join('\n');
  }
  return '';
}

function getLatestUserPrompt(messages: readonly (ModelMessage | UIMessage)[]) {
  const message = messages.findLast((candidate) => candidate.role === 'user');
  const prompt = message ? readMessageText(message).trim() : '';
  if (!prompt) throw new Error('The orchestration run requires a user message.');
  return prompt;
}

function getStrictTemplates(templates: readonly iChatTemplateRef[]) {
  return Object.fromEntries(
    templates.flatMap((template) => {
      if (template.mode !== TEMPLATE_MODES.strict) return [];
      return template.fieldKeys.flatMap((fieldKey) =>
        CHARACTER_TEXT_FIELD_KEY_SCHEMA.safeParse(fieldKey).success ? [[fieldKey, template.content]] : [],
      );
    }),
  ) as Partial<Record<CharacterTextFieldKey, string>>;
}

function readRequiredMacros(value: string) {
  return [...new Set(value.match(/\{\{[^{}]+\}\}/g) ?? [])];
}

function getRequiredMacros(
  fieldKeys: readonly CharacterTextFieldKey[],
  currentFields: Partial<Record<CharacterTextFieldKey, string>>,
  strictTemplates: Partial<Record<CharacterTextFieldKey, string>>,
) {
  return Object.fromEntries(
    fieldKeys.map((fieldKey) => [
      fieldKey,
      readRequiredMacros(`${currentFields[fieldKey] ?? ''}\n${strictTemplates[fieldKey] ?? ''}`),
    ]),
  ) as Partial<Record<CharacterTextFieldKey, readonly string[]>>;
}

function stringifyRoleInput(value: unknown) {
  return JSON.stringify(value);
}

function parseProseResult(job: iProseJob, value: string) {
  if (job.fieldKeys.length === 1) {
    const fieldKey = job.fieldKeys[0];
    if (!fieldKey) throw new Error(`Prose job ${job.id} has no field.`);
    return PROSE_JOB_RESULT_SCHEMA.parse({ jobId: job.id, fields: { [fieldKey]: value.trim() } });
  }
  return parseRepairedJson(value, PROSE_JOB_RESULT_SCHEMA);
}

function createRunBudgets(maximumOutputTokens: number): {
  writerBudget: iAgentRunBudgetLimits;
  qualityBudget: iAgentRunBudgetLimits;
} {
  return {
    writerBudget: {
      maximumCalls: CHARACTER_TEXT_FIELD_KEYS.length,
      maximumInputTokens: 128_000,
      maximumOutputTokens: maximumOutputTokens * CHARACTER_TEXT_FIELD_KEYS.length,
      maximumCostUsd: 0.8,
      maximumLatencyMs: 360_000,
    },
    qualityBudget: {
      maximumCalls: 5,
      maximumInputTokens: 96_000,
      maximumOutputTokens: maximumOutputTokens * 3,
      maximumCostUsd: 0.5,
      maximumLatencyMs: 300_000,
    },
  };
}

function emitPhase(queue: iStreamEventQueue, runId: string, phase: AgentProgressPhase) {
  queue.push({ type: EventType.CUSTOM, name: AGENT_ORCHESTRATION_EVENT_NAMES.phase, value: { runId, phase } });
}

function getProviderKind(payload: iCharacterAssistantStreamRequest) {
  if (payload.providerKind === PROVIDER_KINDS.openrouter || payload.providerKind === PROVIDER_KINDS.koboldcpp) {
    return payload.providerKind;
  }
  return payload.provider === 'openrouter' ? PROVIDER_KINDS.openrouter : PROVIDER_KINDS.koboldcpp;
}

function createOrchestrationRun(
  options: iOrchestratedCharacterAssistantOptions,
  dependencies: iOrchestratedCharacterAssistantDependencies,
  queue: iStreamEventQueue,
) {
  const { payload } = options;
  const runId = dependencies.generateUuid();
  const metrics: iAgentRunMetrics = {
    runId,
    roleCallCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    latencyMs: 0,
  };
  const prompt = getLatestUserPrompt(options.messages);
  const requestedFieldKeys = getAllowedCharacterAssistantTextFieldKeys(
    payload.fieldShouldAllowAssistantEditing,
    payload.focus,
  );
  const currentFields = Object.fromEntries(
    CHARACTER_TEXT_FIELD_KEYS.map((fieldKey) => [fieldKey, payload.card.data[fieldKey]]),
  ) as Record<CharacterTextFieldKey, string>;
  const strictTemplates = getStrictTemplates(payload.templates);
  const requiredMacros = getRequiredMacros(requestedFieldKeys, currentFields, strictTemplates);
  const profiles = createAgentRoleProfiles({
    qualityProfile: payload.agentQualityProfile,
    providerKind: getProviderKind(payload),
    modelId: payload.model,
    allowedProviderSlug: payload.openRouterProvider ?? '',
    maximumProseOutputTokens: payload.maxTokens,
    proseTemperature: payload.temperature,
    topP: payload.topP,
    roleAssignments: options.roleAssignments,
  });
  const usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const executeStructured = async <T, TInput>(
    role: keyof typeof profiles,
    schema: z.ZodType<T>,
    roleInput: TInput,
    schemaDescription: string,
  ): Promise<iAgentOrchestrationCallResult<T>> => {
    metrics.roleCallCount += 1;
    const execution = await dependencies.executor.executeStructured({
      profile: profiles[role],
      endpoint: payload.endpoint,
      apiKey: payload.apiKey,
      runId,
      prompt: stringifyRoleInput(roleInput),
      schema,
      schemaDescription,
      localCapabilities: payload.localCapabilities,
      abortSignal: options.abortSignal,
    });
    addTokenUsage(usage, execution);
    addRoleMetrics(metrics, execution);
    return { output: execution.value, usage: toCallUsage(execution) };
  };
  const executeProse = async (job: iProseJob, extraInput: unknown = {}, isRepair = false) => {
    metrics.roleCallCount += 1;
    const execution = await dependencies.executor.executeProse({
      profile: profiles[AGENT_ROLES['prose-worker']],
      endpoint: payload.endpoint,
      apiKey: payload.apiKey,
      runId,
      prompt: stringifyRoleInput({ job, ...(extraInput as object) }),
      localCapabilities: payload.localCapabilities,
      abortSignal: options.abortSignal,
      isRepair,
    });
    addTokenUsage(usage, execution);
    addRoleMetrics(metrics, execution);
    return { output: parseProseResult(job, execution.value), usage: toCallUsage(execution) };
  };
  const briefService = createCharacterBriefService({
    enrichBrief: async (input, abortSignal) => {
      const result = await executeStructured(
        AGENT_ROLES['brief-enricher'],
        CHARACTER_BRIEF_SCHEMA,
        input,
        'Provenance-aware character brief.',
      );
      abortSignal?.throwIfAborted();
      return result.output;
    },
  });
  const planService = createContentPlanService({
    planContent: async (input, abortSignal) => {
      const result = await executeStructured(
        AGENT_ROLES.orchestrator,
        CHARACTER_CONTENT_PLAN_SCHEMA,
        input,
        'Field ownership and content plan.',
      );
      abortSignal?.throwIfAborted();
      return result.output;
    },
  });
  const qualityService = createQualityGateService({
    criticize: async (input, deterministicFindings, abortSignal) => {
      const result = await executeStructured(
        AGENT_ROLES.critic,
        QUALITY_FINDING_SCHEMA.array(),
        { ...input, deterministicFindings },
        'Localized character draft quality findings.',
      );
      abortSignal?.throwIfAborted();
      return result;
    },
    repair: async (job, drafts, findings, abortSignal) => {
      const result = await executeProse(job, { drafts, findings, isTargetedRepair: true }, true);
      abortSignal?.throwIfAborted();
      return result;
    },
  });
  const service = createAgentOrchestrationService({
    routeIntent: async (input) =>
      executeStructured(
        AGENT_ROLES['intent-router'],
        AGENT_ROUTE_DECISION_SCHEMA,
        { prompt: input.prompt, requestedFieldKeys: input.requestedFieldKeys },
        'Advice or drafting route decision.',
      ),
    createBrief: async (input, abortSignal) => {
      const result = await briefService.createBrief(input, abortSignal);
      queue.push({
        type: EventType.CUSTOM,
        name: AGENT_ORCHESTRATION_EVENT_NAMES.assumptions,
        value: {
          runId,
          assumptions: result.brief.assumptions.map((fact) => ({ id: fact.id, statement: fact.statement })),
          creativeChoices: result.brief.creativeChoices,
        },
      });
      return result;
    },
    createPlan: async (input, abortSignal) => planService.createPlan(input, abortSignal),
    writeProse: async (job) => executeProse(job),
    reviewQuality: async (input, budget, abortSignal) => qualityService.review(input, budget, abortSignal),
    submitProposal: async (drafts, findings) => {
      const toolCallId = dependencies.generateUuid();
      const handlers = createCharacterAssistantActionHandlers({
        focus: payload.focus,
        store: options.store,
        templates: payload.templates,
      });
      const changes = Object.entries(drafts).flatMap(([fieldKey, value]) =>
        value === undefined ? [] : [{ fieldKey: CHARACTER_TEXT_FIELD_KEY_SCHEMA.parse(fieldKey), value }],
      );
      const proposalOutput = handlers.proposeCharacterFields(
        {
          changes,
          summary:
            findings.length > 0 ? 'Orchestrated character draft with quality warnings' : 'Orchestrated character draft',
        },
        toolCallId,
      );
      queue.push({
        type: EventType.TOOL_CALL_START,
        toolCallId,
        toolCallName: 'propose_character_fields',
        toolName: 'propose_character_fields',
      });
      queue.push({
        type: EventType.TOOL_CALL_ARGS,
        toolCallId,
        delta: JSON.stringify({ changes }),
      });
      queue.push({
        type: EventType.TOOL_CALL_END,
        toolCallId,
        toolCallName: 'propose_character_fields',
        toolName: 'propose_character_fields',
        input: { changes },
        output: proposalOutput,
        result: JSON.stringify(proposalOutput),
        state: 'output-available',
      });
      queue.push({
        type: EventType.TOOL_CALL_RESULT,
        messageId: dependencies.generateUuid(),
        toolCallId,
        content: JSON.stringify(proposalOutput),
        role: 'tool',
        state: 'output-available',
      });
      queue.push({
        type: EventType.CUSTOM,
        name: AGENT_ORCHESTRATION_EVENT_NAMES.proposal,
        value: AGENT_ORCHESTRATION_PROPOSAL_EVENT_SCHEMA.parse({
          runId,
          proposalId: proposalOutput.proposal?.id ?? toolCallId,
          toolCallId,
          proposedFieldCount: changes.length,
        }),
      });
      return { proposalId: proposalOutput.proposal?.id ?? toolCallId };
    },
  });
  const briefInput = {
    prompt,
    card: payload.card,
    requestedFieldKeys,
    referenceSummaries: [
      ...payload.contextAttachments.map((attachment) => `${attachment.title}: ${attachment.content}`.slice(0, 1_200)),
      ...payload.exampleCharacters.map((character) => JSON.stringify(character).slice(0, 1_200)),
    ],
    toneAndStyle: payload.globalCharacterInstruction?.trim() ? [payload.globalCharacterInstruction.trim()] : [],
    boundaries: [],
  } satisfies iCharacterBriefInput;
  const budgets = createRunBudgets(payload.maxTokens);

  return {
    runId,
    usage,
    metrics,
    promise: service.run({
      ...briefInput,
      runId,
      currentFields,
      strictTemplates,
      requiredMacros,
      fieldWritingStrategy: payload.fieldWritingStrategy,
      ...budgets,
      abortSignal: options.abortSignal,
      onPhaseChange: (phase) => emitPhase(queue, runId, phase),
    }),
  };
}

export function createOrchestratedCharacterAssistantService(
  dependencies: iOrchestratedCharacterAssistantDependencies = DEFAULT_DEPENDENCIES,
) {
  return {
    async *stream(options: iOrchestratedCharacterAssistantOptions): AsyncGenerator<StreamChunk> {
      const queue = createStreamEventQueue();
      const run = createOrchestrationRun(options, dependencies, queue);
      const threadId = options.messages.at(-1)?.id ?? run.runId;
      const messageId = dependencies.generateUuid();
      let hasEmittedMetrics = false;
      const emitFinalRunMetrics = () => {
        if (hasEmittedMetrics) return;
        hasEmittedMetrics = true;
        emitRunMetrics(queue, run.metrics);
      };
      const completion = run.promise
        .then((result) => {
          if (result.brief) {
            queue.push({
              type: EventType.CUSTOM,
              name: AGENT_ORCHESTRATION_EVENT_NAMES.assumptions,
              value: {
                runId: run.runId,
                assumptions: result.brief.assumptions.map((fact) => ({ id: fact.id, statement: fact.statement })),
                creativeChoices: result.brief.creativeChoices,
              },
            });
          }
          if (result.findings.length > 0) {
            queue.push({
              type: EventType.CUSTOM,
              name: AGENT_ORCHESTRATION_EVENT_NAMES.quality,
              value: { runId: run.runId, findings: result.findings },
            });
          }
          if (result.recovery) {
            queue.push({
              type: EventType.CUSTOM,
              name: AGENT_ORCHESTRATION_EVENT_NAMES.recovery,
              value: { runId: run.runId, recovery: result.recovery, message: result.answer },
            });
          }
          const finalResponse = ASSISTANT_FINAL_RESPONSE_SCHEMA.parse({
            assistantMessage: result.answer,
            followUpSuggestions:
              result.phase === AGENT_PROGRESS_PHASES.completed ? [] : ['Revise the request and retry'],
          });
          const raw = JSON.stringify(finalResponse);
          queue.push({ type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' });
          queue.push({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: result.answer });
          queue.push({ type: EventType.TEXT_MESSAGE_END, messageId });
          queue.push({ type: EventType.CUSTOM, name: 'structured-output.start', value: { messageId } });
          queue.push({
            type: EventType.CUSTOM,
            name: 'structured-output.complete',
            value: { object: finalResponse, raw },
          });
          emitFinalRunMetrics();
          queue.push({
            type: EventType.RUN_FINISHED,
            threadId,
            runId: run.runId,
            finishReason: 'stop',
            usage: run.usage,
          });
        })
        .catch((error) => {
          emitFinalRunMetrics();
          throw error;
        })
        .finally(() => queue.finish());

      while (true) {
        const chunk = await queue.read();
        if (!chunk) break;
        yield chunk;
      }
      await completion;
    },
  };
}

const DEFAULT_ORCHESTRATED_CHARACTER_ASSISTANT_SERVICE = createOrchestratedCharacterAssistantService();

export function streamOrchestratedCharacterAssistant(options: iOrchestratedCharacterAssistantOptions) {
  return DEFAULT_ORCHESTRATED_CHARACTER_ASSISTANT_SERVICE.stream(options);
}
