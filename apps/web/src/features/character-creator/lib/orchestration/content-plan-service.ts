import { uniq } from 'lodash-es';

import type { CharacterTextFieldKey } from '../cards/card-schema';
import { AGENT_EVAL_FIELD_RUBRICS } from '../evaluation/agent-eval-rubric';
import {
  CHARACTER_CONTENT_PLAN_DRAFT_SCHEMA,
  CHARACTER_CONTENT_PLAN_SCHEMA,
  PROSE_JOB_SCHEMA,
} from './agent-orchestration-contracts';
import type { iCharacterBrief, iCharacterContentPlan, iProseJob } from './agent-orchestration-contracts';
import { FIELD_WRITING_STRATEGIES } from './field-writing-strategy';
import type { FieldWritingStrategy } from './field-writing-strategy';

export interface iContentPlanInput {
  brief: iCharacterBrief;
  requestedFieldKeys: readonly CharacterTextFieldKey[];
  currentFields: Partial<Record<CharacterTextFieldKey, string>>;
  strictTemplates: Partial<Record<CharacterTextFieldKey, string>>;
  promptTemplates?: Partial<Record<CharacterTextFieldKey, string>>;
  requiredMacros: Partial<Record<CharacterTextFieldKey, readonly string[]>>;
  fieldWritingStrategy: FieldWritingStrategy;
}

export interface iContentPlanServiceDependencies {
  planContent: (input: iContentPlanInput, abortSignal?: AbortSignal) => Promise<unknown>;
}

const USER_PROMPT_FACT_ID = 'user-prompt';

const DEFAULT_CONTENT_DEPTH = {
  name: { minimumInformationUnits: 1, maximumOutputTokens: 80 },
  description: { minimumInformationUnits: 8, maximumOutputTokens: 1_200 },
  personality: { minimumInformationUnits: 6, maximumOutputTokens: 900 },
  scenario: { minimumInformationUnits: 6, maximumOutputTokens: 900 },
  first_mes: { minimumInformationUnits: 8, maximumOutputTokens: 1_200 },
  mes_example: { minimumInformationUnits: 6, maximumOutputTokens: 1_000 },
  creator_notes: { minimumInformationUnits: 3, maximumOutputTokens: 500 },
  system_prompt: { minimumInformationUnits: 4, maximumOutputTokens: 700 },
  post_history_instructions: { minimumInformationUnits: 3, maximumOutputTokens: 500 },
  creator: { minimumInformationUnits: 1, maximumOutputTokens: 80 },
  character_version: { minimumInformationUnits: 1, maximumOutputTokens: 80 },
} satisfies Record<CharacterTextFieldKey, { minimumInformationUnits: number; maximumOutputTokens: number }>;

function normalizeContentPlan(rawPlan: unknown, input: iContentPlanInput): iCharacterContentPlan {
  const draftPlan = CHARACTER_CONTENT_PLAN_DRAFT_SCHEMA.parse(rawPlan);
  const plan = CHARACTER_CONTENT_PLAN_SCHEMA.parse({
    ...draftPlan,
    entries: draftPlan.entries.map((entry) => ({
      ...entry,
      purpose: AGENT_EVAL_FIELD_RUBRICS[entry.fieldKey].purpose,
      requiredMacros: input.requiredMacros[entry.fieldKey] ?? [],
      strictTemplate: input.strictTemplates[entry.fieldKey] ?? null,
      depth: DEFAULT_CONTENT_DEPTH[entry.fieldKey],
      dependsOnFieldKeys: [],
    })),
  });
  const hasUserPromptFact = [...input.brief.confirmedFacts, ...input.brief.assumptions].some(
    (fact) => fact.id === USER_PROMPT_FACT_ID,
  );
  const knownFactIds = new Set([...input.brief.confirmedFacts, ...input.brief.assumptions].map((fact) => fact.id));
  const existingOwnerIndex = plan.entries.findIndex((entry) => entry.ownedFactIds.includes(USER_PROMPT_FACT_ID));
  let ownerIndex = -1;
  if (hasUserPromptFact) ownerIndex = existingOwnerIndex === -1 ? 0 : existingOwnerIndex;

  return {
    ...plan,
    entries: plan.entries.map((entry, index) => ({
      ...entry,
      ownedFactIds: hasUserPromptFact
        ? uniq([
            ...entry.ownedFactIds.filter((factId) => factId !== USER_PROMPT_FACT_ID && knownFactIds.has(factId)),
            ...(index === ownerIndex ? [USER_PROMPT_FACT_ID] : []),
          ])
        : entry.ownedFactIds.filter((factId) => knownFactIds.has(factId)),
      allowedEchoFactIds: hasUserPromptFact
        ? uniq([
            ...entry.allowedEchoFactIds.filter((factId) => factId !== USER_PROMPT_FACT_ID && knownFactIds.has(factId)),
            ...(index === ownerIndex ? [] : [USER_PROMPT_FACT_ID]),
          ])
        : entry.allowedEchoFactIds.filter((factId) => knownFactIds.has(factId)),
      requiredMacros: [...(input.requiredMacros[entry.fieldKey] ?? [])],
      strictTemplate: input.strictTemplates[entry.fieldKey] ?? null,
    })),
  };
}

