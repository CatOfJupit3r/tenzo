import type { UIMessage } from '@tanstack/ai-react';

import { MESSAGE_PART_TYPES_CASES } from '@~/features/character-creator/lib/generation/message-enums';

import { CHARACTER_CONCEPT_SCHEMA } from './character-assistant-contracts';

export function readNewRecordedCharacterConcept(
  messages: readonly UIMessage[],
  lastRecordedConceptToolCallId: string | null,
) {
  const recordedConcepts = messages.flatMap((message) =>
    message.parts.flatMap((part) => {
      if (part.type !== MESSAGE_PART_TYPES_CASES.TOOL_CALL || !part.output || typeof part.output !== 'object')
        return [];
      const result = CHARACTER_CONCEPT_SCHEMA.safeParse((part.output as { concept?: unknown }).concept);
      return result.success ? [{ concept: result.data, toolCallId: part.id }] : [];
    }),
  );
  const latestConcept = recordedConcepts.at(-1);
  return latestConcept?.toolCallId !== lastRecordedConceptToolCallId ? (latestConcept ?? null) : null;
}
