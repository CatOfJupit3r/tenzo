import { EventType } from '@tanstack/ai';
import type { ModelMessage, StreamChunk, UIMessage } from '@tanstack/ai';
import { z } from 'zod';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import { ASSISTANT_FINAL_RESPONSE_SCHEMA } from '../assistant/assistant-final-response';
import {
  CHARACTER_ASSISTANT_FOCUS_KINDS,
  CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA,
} from '../assistant/character-assistant-contracts';
import type { CharacterAssistantFocus, iChatTemplateRef } from '../assistant/character-assistant-contracts';
import { streamCharacterAssistant } from '../assistant/character-assistant-runtime.server';
import { generateStructuredCharacterAssistantStream } from '../assistant/character-assistant-structured.server';
import type { iCharacterAssistantProposalStore } from '../assistant/character-assistant-tools';
import {
  createNativeToolRouteKey,
  fallbackFromUnsupportedNativeTools,
  isNativeToolRouteUnsupported,
  markNativeToolRouteUnsupported,
} from '../assistant/native-tool-fallback';
import { CHARACTER_TEXT_FIELD_KEYS } from '../cards/card-schema';
import type { CharacterCard, CharacterTextFieldKey } from '../cards/card-schema';
import { TEMPLATE_FIELD_KEY_SCHEMA, TEMPLATE_MODES } from '../cards/field-templates';
import {
  DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING,
  GENERATION_PROVIDERS,
  REQUEST_MODES,
} from '../generation/generation-config';
import {
  AGENT_ORCHESTRATION_EVENT_NAMES,
  AGENT_ORCHESTRATION_METRICS_EVENT_SCHEMA,
} from '../orchestration/agent-orchestration-events';
import { AgentRolePolicyError } from '../orchestration/agent-role-executor.server';
import { streamOrchestratedCharacterAssistant } from '../orchestration/orchestrated-character-assistant.server';
import { createCharacterEditProposal, preserveAssistantProtectedFields } from '../proposals/character-edit-proposal';
import type { iCharacterEditProposal } from '../proposals/character-edit-proposal';
import { AGENT_QUALITY_PROFILES, AGENT_QUALITY_PROFILE_SCHEMA } from '../provider/agent-quality-profile';
import { AGENT_ROLES, AGENT_ROLE_PROFILE_SCHEMA, AGENT_ROLE_SCHEMA } from '../provider/agent-role-contracts';
import { MODEL_CAPABILITIES, MODEL_CAPABILITY_SCHEMA } from '../provider/model-capabilities';
import { probeProviderMetadata, PROVIDER_KINDS } from '../provider/provider-health';
import { resolveProviderPolicy } from '../provider/provider-policy-resolver';
import { AGENT_EVAL_RUN_ARTIFACT_SCHEMA } from './agent-eval-contracts';
import type { iAgentEvalCase } from './agent-eval-contracts';
import type { iAgentEvalRunResult } from './agent-eval-runner';

export const AGENT_EVAL_PIPELINE_SCHEMA = z.enum(['single-agent', 'orchestrated']);
export const AGENT_EVAL_PIPELINES = AGENT_EVAL_PIPELINE_SCHEMA.enum;
export type AgentEvalPipeline = z.infer<typeof AGENT_EVAL_PIPELINE_SCHEMA>;

const AGENT_EVAL_ROLE_ASSIGNMENT_SCHEMA = z.object({
  modelId: z.string().trim().min(1),
  allowedProviderSlug: z.string().trim(),
});

