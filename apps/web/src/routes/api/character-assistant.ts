import { createFileRoute } from '@tanstack/react-router';
import { ZodError } from 'zod';

import type { CharacterCard } from '@~/features/character-creator/lib/card-schema';
import {
  CHARACTER_ASSISTANT_COMPLETE_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_ERROR_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_PROPOSAL_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_STREAM_EVENT_TYPES,
  CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA,
  CHARACTER_ASSISTANT_TEXT_DELTA_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_TOOL_CALL_ERROR_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_TOOL_CALL_START_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_TOOL_NAME_SCHEMA,
} from '@~/features/character-creator/lib/character-assistant-contracts';
import type {
  CharacterAssistantToolName,
  iCharacterAssistantStreamEvent,
} from '@~/features/character-creator/lib/character-assistant-contracts';
import { createCharacterAssistantMastra } from '@~/features/character-creator/lib/character-assistant-mastra.server';
import { createCharacterEditProposal } from '@~/features/character-creator/lib/character-edit-proposal';
import type { iCharacterEditProposal } from '@~/features/character-creator/lib/character-edit-proposal';

const MAX_CHARACTER_ASSISTANT_STEPS = 12;
const textEncoder = new TextEncoder();

function encodeServerEvent(event: iCharacterAssistantStreamEvent) {
  return textEncoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

function toMastraMessage(
  message: (typeof CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA)['shape']['messages']['element']['_output'],
) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: new Date(message.createdAt),
  };
}

function isCharacterAssistantToolName(toolName: string): toolName is CharacterAssistantToolName {
  return CHARACTER_ASSISTANT_TOOL_NAME_SCHEMA.safeParse(toolName).success;
}

export const Route = createFileRoute('/api/character-assistant')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA.parse((await request.json()) as unknown);
          let projectedCard: CharacterCard = structuredClone(payload.card);
          let latestProposal: iCharacterEditProposal | null = null;
          const sourceMessageId = payload.messages.at(-1)?.id;

          const stream = new ReadableStream<Uint8Array>({
            start: async (controller) => {
              const enqueueEvent = (event: iCharacterAssistantStreamEvent) => {
                controller.enqueue(encodeServerEvent(event));
              };

              try {
                const store = {
                  getCard: () => structuredClone(projectedCard),
                  appendProposedCard: ({
                    toolCallId,
                    summary,
                    proposedCard,
                  }: {
                    toolCallId: string;
                    summary: string;
                    proposedCard: CharacterCard;
                  }) => {
                    const proposal = createCharacterEditProposal({
                      characterId: payload.characterId,
                      baseCard: payload.card,
                      proposedCard,
                      sourceMessageId,
                      toolCallId,
                      summary,
                    });

                    if (proposal.patches.length === 0) {
                      throw new Error('The proposed edit does not change the character.');
                    }

                    projectedCard = structuredClone(proposedCard);
                    latestProposal = proposal;
                    enqueueEvent(
                      CHARACTER_ASSISTANT_PROPOSAL_EVENT_SCHEMA.parse({
                        type: CHARACTER_ASSISTANT_STREAM_EVENT_TYPES.proposal,
                        proposal,
                      }),
                    );

                    return proposal;
                  },
                };
                const { assistant } = createCharacterAssistantMastra({
                  card: payload.card,
                  focus: payload.focus,
                  contextAttachments: payload.contextAttachments,
                  apiKey: payload.apiKey,
                  generationSettings: {
                    endpoint: payload.endpoint,
                    model: payload.model,
                    maxTokens: payload.maxTokens,
                    temperature: payload.temperature,
                    topP: payload.topP,
                    frequencyPenalty: payload.frequencyPenalty,
                    presencePenalty: payload.presencePenalty,
                    topK: payload.topK,
                    minP: payload.minP,
                  },
                  shouldSendDisabledSamplers: payload.shouldSendDisabledSamplers,
                  generalCharacterIdea: payload.generalCharacterIdea,
                  store,
                });
                const output = await assistant.stream(payload.messages.map(toMastraMessage), {
                  maxSteps: MAX_CHARACTER_ASSISTANT_STEPS,
                  modelSettings: {
                    maxOutputTokens: payload.maxTokens,
                    temperature: payload.temperature,
                    topP: payload.topP,
                    frequencyPenalty: payload.frequencyPenalty,
                    presencePenalty: payload.presencePenalty,
                  },
                  abortSignal: request.signal,
                });

                for await (const chunk of output.fullStream) {
                  if (chunk.type === 'text-delta') {
                    enqueueEvent(
                      CHARACTER_ASSISTANT_TEXT_DELTA_EVENT_SCHEMA.parse({
                        type: CHARACTER_ASSISTANT_STREAM_EVENT_TYPES['text-delta'],
                        textDelta: chunk.payload.text,
                      }),
                    );
                    continue;
                  }

                  if (chunk.type === 'tool-call' && isCharacterAssistantToolName(chunk.payload.toolName)) {
                    enqueueEvent(
                      CHARACTER_ASSISTANT_TOOL_CALL_START_EVENT_SCHEMA.parse({
                        type: CHARACTER_ASSISTANT_STREAM_EVENT_TYPES['tool-call-start'],
                        toolCallId: chunk.payload.toolCallId,
                        toolName: chunk.payload.toolName,
                      }),
                    );
                    continue;
                  }

                  if (chunk.type === 'tool-error' && isCharacterAssistantToolName(chunk.payload.toolName)) {
                    enqueueEvent(
                      CHARACTER_ASSISTANT_TOOL_CALL_ERROR_EVENT_SCHEMA.parse({
                        type: CHARACTER_ASSISTANT_STREAM_EVENT_TYPES['tool-call-error'],
                        toolCallId: chunk.payload.toolCallId,
                        toolName: chunk.payload.toolName,
                        message:
                          chunk.payload.error instanceof Error ? chunk.payload.error.message : 'Proposal tool failed.',
                      }),
                    );
                  }
                }

                const fullOutput = await output.getFullOutput();
                enqueueEvent(
                  CHARACTER_ASSISTANT_COMPLETE_EVENT_SCHEMA.parse({
                    type: CHARACTER_ASSISTANT_STREAM_EVENT_TYPES.complete,
                    assistantMessage: fullOutput.text.trim() || 'The proposed changes are ready for review.',
                    proposals: latestProposal ? [latestProposal] : [],
                  }),
                );
              } catch (error) {
                enqueueEvent(
                  CHARACTER_ASSISTANT_ERROR_EVENT_SCHEMA.parse({
                    type: CHARACTER_ASSISTANT_STREAM_EVENT_TYPES.error,
                    message: error instanceof Error ? error.message : 'Character assistant failed.',
                  }),
                );
              } finally {
                controller.close();
              }
            },
          });

          return new Response(stream, {
            headers: {
              'Cache-Control': 'no-store',
              Connection: 'keep-alive',
              'Content-Type': 'text/event-stream; charset=utf-8',
            },
          });
        } catch (error) {
          return new Response(error instanceof Error ? error.message : 'Character assistant failed.', {
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
