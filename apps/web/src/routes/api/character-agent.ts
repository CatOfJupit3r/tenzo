import { createFileRoute } from '@tanstack/react-router';
import { ZodError } from 'zod';

import type { CharacterCard } from '@~/features/character-creator/lib/card-schema';
import {
  CHARACTER_AGENT_ERROR_EVENT_SCHEMA,
  CHARACTER_AGENT_STREAM_REQUEST_SCHEMA,
  CHARACTER_AGENT_STREAM_EVENT_TYPES,
  CHARACTER_AGENT_TOOL_CALL_START_EVENT_SCHEMA,
  CHARACTER_AGENT_TOOL_CALL_ERROR_EVENT_SCHEMA,
} from '@~/features/character-creator/lib/character-agent-contracts';
import { createCharacterAgentMastra } from '@~/features/character-creator/lib/character-agent-mastra.server';
import { CHARACTER_AGENT_TOOL_NAME_SCHEMA } from '@~/features/character-creator/lib/character-agent-session';
import type {
  CharacterAgentToolName,
  iCharacterAgentToolEvent,
} from '@~/features/character-creator/lib/character-agent-session';

const MAX_CHARACTER_AGENT_STEPS = 8;
const textEncoder = new TextEncoder();

function encodeServerEvent(type: string, payload: unknown) {
  return textEncoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function toMastraMessage(
  message: (typeof CHARACTER_AGENT_STREAM_REQUEST_SCHEMA)['shape']['messages']['element']['_output'],
) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: new Date(message.createdAt),
  };
}

function createErrorEventPayload(message: string) {
  return CHARACTER_AGENT_ERROR_EVENT_SCHEMA.parse({
    type: CHARACTER_AGENT_STREAM_EVENT_TYPES.error,
    message,
  });
}

function isCharacterAgentToolName(toolName: string): toolName is CharacterAgentToolName {
  return CHARACTER_AGENT_TOOL_NAME_SCHEMA.safeParse(toolName).success;
}

function createToolCallStartEventPayload(toolCallId: string, toolName: CharacterAgentToolName) {
  return CHARACTER_AGENT_TOOL_CALL_START_EVENT_SCHEMA.parse({
    type: CHARACTER_AGENT_STREAM_EVENT_TYPES['tool-call-start'],
    toolCallId,
    toolName,
  });
}

function createToolCallErrorEventPayload(toolCallId: string, toolName: CharacterAgentToolName, message: string) {
  return CHARACTER_AGENT_TOOL_CALL_ERROR_EVENT_SCHEMA.parse({
    type: CHARACTER_AGENT_STREAM_EVENT_TYPES['tool-call-error'],
    toolCallId,
    toolName,
    message,
  });
}

export const Route = createFileRoute('/api/character-agent')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = CHARACTER_AGENT_STREAM_REQUEST_SCHEMA.parse((await request.json()) as unknown);
          let draftCard: CharacterCard = structuredClone(payload.draftCard);
          const toolEvents: iCharacterAgentToolEvent[] = [];

          const stream = new ReadableStream<Uint8Array>({
            start: async (controller) => {
              const enqueueEvent = (type: string, body: unknown) => {
                controller.enqueue(encodeServerEvent(type, body));
              };

              try {
                const store = {
                  getDraftCard: () => structuredClone(draftCard),
                  replaceDraftCard: (nextCard: CharacterCard) => {
                    draftCard = structuredClone(nextCard);
                  },
                  appendToolEvent: (toolEvent: iCharacterAgentToolEvent) => {
                    toolEvents.push(toolEvent);
                    enqueueEvent(CHARACTER_AGENT_STREAM_EVENT_TYPES['tool-event'], {
                      type: CHARACTER_AGENT_STREAM_EVENT_TYPES['tool-event'],
                      toolEvent,
                      draftCard,
                    });
                  },
                };
                const { agent } = createCharacterAgentMastra({
                  card: payload.draftCard,
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
                const output = await agent.stream(payload.messages.map(toMastraMessage), {
                  maxSteps: MAX_CHARACTER_AGENT_STEPS,
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
                    enqueueEvent(CHARACTER_AGENT_STREAM_EVENT_TYPES['text-delta'], {
                      type: CHARACTER_AGENT_STREAM_EVENT_TYPES['text-delta'],
                      textDelta: chunk.payload.text,
                    });
                    continue;
                  }

                  if (chunk.type === 'tool-call' && isCharacterAgentToolName(chunk.payload.toolName)) {
                    enqueueEvent(
                      CHARACTER_AGENT_STREAM_EVENT_TYPES['tool-call-start'],
                      createToolCallStartEventPayload(chunk.payload.toolCallId, chunk.payload.toolName),
                    );
                    continue;
                  }

                  if (chunk.type === 'tool-error' && isCharacterAgentToolName(chunk.payload.toolName)) {
                    enqueueEvent(
                      CHARACTER_AGENT_STREAM_EVENT_TYPES['tool-call-error'],
                      createToolCallErrorEventPayload(
                        chunk.payload.toolCallId,
                        chunk.payload.toolName,
                        chunk.payload.error instanceof Error ? chunk.payload.error.message : 'Tool call failed.',
                      ),
                    );
                  }
                }

                const fullOutput = await output.getFullOutput();

                enqueueEvent(CHARACTER_AGENT_STREAM_EVENT_TYPES.complete, {
                  type: CHARACTER_AGENT_STREAM_EVENT_TYPES.complete,
                  assistantMessage: fullOutput.text.trim() || 'The draft is ready for review.',
                  draftCard,
                });
              } catch (error) {
                enqueueEvent(
                  CHARACTER_AGENT_STREAM_EVENT_TYPES.error,
                  createErrorEventPayload(error instanceof Error ? error.message : 'Character agent failed.'),
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
          return new Response(error instanceof Error ? error.message : 'Character agent failed.', {
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