export const AGENT_EVAL_EXECUTION_PROFILE_SCHEMA = z
  .object({
    id: z.string().trim().min(1),
    pipeline: AGENT_EVAL_PIPELINE_SCHEMA,
    providerKind: z.enum([PROVIDER_KINDS.openrouter, PROVIDER_KINDS.koboldcpp]),
    endpoint: z.string().url(),
    modelId: z.string().trim().min(1),
    allowedProviderSlug: z.string().trim().default(''),
    localCapabilities: z.array(MODEL_CAPABILITY_SCHEMA).default([]),
    qualityProfile: AGENT_QUALITY_PROFILE_SCHEMA.default(AGENT_QUALITY_PROFILES.balanced),
    maximumOutputTokens: z.number().int().positive().default(2_000),
    temperature: z.number().min(0).max(2).default(0.8),
    topP: z.number().min(0).max(1).default(1),
    promptPricePerMillionUsd: z.number().nonnegative(),
    completionPricePerMillionUsd: z.number().nonnegative(),
    seed: z.number().int().nullable().default(null),
    roleAssignments: z.partialRecord(AGENT_ROLE_SCHEMA, AGENT_EVAL_ROLE_ASSIGNMENT_SCHEMA).optional(),
  })
  .superRefine((profile, context) => {
    if (profile.providerKind === PROVIDER_KINDS.openrouter && !profile.allowedProviderSlug) {
      context.addIssue({
        code: 'custom',
        path: ['allowedProviderSlug'],
        message: 'OpenRouter eval profiles require an allowed provider slug.',
      });
    }
    if (profile.providerKind === PROVIDER_KINDS.koboldcpp && profile.allowedProviderSlug) {
      context.addIssue({
        code: 'custom',
        path: ['allowedProviderSlug'],
        message: 'Local eval profiles cannot declare a remote provider slug.',
      });
    }
  });
export type iAgentEvalExecutionProfile = z.infer<typeof AGENT_EVAL_EXECUTION_PROFILE_SCHEMA>;

export interface iAgentEvalRuntimeOptions {
  evalCase: iAgentEvalCase;
  profile: iAgentEvalExecutionProfile;
  apiKey: string;
  abortSignal?: AbortSignal;
}

export interface iAgentEvalRuntimeDependencies {
  streamSingleAgentNative: typeof streamCharacterAssistant;
  streamSingleAgentStructured: typeof generateStructuredCharacterAssistantStream;
  streamOrchestrated: typeof streamOrchestratedCharacterAssistant;
  verifySingleAgentPolicy: (options: iAgentEvalRuntimeOptions) => Promise<void>;
}

interface iCollectedEvalStream {
  assistantText: string;
  inputTokens: number;
  outputTokens: number;
  actualCostUsd: number | null;
  toolOutcomes: Array<{ toolName: string; outcome: 'completed' | 'failed' | 'no-op' }>;
}

const DEFAULT_DEPENDENCIES: iAgentEvalRuntimeDependencies = {
  streamSingleAgentNative: streamCharacterAssistant,
  streamSingleAgentStructured: generateStructuredCharacterAssistantStream,
  streamOrchestrated: streamOrchestratedCharacterAssistant,
  verifySingleAgentPolicy,
};

const TOOL_CALL_END_SCHEMA = z.object({
  type: z.literal(EventType.TOOL_CALL_END),
  toolCallName: z.string().optional(),
  toolName: z.string().optional(),
  state: z.string().optional(),
  output: z.object({ isNoOp: z.boolean().optional() }).passthrough().optional(),
});
const STRUCTURED_OUTPUT_COMPLETE_SCHEMA = z.object({
  type: z.literal(EventType.CUSTOM),
  name: z.literal('structured-output.complete'),
  value: z.object({ object: ASSISTANT_FINAL_RESPONSE_SCHEMA }),
});

async function verifySingleAgentPolicy(options: iAgentEvalRuntimeOptions) {
  const { profile } = options;
  const role = profileSupportsNativeTools(profile) ? AGENT_ROLES['content-planner'] : AGENT_ROLES['intent-router'];
  const roleProfile = AGENT_ROLE_PROFILE_SCHEMA.parse({
    id: `${profile.id}-baseline-policy`,
    role,
    providerKind: profile.providerKind,
    modelId: profile.modelId,
    allowedProviderSlugs: profile.allowedProviderSlug ? [profile.allowedProviderSlug] : [],
    requiredCapabilities: profileSupportsNativeTools(profile)
      ? [MODEL_CAPABILITIES['structured-output'], MODEL_CAPABILITIES['tool-calling']]
      : [MODEL_CAPABILITIES['structured-output']],
    temperature: profile.temperature,
    topP: profile.topP,
    budget: {
      maximumCalls: 8,
      maximumInputTokens: 128_000,
      maximumOutputTokens: profile.maximumOutputTokens,
      maximumCostUsd: 5,
      maximumLatencyMs: 300_000,
    },
    maximumPromptPricePerMillionUsd: profile.promptPricePerMillionUsd,
    maximumCompletionPricePerMillionUsd: profile.completionPricePerMillionUsd,
  });
  const health =
    profile.providerKind === PROVIDER_KINDS.openrouter
      ? await probeProviderMetadata({
          endpoint: profile.endpoint,
          apiKey: options.apiKey,
          requestMode: REQUEST_MODES.browser,
          model: profile.modelId,
          openRouterProvider: profile.allowedProviderSlug,
        })
      : null;
  const resolution = resolveProviderPolicy({
    profile: roleProfile,
    catalog: health?.policyCatalog ?? null,
    localCapabilities: profile.localCapabilities,
    now: new Date(),
  });
  if (!resolution.isEligible) {
    throw new AgentRolePolicyError('The frozen single-agent baseline profile is not policy eligible.', {
      code: 'policy-ineligible',
      reasons: resolution.failures.map((failure) => failure.reason),
      role,
      modelId: profile.modelId,
    });
  }
}

