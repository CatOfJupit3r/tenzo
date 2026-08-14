import { z } from 'zod';

export const ASSISTANT_FINAL_RESPONSE_SCHEMA = z.object({
  assistantMessage: z.string().trim().min(1),
  followUpSuggestions: z.array(z.string().trim().min(1)).max(3),
});

export type iAssistantFinalResponse = z.infer<typeof ASSISTANT_FINAL_RESPONSE_SCHEMA>;
