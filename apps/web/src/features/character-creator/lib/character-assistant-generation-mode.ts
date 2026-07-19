import { z } from 'zod';

export const CHARACTER_ASSISTANT_GENERATION_MODE_SCHEMA = z.enum(['structured-output', 'tool-call']);
export const CHARACTER_ASSISTANT_GENERATION_MODES = CHARACTER_ASSISTANT_GENERATION_MODE_SCHEMA.enum;
export type CharacterAssistantGenerationMode = z.infer<typeof CHARACTER_ASSISTANT_GENERATION_MODE_SCHEMA>;
