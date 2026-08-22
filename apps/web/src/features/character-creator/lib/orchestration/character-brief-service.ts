import type { CharacterCard, CharacterTextFieldKey } from '../cards/card-schema';
import { AGENT_EVAL_FIELD_RUBRICS } from '../evaluation/agent-eval-rubric';
import { AGENT_FACT_PROVENANCES, AGENT_GAP_IMPACTS, CHARACTER_BRIEF_SCHEMA } from './agent-orchestration-contracts';
import type { iCharacterBrief } from './agent-orchestration-contracts';

export interface iCharacterBriefInput {
  prompt: string;
  card: CharacterCard;
  requestedFieldKeys: readonly CharacterTextFieldKey[];
  referenceSummaries: readonly string[];
  toneAndStyle: readonly string[];
  boundaries: readonly string[];
}

export interface iCharacterBriefServiceDependencies {
  enrichBrief: (input: iCharacterBriefInput, abortSignal?: AbortSignal) => Promise<unknown>;
}

export interface iCharacterBriefResult {
  brief: iCharacterBrief;
  isEnrichmentCallUsed: boolean;
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function isCharacterBriefSufficient(input: iCharacterBriefInput): boolean {
  const filledRequestedFieldCount = input.requestedFieldKeys.filter((fieldKey) =>
    input.card.data[fieldKey].trim(),
  ).length;
  const promptWordCount = countWords(input.prompt);
  return promptWordCount >= 24 || (promptWordCount >= 10 && filledRequestedFieldCount > 0);
}

export function createCharacterBriefFromSufficientInput(input: iCharacterBriefInput): iCharacterBrief {
  const confirmedFacts = [
    {
      id: 'user-prompt',
      statement: input.prompt.trim(),
      provenance: AGENT_FACT_PROVENANCES.user,
      sourceId: null,
      impact: AGENT_GAP_IMPACTS.high,
      isReversibleDefault: false,
    },
    ...input.requestedFieldKeys.flatMap((fieldKey) => {
      const value = input.card.data[fieldKey].trim();
      return value
        ? [
            {
              id: `card-${fieldKey}`,
              statement: value.slice(0, 600),
              provenance: AGENT_FACT_PROVENANCES.card,
              sourceId: fieldKey,
              impact: AGENT_GAP_IMPACTS.high,
              isReversibleDefault: false,
            },
          ]
        : [];
    }),
    ...input.referenceSummaries.map((summary, index) => ({
      id: `reference-${index + 1}`,
      statement: summary.slice(0, 600),
      provenance: AGENT_FACT_PROVENANCES['reference-inspiration'],
      sourceId: `reference-${index + 1}`,
      impact: AGENT_GAP_IMPACTS.low,
      isReversibleDefault: true,
    })),
  ];

  return CHARACTER_BRIEF_SCHEMA.parse({
    confirmedFacts,
    assumptions: [],
    creativeChoices: [],
    unresolvedQuestions: [],
    toneAndStyle: input.toneAndStyle,
    boundaries: input.boundaries,
    requiredMotifs: [],
    avoidedMotifs: [],
    fieldCoverage: input.requestedFieldKeys.map((fieldKey) => ({
      fieldKey,
      goals: [AGENT_EVAL_FIELD_RUBRICS[fieldKey].purpose],
    })),
  });
}

function assertBriefScope(brief: iCharacterBrief, requestedFieldKeys: readonly CharacterTextFieldKey[]) {
  const requestedFields = new Set(requestedFieldKeys);
  const unexpectedCoverage = brief.fieldCoverage.find(({ fieldKey }) => !requestedFields.has(fieldKey));
  if (unexpectedCoverage) {
    throw new Error(`Brief enrichment expanded outside the requested focus: ${unexpectedCoverage.fieldKey}.`);
  }

  const highImpactAssumption = brief.assumptions.find((fact) => fact.impact === AGENT_GAP_IMPACTS.high);
  if (highImpactAssumption) {
    throw new Error('High-impact model assumptions must be represented as unresolved questions.');
  }
}

export function createCharacterBriefService(dependencies: iCharacterBriefServiceDependencies) {
  return {
    async createBrief(input: iCharacterBriefInput, abortSignal?: AbortSignal): Promise<iCharacterBriefResult> {
      if (isCharacterBriefSufficient(input)) {
        return { brief: createCharacterBriefFromSufficientInput(input), isEnrichmentCallUsed: false };
      }

      const brief = CHARACTER_BRIEF_SCHEMA.parse(await dependencies.enrichBrief(input, abortSignal));
      assertBriefScope(brief, input.requestedFieldKeys);
      return { brief, isEnrichmentCallUsed: true };
    },
  };
}