function createEvalCard(evalCase: iAgentEvalCase): CharacterCard {
  const card = createEmptyCharacterCard();
  for (const fieldKey of CHARACTER_TEXT_FIELD_KEYS) {
    const value = evalCase.currentFields?.[fieldKey];
    if (value !== undefined) card.data[fieldKey] = value;
  }
  return card;
}

function createEvalFocus(requestedFieldKeys: readonly CharacterTextFieldKey[]): CharacterAssistantFocus {
  if (requestedFieldKeys.length === 1) {
    const fieldKey = requestedFieldKeys[0];
    if (!fieldKey) throw new Error('A focused eval case requires one field key.');
    return { kind: CHARACTER_ASSISTANT_FOCUS_KINDS.field, fieldKey };
  }
  if (requestedFieldKeys.length > 1) {
    return { kind: CHARACTER_ASSISTANT_FOCUS_KINDS.fields, fieldKeys: [...requestedFieldKeys] };
  }
  return { kind: CHARACTER_ASSISTANT_FOCUS_KINDS.card };
}

function createEvalTemplates(evalCase: iAgentEvalCase): iChatTemplateRef[] {
  if (!evalCase.strictTemplate || evalCase.requestedFieldKeys.length === 0) return [];
  const fieldKeys = evalCase.requestedFieldKeys.flatMap((fieldKey) => {
    const result = TEMPLATE_FIELD_KEY_SCHEMA.safeParse(fieldKey);
    return result.success ? [result.data] : [];
  });
  if (fieldKeys.length === 0) return [];
  return [
    {
      id: `${evalCase.id}-strict-template`,
      name: evalCase.title,
      mode: TEMPLATE_MODES.strict,
      fieldKeys,
      content: evalCase.strictTemplate,
    },
  ];
}

function createEvalMessages(evalCase: iAgentEvalCase): Array<ModelMessage | UIMessage> {
  return [{ role: 'user', content: evalCase.prompt }];
}

function createEvalStore(card: CharacterCard) {
  let projectedCard = structuredClone(card);
  const proposals: iCharacterEditProposal[] = [];
  const store: iCharacterAssistantProposalStore = {
    getCard: () => projectedCard,
    appendProposedCard: ({ toolCallId, summary, proposedCard }) => {
      const permittedCard = preserveAssistantProtectedFields(
        projectedCard,
        proposedCard,
        DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING,
      );
      const proposal = createCharacterEditProposal({
        characterId: 'agent-eval',
        baseCard: projectedCard,
        proposedCard: permittedCard,
        toolCallId,
        summary,
      });
      projectedCard = structuredClone(permittedCard);
      proposals.push(proposal);
      return proposal;
    },
  };
  return { store, proposals };
}

function createContextAttachments(evalCase: iAgentEvalCase) {
  return [
    ...(evalCase.referenceSummary
      ? [
          {
            id: `${evalCase.id}-reference`,
            kind: 'eval-reference-summary',
            title: 'Reference summary',
            content: evalCase.referenceSummary,
            warnings: ['Use for structural depth only; do not copy phrases.'],
            confidence: 1,
          },
        ]
      : []),
    ...(evalCase.priorConversationSummary
      ? [
          {
            id: `${evalCase.id}-conversation`,
            kind: 'eval-prior-conversation',
            title: 'Prior conversation summary',
            content: evalCase.priorConversationSummary,
            warnings: [],
            confidence: 1,
          },
        ]
      : []),
  ];
}