function assertContentPlan(plan: iCharacterContentPlan, input: iContentPlanInput) {
  const requestedFields = new Set(input.requestedFieldKeys);
  const plannedFieldKeys = plan.entries.map((entry) => entry.fieldKey);
  if (
    plannedFieldKeys.length !== requestedFields.size ||
    plannedFieldKeys.some((fieldKey) => !requestedFields.has(fieldKey)) ||
    new Set(plannedFieldKeys).size !== plannedFieldKeys.length
  ) {
    throw new Error('Content plan must contain each requested field exactly once.');
  }

  const factIds = new Set([...input.brief.confirmedFacts, ...input.brief.assumptions].map((fact) => fact.id));
  const ownedFactIds = plan.entries.flatMap((entry) => entry.ownedFactIds);
  for (const factId of factIds) {
    if (ownedFactIds.filter((ownedFactId) => ownedFactId === factId).length !== 1) {
      throw new Error(`Content plan must assign fact ${factId} to exactly one primary field.`);
    }
  }
  if (ownedFactIds.some((factId) => !factIds.has(factId))) {
    throw new Error('Content plan references an unknown owned fact.');
  }

  for (const entry of plan.entries) {
    if (entry.dependsOnFieldKeys.some((fieldKey) => !requestedFields.has(fieldKey))) {
      throw new Error(`Content plan dependency for ${entry.fieldKey} is outside the requested focus.`);
    }
    const strictTemplate = input.strictTemplates[entry.fieldKey];
    if (strictTemplate !== undefined && entry.strictTemplate !== strictTemplate) {
      throw new Error(`Content plan changed the strict template for ${entry.fieldKey}.`);
    }
    const requiredMacros = input.requiredMacros[entry.fieldKey] ?? [];
    if (requiredMacros.some((macro) => !entry.requiredMacros.includes(macro))) {
      throw new Error(`Content plan omitted a required macro for ${entry.fieldKey}.`);
    }
  }
}

function createJob(
  fieldKeys: readonly CharacterTextFieldKey[],
  plan: iCharacterContentPlan,
  input: iContentPlanInput,
): iProseJob {
  const entries = fieldKeys.map((fieldKey) => {
    const entry = plan.entries.find((candidate) => candidate.fieldKey === fieldKey);
    if (!entry) throw new Error(`Missing plan entry for ${fieldKey}.`);
    return entry;
  });
  const facts = [...input.brief.confirmedFacts, ...input.brief.assumptions];
  const ownedFactIds = new Set(entries.flatMap((entry) => entry.ownedFactIds));
  const echoFactIds = new Set(entries.flatMap((entry) => entry.allowedEchoFactIds));
  const sharedBriefContext = [
    ...input.brief.creativeChoices
      .filter((choice) => choice.isSelected)
      .map((choice) => `Canonical creative choice: ${choice.description}`),
    ...input.brief.requiredMotifs.map((motif) => `Required motif: ${motif}`),
    ...input.brief.avoidedMotifs.map((motif) => `Avoided motif: ${motif}`),
    ...input.brief.boundaries.map((boundary) => `Boundary: ${boundary}`),
    ...input.brief.toneAndStyle.map((tone) => `Tone and style: ${tone}`),
  ];
  const fieldRequirements = entries.flatMap((entry) => {
    const rubric = AGENT_EVAL_FIELD_RUBRICS[entry.fieldKey];
    const promptTemplate = input.promptTemplates?.[entry.fieldKey];
    return [
      `Field requirement: ${rubric.purpose}`,
      `Useful content: ${rubric.usefulInformationExamples.join('; ')}`,
      ...(promptTemplate ? [`Field template guidance:\n${promptTemplate}`] : []),
    ];
  });

  return PROSE_JOB_SCHEMA.parse({
    id: `prose-${fieldKeys.join('-')}`,
    fieldKeys,
    purposes: entries.map((entry) => entry.purpose),
    ownedFacts: facts.filter((fact) => ownedFactIds.has(fact.id)),
    allowedEchoes: facts.filter((fact) => echoFactIds.has(fact.id)),
    forbiddenRestatements: uniq(entries.flatMap((entry) => entry.forbiddenRestatements)),
    relevantContext: uniq([
      ...sharedBriefContext,
      ...fieldRequirements,
      ...entries.flatMap((entry) => entry.relevantContext),
    ]),
    styleBible: plan.styleBible,
    requiredMacros: uniq(entries.flatMap((entry) => entry.requiredMacros)),
    strictTemplates: Object.fromEntries(
      entries.flatMap((entry) => (entry.strictTemplate ? [[entry.fieldKey, entry.strictTemplate]] : [])),
    ),
    maximumOutputTokens: entries.reduce((total, entry) => total + entry.depth.maximumOutputTokens, 0),
    dependsOnJobIds: uniq(
      entries.flatMap((entry) =>
        entry.dependsOnFieldKeys
          .filter((dependency) => !fieldKeys.includes(dependency))
          .map((dependency) => `prose-${dependency}`),
      ),
    ),
  });
}

export function createProseJobs(plan: iCharacterContentPlan, input: iContentPlanInput): iProseJob[] {
  if (input.fieldWritingStrategy === FIELD_WRITING_STRATEGIES['combined-fields']) {
    return [createJob(input.requestedFieldKeys, plan, input)];
  }
  const groups = plan.entries.map((entry) => [entry.fieldKey]);
  return groups.map((fieldKeys) => createJob(fieldKeys, plan, input));
}

export function createContentPlanService(dependencies: iContentPlanServiceDependencies) {
  return {
    async createPlan(input: iContentPlanInput, abortSignal?: AbortSignal) {
      const plan = normalizeContentPlan(await dependencies.planContent(input, abortSignal), input);
      assertContentPlan(plan, input);
      return { plan, jobs: createProseJobs(plan, input) };
    },
  };
}
