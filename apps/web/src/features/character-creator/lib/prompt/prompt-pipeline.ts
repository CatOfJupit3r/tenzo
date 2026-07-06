import { z } from 'zod';

import {
  DEFAULT_CHARACTER_CARD_WRITING_GUIDE,
  DEFAULT_POST_HISTORY_INSTRUCTIONS,
  getContinuationFormatInstructions,
  getFormatInstructions,
} from '../../constants/default-prompts';
import type { CharacterCard } from '../card-schema';
import type { OutputFormat } from '../generation-config';
import { getPrefilled } from '../response-parser';
import { buildCardContextSection } from './card-context-service';
import { buildExampleContextSummary, MAX_EXAMPLE_CONTEXT_CHARACTERS } from './example-context-service';
import type { iExampleContextSummary } from './example-context-service';
import { GENERATION_MODES } from './generation-contracts';
import type {
  GenerationMode,
  iFieldGenerationTarget,
  iGenerationMessage,
  iPromptExampleCharacter,
} from './generation-contracts';
import { createSeededRandom } from './seeded-random';
import { getFieldFormatGuidance, getTaskInstruction } from './task-instruction-service';
import { buildVariationSection } from './variation-service';

export const PROMPT_SECTION_NAME_SCHEMA = z.enum(['card-context', 'example-context', 'task']);
export const PROMPT_SECTION_NAMES = PROMPT_SECTION_NAME_SCHEMA.enum;
export type PromptSectionName = z.infer<typeof PROMPT_SECTION_NAME_SCHEMA>;

export interface iPromptPipelineInput {
  card: CharacterCard;
  target: iFieldGenerationTarget;
  outputFormat: OutputFormat;
  /** Drives every random choice in the pipeline; the same seed reproduces the same prompt. */
  seed: number;
  mode?: GenerationMode;
  generalCharacterIdea?: string;
  shouldUseGeneralCharacterIdea?: boolean;
  userInstructions?: string;
  exampleCharacters?: iPromptExampleCharacter[];
  maxExampleContextCharacters?: number;
}

export interface iPromptPipelineContext {
  card: CharacterCard;
  target: iFieldGenerationTarget;
  outputFormat: OutputFormat;
  mode: GenerationMode;
  seed: number;
  generalCharacterIdea: string;
  shouldUseGeneralCharacterIdea: boolean;
  userInstructions: string;
  maxExampleContextCharacters: number;
  exampleContextSummary: iExampleContextSummary;
  variationSection: string;
  isContinuation: boolean;
}

export interface iPromptSectionStrategy {
  name: PromptSectionName;
  build: (context: iPromptPipelineContext) => string;
}

export interface iPromptPipelineResult {
  messages: iGenerationMessage[];
  seed: number;
  exampleContextSummary: iExampleContextSummary;
  variationSection: string;
}

export const cardContextSectionStrategy: iPromptSectionStrategy = {
  name: PROMPT_SECTION_NAMES['card-context'],
  build: (context) => buildCardContextSection(context.card, context.target),
};

export const exampleContextSectionStrategy: iPromptSectionStrategy = {
  name: PROMPT_SECTION_NAMES['example-context'],
  build: (context) => context.exampleContextSummary.section,
};

export const taskSectionStrategy: iPromptSectionStrategy = {
  name: PROMPT_SECTION_NAMES.task,
  build: (context) => {
    const { target, mode, outputFormat, exampleContextSummary, isContinuation } = context;

    return [
      `Your task is to write the "${target.label}" field for a SillyTavern V2 character card.`,
      getTaskInstruction(target, mode),
      'Keep the result consistent with the rest of the card.',
      getFieldFormatGuidance(target),
      exampleContextSummary.isTruncated
        ? `Reference example content was truncated to stay within the ${context.maxExampleContextCharacters}-character context budget. Use only the included reference details.`
        : '',
      context.shouldUseGeneralCharacterIdea && context.generalCharacterIdea.trim()
        ? `General character idea: ${context.generalCharacterIdea.trim()}`
        : '',
      context.userInstructions.trim() ? `Field-specific instructions: ${context.userInstructions.trim()}` : '',
      context.variationSection,
      isContinuation ? getContinuationFormatInstructions(outputFormat) : getFormatInstructions(outputFormat),
    ]
      .filter(Boolean)
      .join('\n');
  },
};

export const DEFAULT_PROMPT_SECTION_STRATEGIES: readonly iPromptSectionStrategy[] = [
  cardContextSectionStrategy,
  exampleContextSectionStrategy,
  taskSectionStrategy,
];

function resolveOverride(overrideValue: string, fallbackValue: string) {
  const trimmedOverride = overrideValue.trim();
  if (!trimmedOverride) {
    return fallbackValue;
  }

  if (trimmedOverride.includes('{{original}}')) {
    return trimmedOverride.replaceAll('{{original}}', fallbackValue);
  }

  return trimmedOverride;
}

export class CharacterPromptPipeline {
  constructor(
    private readonly sectionStrategies: readonly iPromptSectionStrategy[] = DEFAULT_PROMPT_SECTION_STRATEGIES,
  ) {}

  build(input: iPromptPipelineInput): iPromptPipelineResult {
    const context = this.createContext(input);
    const sections = this.sectionStrategies.map((strategy) => strategy.build(context)).filter(Boolean);

    const systemPrompt = resolveOverride(input.card.data.system_prompt, DEFAULT_CHARACTER_CARD_WRITING_GUIDE);
    const postHistoryInstructions = resolveOverride(
      input.card.data.post_history_instructions,
      DEFAULT_POST_HISTORY_INSTRUCTIONS,
    );

    const messages: iGenerationMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: sections.join('\n\n') },
    ];

    if (postHistoryInstructions) {
      messages.push({ role: 'system', content: postHistoryInstructions });
    }

    if (context.isContinuation) {
      messages.push({ role: 'assistant', content: getPrefilled(context.target.value, context.outputFormat) });
    }

    return {
      messages,
      seed: context.seed,
      exampleContextSummary: context.exampleContextSummary,
      variationSection: context.variationSection,
    };
  }

  private createContext({
    card,
    target,
    outputFormat,
    seed,
    mode = GENERATION_MODES.generate,
    generalCharacterIdea = '',
    shouldUseGeneralCharacterIdea = true,
    userInstructions = '',
    exampleCharacters = [],
    maxExampleContextCharacters = MAX_EXAMPLE_CONTEXT_CHARACTERS,
  }: iPromptPipelineInput): iPromptPipelineContext {
    // A single seeded source consumed in a fixed order keeps the whole prompt
    // reproducible for a given seed.
    const random = createSeededRandom(seed);
    const exampleContextSummary = buildExampleContextSummary({
      exampleCharacters,
      maxCharacters: maxExampleContextCharacters,
      random,
    });
    const variationSection = buildVariationSection({ random, seed, target, mode });

    return {
      card,
      target,
      outputFormat,
      mode,
      seed,
      generalCharacterIdea,
      shouldUseGeneralCharacterIdea,
      userInstructions,
      maxExampleContextCharacters,
      exampleContextSummary,
      variationSection,
      isContinuation: mode === GENERATION_MODES.continue && Boolean(target.value.trim()),
    };
  }
}

export const characterPromptPipeline = new CharacterPromptPipeline();