function toToolOutcome(chunk: StreamChunk): iCollectedEvalStream['toolOutcomes'][number] | null {
  const result = TOOL_CALL_END_SCHEMA.safeParse(chunk);
  if (!result.success) return null;
  const toolName = result.data.toolCallName ?? result.data.toolName;
  if (!toolName) return null;
  let outcome: iCollectedEvalStream['toolOutcomes'][number]['outcome'] = 'completed';
  if (result.data.state === 'output-error') outcome = 'failed';
  else if (result.data.output?.isNoOp === true) outcome = 'no-op';
  return { toolName, outcome };
}

async function collectEvalStream(stream: AsyncIterable<StreamChunk>): Promise<iCollectedEvalStream> {
  const result: iCollectedEvalStream = {
    assistantText: '',
    inputTokens: 0,
    outputTokens: 0,
    actualCostUsd: null,
    toolOutcomes: [],
  };
  let structuredAssistantText: string | null = null;
  for await (const chunk of stream) {
    if (chunk.type === EventType.TEXT_MESSAGE_CONTENT) result.assistantText += chunk.delta;
    if (chunk.type === EventType.RUN_FINISHED && chunk.usage) {
      result.inputTokens = chunk.usage.promptTokens;
      result.outputTokens = chunk.usage.completionTokens;
    }
    if (chunk.type === EventType.CUSTOM && chunk.name === AGENT_ORCHESTRATION_EVENT_NAMES.metrics) {
      result.actualCostUsd = AGENT_ORCHESTRATION_METRICS_EVENT_SCHEMA.parse(chunk.value).costUsd;
    }
    const structuredOutput = STRUCTURED_OUTPUT_COMPLETE_SCHEMA.safeParse(chunk);
    if (structuredOutput.success) {
      structuredAssistantText = structuredOutput.data.value.object.assistantMessage;
    }
    const toolOutcome = toToolOutcome(chunk);
    if (toolOutcome) result.toolOutcomes.push(toolOutcome);
  }
  if (structuredAssistantText !== null) result.assistantText = structuredAssistantText;
  return result;
}

function readProposedFields(proposals: readonly iCharacterEditProposal[]) {
  return Object.fromEntries(
    proposals.flatMap((proposal) =>
      proposal.patches.flatMap((patch) => (patch.kind === 'text' ? [[patch.fieldKey, patch.newValue] as const] : [])),
    ),
  );
}

function calculateCost(profile: iAgentEvalExecutionProfile, inputTokens: number, outputTokens: number) {
  return (
    (inputTokens * profile.promptPricePerMillionUsd + outputTokens * profile.completionPricePerMillionUsd) / 1_000_000
  );
}

function getErrorCategory(error: unknown) {
  if (error instanceof AgentRolePolicyError) return error.code;
  if (error instanceof Error) return error.name || 'generation-error';
  return 'generation-error';
}

function createPayload(
  options: iAgentEvalRuntimeOptions,
  card: CharacterCard,
  focus: CharacterAssistantFocus,
  messages: Array<ModelMessage | UIMessage>,
  templates: iChatTemplateRef[],
) {
  const { profile, evalCase } = options;
  return CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA.parse({
    provider:
      profile.providerKind === PROVIDER_KINDS.openrouter
        ? GENERATION_PROVIDERS.openrouter
        : GENERATION_PROVIDERS.koboldcpp,
    providerKind: profile.providerKind,
    endpoint: profile.endpoint,
    apiKey: options.apiKey,
    model: profile.modelId,
    openRouterProvider: profile.allowedProviderSlug || undefined,
    maxTokens: profile.maximumOutputTokens,
    temperature: profile.temperature,
    topP: profile.topP,
    frequencyPenalty: 0,
    presencePenalty: 0,
    topK: 0,
    minP: 0,
    characterId: `agent-eval-${evalCase.id}`,
    card,
    focus,
    messages,
    contextAttachments: createContextAttachments(evalCase),
    templates,
    agentQualityProfile: profile.qualityProfile,
    localCapabilities: profile.localCapabilities,
    fieldShouldAllowAssistantEditing: DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING,
  });
}

