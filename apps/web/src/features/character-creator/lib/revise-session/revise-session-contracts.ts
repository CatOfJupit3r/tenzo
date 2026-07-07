import { z } from 'zod';

import { CHARACTER_CARD_SCHEMA, CHARACTER_TEXT_FIELD_KEY_SCHEMA } from '../card-schema';
import { CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA } from '../generation-stream-contracts';

export const REVISE_SESSION_REQUEST_SCHEMA = CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA.extend({
  messages: z.array(z.unknown()),
  card: CHARACTER_CARD_SCHEMA,
  targetFieldKey: CHARACTER_TEXT_FIELD_KEY_SCHEMA,
  generalCharacterIdea: z.string().optional(),
  fieldInstruction: z.string().optional(),
});

export type iReviseSessionRequest = z.infer<typeof REVISE_SESSION_REQUEST_SCHEMA>;
