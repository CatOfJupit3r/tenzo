import { em } from 'enumwaii';
import { z } from 'zod';

import type { CharacterCard } from '../cards/card-schema';
import type { OutputFormat } from '../generation/generation-config';
import type { iExampleContextSummary } from './example-context-service';
import type { GenerationMode, iFieldGenerationTarget, iPromptFieldTemplate } from './generation-contracts';

export const PROMPT_SECTION_NAME_ENUM = em(['CARD_CONTEXT', 'EXAMPLE_CONTEXT', 'TEMPLATE', 'TASK']);
export const PROMPT_SECTION_NAMES = PROMPT_SECTION_NAME_ENUM.enum;
export const PROMPT_SECTION_NAME_SCHEMA = z.enum(PROMPT_SECTION_NAMES);

export type PromptSectionName = z.infer<typeof PROMPT_SECTION_NAME_SCHEMA>;

export interface iPromptPipelineContext {
  card: CharacterCard;
  target: iFieldGenerationTarget;
  outputFormat: OutputFormat;
  mode: GenerationMode;
  seed: number;
  globalCharacterInstruction: string;
  generalCharacterIdea: string;
  shouldUseGeneralCharacterIdea: boolean;
  userInstructions: string;
  fieldTemplate: iPromptFieldTemplate | null;
  maxExampleContextCharacters: number;
  exampleContextSummary: iExampleContextSummary;
  variationSection: string;
  isContinuation: boolean;
}

export interface iPromptSectionStrategy {
  readonly name: PromptSectionName;
  build: (context: iPromptPipelineContext) => string;
}