async function createEvalStream(
  options: iAgentEvalRuntimeOptions,
  dependencies: iAgentEvalRuntimeDependencies,
  store: iCharacterAssistantProposalStore,
  card: CharacterCard,
  focus: CharacterAssistantFocus,
  messages: Array<ModelMessage | UIMessage>,
  templates: iChatTemplateRef[],
) {
  const payload = createPayload(options, card, focus, messages, templates);
  if (options.profile.pipeline === AGENT_EVAL_PIPELINES.orchestrated) {
    return dependencies.streamOrchestrated({
      payload,
      messages,
      store,
      abortSignal: options.abortSignal,
      roleAssignments: options.profile.roleAssignments,
    });
  }
  await dependencies.verifySingleAgentPolicy(options);
  const commonOptions = {
    card,
    focus,
    contextAttachments: payload.contextAttachments,
    apiKey: options.apiKey,
    generationSettings: payload,
    templates,
    fieldShouldAllowAssistantEditing: payload.fieldShouldAllowAssistantEditing,
    shouldUseNativeTools: profileSupportsNativeTools(options.profile),
    store,
    messages,
    abortSignal: options.abortSignal,
  };
  const routeKey = createNativeToolRouteKey(
    options.profile.endpoint,
    options.profile.modelId,
    options.profile.allowedProviderSlug,
  );
  if (!profileSupportsNativeTools(options.profile) || isNativeToolRouteUnsupported(routeKey)) {
    return dependencies.streamSingleAgentStructured(commonOptions);
  }
  return fallbackFromUnsupportedNativeTools(
    dependencies.streamSingleAgentNative({ ...commonOptions, maxSteps: 8 }),
    () => {
      markNativeToolRouteUnsupported(routeKey);
      return dependencies.streamSingleAgentStructured(commonOptions);
    },
  );
}

function profileSupportsNativeTools(profile: iAgentEvalExecutionProfile) {
  return profile.localCapabilities.includes(MODEL_CAPABILITIES['tool-calling']);
}

export function createAgentEvalRuntime(dependencies: iAgentEvalRuntimeDependencies = DEFAULT_DEPENDENCIES) {
  return {
    async runCase(options: iAgentEvalRuntimeOptions): Promise<iAgentEvalRunResult> {
      const profile = AGENT_EVAL_EXECUTION_PROFILE_SCHEMA.parse(options.profile);
      const parsedOptions = { ...options, profile };
      const card = createEvalCard(options.evalCase);
      const focus = createEvalFocus(options.evalCase.requestedFieldKeys);
      const messages = createEvalMessages(options.evalCase);
      const templates = createEvalTemplates(options.evalCase);
      const { store, proposals } = createEvalStore(card);

      try {
        const stream = await createEvalStream(parsedOptions, dependencies, store, card, focus, messages, templates);
        const result = await collectEvalStream(stream);
        return AGENT_EVAL_RUN_ARTIFACT_SCHEMA.omit({
          artifactVersion: true,
          caseId: true,
          route: true,
          pipelineRevision: true,
          startedAt: true,
          latencyMs: true,
        }).parse({
          profileId: profile.id,
          modelId: profile.modelId,
          providerId: profile.allowedProviderSlug || profile.providerKind,
          seed: profile.seed,
          usage: {
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            costUsd: result.actualCostUsd ?? calculateCost(profile, result.inputTokens, result.outputTokens),
          },
          assistantText: result.assistantText,
          proposedFields: readProposedFields(proposals),
          toolOutcomes: result.toolOutcomes,
          fieldScores: [],
          isPolicyEligible: true,
          errorCategory: null,
        });
      } catch (error) {
        return {
          profileId: profile.id,
          modelId: profile.modelId,
          providerId: profile.allowedProviderSlug || profile.providerKind,
          seed: profile.seed,
          usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
          assistantText: '',
          proposedFields: {},
          toolOutcomes: [],
          fieldScores: [],
          isPolicyEligible: !(error instanceof AgentRolePolicyError),
          errorCategory: getErrorCategory(error),
        };
      }
    },
  };
}
