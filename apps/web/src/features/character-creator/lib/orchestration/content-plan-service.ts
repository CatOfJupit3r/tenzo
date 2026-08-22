import { uniq } from 'lodash-es';

import type { CharacterTextFieldKey } from '../cards/card-schema';
import { CHARACTER_CONTENT_PLAN_SCHEMA, PROSE_JOB_SCHEMA } from './agent-orchestration-contracts';
import type { iCharacterBrief, iCharacterContentPlan, iProseJob } from './agent-orchestration-contracts';
import { FIELD_WRITING_STRATEGIES } from './field-writing-strategy';
import type { FieldWritingStrategy } from './field-writing-strategy';

export interface iContentPlanInput {
  brief: iCharacterBrief;
  requestedFieldKeys: readonly CharacterTextFieldKey[];
  currentFields: Partial<Record<CharacterTextFieldKey, string>>;
  strictTemplates: Partial<Record<CharacterTextFieldKey, string>>;
  requiredMacros: Partial<Record<CharacterTextFieldKey, readonly string[]>>;
  fieldWritingStrategy: FieldWritingStrategy;
}

export interface iContentPlanServiceDependencies {
  planContent: (input: iContentPlanInput, abortSignal?: AbortSignal) => Promise<unknown>;
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

  return PROSE_JOB_SCHEMA.parse({
    id: `prose-${fieldKeys.join('-')}`,
    fieldKeys,
    purposes: entries.map((entry) => entry.purpose),
    ownedFacts: facts.filter((fact) => ownedFactIds.has(fact.id)),
    allowedEchoes: facts.filter((fact) => echoFactIds.has(fact.id)),
    forbiddenRestatements: uniq(entries.flatMap((entry) => entry.forbiddenRestatements)),
    relevantContext: uniq(entries.flatMap((entry) => entry.relevantContext)),
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
      const plan = CHARACTER_CONTENT_PLAN_SCHEMA.parse(await dependencies.planContent(input, abortSignal));
      assertContentPlan(plan, input);
      return { plan, jobs: createProseJobs(plan, input) };
    },
  };
}
