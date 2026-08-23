import { chatParamsFromRequestBody } from '@tanstack/ai';
import { createFileRoute } from '@tanstack/react-router';
import { ZodError } from 'zod';

import { CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA } from '@~/features/character-creator/lib/assistant/character-assistant-contracts';
import { generateCharacterDiscoveryDirections } from '@~/features/character-creator/lib/assistant/discovery-directions.server';
import {
  suppressGenerationAbort,
  toAbortSafeServerSentEventsResponse,
} from '@~/features/character-creator/lib/generation/abort-safe-stream';
import type { CharacterAssistantFieldEditing } from '@~/features/character-creator/lib/generation/generation-config';
import {
  describeGenerationError,
  logGenerationError,
} from '@~/features/character-creator/lib/generation/generation-error';
import { streamOrchestratedCharacterAssistant } from '@~/features/character-creator/lib/orchestration/orchestrated-character-assistant.server';
import {
  createCharacterEditProposal,
  preserveAssistantProtectedFields,
} from '@~/features/character-creator/lib/proposals/character-edit-proposal';
import type { iCharacterEditProposal } from '@~/features/character-creator/lib/proposals/character-edit-proposal';

function createRunStore(
  characterId: string,
  initialCard: (typeof CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA)['shape']['card']['_output'],
  suggestDirections: (premise?: string) => ReturnType<typeof generateCharacterDiscoveryDirections>,
  fieldShouldAllowAssistantEditing: Readonly<CharacterAssistantFieldEditing>,
) {
  let projectedCard = structuredClone(initialCard);
  const proposals: iCharacterEditProposal[] = [];

  return {
    getCard: () => projectedCard,
    appendProposedCard({
      toolCallId,
      summary,
      proposedCard,
    }: {
      toolCallId: string;
      summary: string;
      proposedCard: typeof initialCard;
    }) {
      const permittedCard = preserveAssistantProtectedFields(
        projectedCard,
        proposedCard,
        fieldShouldAllowAssistantEditing,
      );
      const proposal = createCharacterEditProposal({
        characterId,
        baseCard: projectedCard,
        proposedCard: permittedCard,
        toolCallId,
        summary,
      });
      projectedCard = structuredClone(permittedCard);
      proposals.push(proposal);
      return proposal;
    },
    getProposals: () => proposals,
    suggestDirections,
  };
}

export const Route = createFileRoute('/api/character-assistant')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const chatParams = await chatParamsFromRequestBody(await request.json());
          const payload = CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA.parse({
            ...chatParams.forwardedProps,
            messages: chatParams.messages,
          });
          const store = createRunStore(
            payload.characterId,
            payload.card,
            async (premise) =>
              generateCharacterDiscoveryDirections({
                premise,
                endpoint: payload.endpoint,
                apiKey: payload.apiKey,
                model: payload.model,
                generationSettings: payload,
                abortSignal: request.signal,
              }),
            payload.fieldShouldAllowAssistantEditing,
          );
          const stream = streamOrchestratedCharacterAssistant({
            payload,
            messages: chatParams.messages,
            store,
            abortSignal: request.signal,
          });

          const abortController = new AbortController();
          request.signal.addEventListener('abort', () => abortController.abort(request.signal.reason), { once: true });
          return toAbortSafeServerSentEventsResponse(suppressGenerationAbort(stream, request.signal), abortController, {
            operation: 'Character Assistant request',
            model: payload.model,
          });
        } catch (error) {
          if (!(error instanceof ZodError)) {
            logGenerationError('Character Assistant request setup', error);
          }
          return new Response(describeGenerationError(error, 'Character assistant failed.'), {
            status: error instanceof ZodError ? 400 : 500,
            headers: { 'Cache-Control': 'no-store' },
          });
        }
      },
    },
  },
});
