import { createFileRoute } from '@tanstack/react-router';
import { createUIMessageStreamResponse, toUIMessageStream } from 'ai';
import type { UIMessage } from 'ai';
import { ZodError } from 'zod';

import { streamCharacterText } from '@~/features/character-creator/lib/ai-sdk-text-generation';
import { REVISE_SESSION_REQUEST_SCHEMA } from '@~/features/character-creator/lib/revise-session/revise-session-contracts';
import { toGenerationConversationMessages } from '@~/features/character-creator/lib/revise-session/revise-session-message';
import {
  buildReviseSessionContextPrompt,
  buildReviseSessionSystemPrompt,
} from '@~/features/character-creator/lib/revise-session/revise-session-prompt';

export const Route = createFileRoute('/api/character-revise')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = REVISE_SESSION_REQUEST_SCHEMA.parse((await request.json()) as unknown);
          const originalMessages = payload.messages as UIMessage[];
          const conversationMessages = toGenerationConversationMessages(originalMessages);
          const result = streamCharacterText({
            ...payload,
            instructions: buildReviseSessionSystemPrompt({
              card: payload.card,
              fieldKey: payload.targetFieldKey,
            }),
            messages: [
              {
                role: 'user',
                content: buildReviseSessionContextPrompt({
                  card: payload.card,
                  fieldKey: payload.targetFieldKey,
                  generalCharacterIdea: payload.generalCharacterIdea,
                  fieldInstruction: payload.fieldInstruction,
                }),
              },
              ...conversationMessages,
            ],
            signal: request.signal,
          });

          return createUIMessageStreamResponse({
            headers: {
              'Cache-Control': 'no-store',
            },
            stream: toUIMessageStream({
              originalMessages,
              stream: result.stream,
              onError: (error) => (error instanceof Error ? error.message : 'Revise session failed.'),
            }),
          });
        } catch (error) {
          return new Response(error instanceof Error ? error.message : 'Revise session failed.', {
            status: error instanceof ZodError ? 400 : 500,
            headers: {
              'Cache-Control': 'no-store',
            },
          });
        }
      },
    },
  },
});
