import { z } from 'zod';

import type { CharacterCard } from '../card-schema';
import type { OutputFormat } from '../generation-config';
import type { iExampleContextSummary } from './example-context-service';
import type { GenerationMode, iFieldGenerationTarget } from './generation-contracts';

export const PROMPT_SECTION_NAME_SCHEMA = z.enum(['card-context', 'example-context', 'task']);
export const PROMPT_SECTION_NAMES = PROMPT_SECTION_NAME_SCHEMA.enum;
export type PromptSectionName = z.infer<typeof PROMPT_SECTION_NAME_SCHEMA>;

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
  readonly name: PromptSectionName;
  build: (context: iPromptPipelineContext) => string;
}
