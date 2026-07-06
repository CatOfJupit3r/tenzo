import {
  DEFAULT_CHARACTER_CARD_WRITING_GUIDE,
  DEFAULT_POST_HISTORY_INSTRUCTIONS,
} from '../../constants/default-prompts';
import type { CharacterCard } from '../card-schema';
import type { OutputFormat } from '../generation-config';
import { getPrefilled } from '../response-parser';
import { CardContextSectionStrategy } from './card-context-section-strategy';
import { CardContextService } from './card-context-service';
import { ExampleContextSectionStrategy } from './example-context-section-strategy';
import { ExampleContextService, MAX_EXAMPLE_CONTEXT_CHARACTERS } from './example-context-service';
import type { iExampleContextSummary } from './example-context-service';
import { GENERATION_MODES } from './generation-contracts';
import type {
  GenerationMode,
  iFieldGenerationTarget,
  iGenerationMessage,
  iPromptExampleCharacter,
} from './generation-contracts';
import type { iPromptPipelineContext, iPromptSectionStrategy } from './prompt-section-strategy';
import { SeededRandom } from './seeded-random';
import { TaskInstructionService } from './task-instruction-service';
import { TaskSectionStrategy } from './task-section-strategy';
import { VariationService } from './variation-service';

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

export interface iPromptPipelineResult {
  messages: iGenerationMessage[];
  seed: number;
  exampleContextSummary: iExampleContextSummary;
  variationSection: string;
}

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
    private readonly exampleContextService: ExampleContextService = new ExampleContextService(),
    private readonly variationService: VariationService = new VariationService(),
    private readonly sectionStrategies: readonly iPromptSectionStrategy[] = [
      new CardContextSectionStrategy(new CardContextService()),
      new ExampleContextSectionStrategy(),
      new TaskSectionStrategy(new TaskInstructionService()),
    ],
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
    const random = new SeededRandom(seed);
    const exampleContextSummary = this.exampleContextService.buildSummary({
      exampleCharacters,
      maxCharacters: maxExampleContextCharacters,
      random,
    });
    const variationSection = this.variationService.buildSection({ random, seed, target, mode });

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
