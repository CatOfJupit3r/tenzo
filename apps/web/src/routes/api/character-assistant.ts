import { chatParamsFromRequestBody } from '@tanstack/ai';
import { createFileRoute } from '@tanstack/react-router';
import { ZodError } from 'zod';

import { CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA } from '@~/features/character-creator/lib/assistant/character-assistant-contracts';
import { CHARACTER_ASSISTANT_GENERATION_MODES } from '@~/features/character-creator/lib/assistant/character-assistant-generation-mode';
import { streamCharacterAssistant } from '@~/features/character-creator/lib/assistant/character-assistant-runtime.server';
import { generateStructuredCharacterAssistantStream } from '@~/features/character-creator/lib/assistant/character-assistant-structured.server';
import { generateCharacterDiscoveryDirections } from '@~/features/character-creator/lib/assistant/discovery-directions.server';
import {
  suppressGenerationAbort,
  toAbortSafeServerSentEventsResponse,
} from '@~/features/character-creator/lib/generation/abort-safe-stream';
import { createCharacterEditProposal } from '@~/features/character-creator/lib/proposals/character-edit-proposal';
import type { iCharacterEditProposal } from '@~/features/character-creator/lib/proposals/character-edit-proposal';

function createRunStore(
  characterId: string,
  initialCard: (typeof CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA)['shape']['card']['_output'],
  suggestDirections: (premise?: string) => ReturnType<typeof generateCharacterDiscoveryDirections>,
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
      const proposal = createCharacterEditProposal({
        characterId,
        baseCard: projectedCard,
        proposedCard,
        toolCallId,
        summary,
      });
      projectedCard = structuredClone(proposedCard);
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
          const store = createRunStore(payload.characterId, payload.card, async (premise) =>
            generateCharacterDiscoveryDirections({
              premise,
              endpoint: payload.endpoint,
              apiKey: payload.apiKey,
              model: payload.model,
              generationSettings: payload,
              abortSignal: request.signal,
            }),
          );
          const commonOptions = {
            card: payload.card,
            focus: payload.focus,
            contextAttachments: payload.contextAttachments,
            apiKey: payload.apiKey,
            generationSettings: payload,
            shouldSendDisabledSamplers: payload.shouldSendDisabledSamplers,
            generalCharacterIdea: payload.generalCharacterIdea,
            discoveryContext: payload.discoveryContext,
            templates: payload.templates,
            store,
            messages: chatParams.messages,
            abortSignal: request.signal,
          };
          const stream =
            payload.assistantGenerationMode === CHARACTER_ASSISTANT_GENERATION_MODES['structured-output']
              ? generateStructuredCharacterAssistantStream(commonOptions)
              : streamCharacterAssistant({ ...commonOptions, maxSteps: 8 });

          const abortController = new AbortController();
          request.signal.addEventListener('abort', () => abortController.abort(request.signal.reason), { once: true });
          return toAbortSafeServerSentEventsResponse(suppressGenerationAbort(stream, request.signal), abortController);
        } catch (error) {
          return new Response(error instanceof Error ? error.message : 'Character assistant failed.', {
            status: error instanceof ZodError ? 400 : 500,
            headers: { 'Cache-Control': 'no-store' },
          });
        }
      },
    },
  },
});
