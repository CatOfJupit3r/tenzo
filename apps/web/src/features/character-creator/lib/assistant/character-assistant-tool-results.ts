import { z } from 'zod';

import { CHARACTER_EDIT_PROPOSAL_SCHEMA } from '../proposals/character-edit-proposal';

export const PROPOSAL_TOOL_RESULT_SCHEMA = z.object({
  proposal: CHARACTER_EDIT_PROPOSAL_SCHEMA.nullable(),
  isNoOp: z.boolean(),
  message: z.string().optional(),
});
