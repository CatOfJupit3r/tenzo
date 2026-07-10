import { createFileRoute } from '@tanstack/react-router';
import { ZodError } from 'zod';

import { GUIDED_STEP_DEFINITIONS } from '@~/features/character-creator/constants/guided-flow';
import type { CharacterCard } from '@~/features/character-creator/lib/card-schema';
import { CHARACTER_TEXT_FIELD_KEYS } from '@~/features/character-creator/lib/card-schema';
import {
  CHARACTER_ASSISTANT_CONCEPT_RECORDED_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_COMPLETE_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_ERROR_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_PROPOSAL_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_STREAM_EVENT_TYPES,
  CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA,
  CHARACTER_ASSISTANT_TEXT_DELTA_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_TOOL_CALL_ERROR_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_TOOL_CALL_START_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_TOOL_NAME_SCHEMA,
  CHARACTER_CONCEPT_SCHEMA,
} from '@~/features/character-creator/lib/character-assistant-contracts';
import type {
  CharacterAssistantFocus,
  CharacterAssistantToolName,
  iCharacterAssistantStreamEvent,
} from '@~/features/character-creator/lib/character-assistant-contracts';
import { createCharacterAssistantMastra } from '@~/features/character-creator/lib/character-assistant-mastra.server';
import { createCharacterEditProposal } from '@~/features/character-creator/lib/character-edit-proposal';
import type { iCharacterEditProposal } from '@~/features/character-creator/lib/character-edit-proposal';
import { TEMPLATE_FIELD_KEYS } from '@~/features/character-creator/lib/field-templates';

const MAX_CHARACTER_ASSISTANT_STEPS = 12;
const MAX_GUIDED_ASSISTANT_STEPS = 6;
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

function getAllowedGuidedToolNames(guidedStep: keyof typeof GUIDED_STEP_DEFINITIONS) {
  const { allowedFieldKeys } = GUIDED_STEP_DEFINITIONS[guidedStep];
  const hasField = (fieldKey: string) => allowedFieldKeys.some((allowedFieldKey) => allowedFieldKey === fieldKey);
  const toolNames: CharacterAssistantToolName[] = ['read_character'];

  if (guidedStep === 'concept') {
    toolNames.push('record_concept');
  }

  if (
    allowedFieldKeys.some((fieldKey) => CHARACTER_TEXT_FIELD_KEYS.some((textFieldKey) => textFieldKey === fieldKey))
  ) {
    toolNames.push('propose_character_fields');
  }

  if (hasField('tags')) {
    toolNames.push('propose_tags');
  }

  if (hasField('alternate_greetings')) {
    toolNames.push('propose_alternate_greetings');
  }

  if (hasField('custom_fields')) {
    toolNames.push('propose_custom_fields');
  }

  if (hasField('character_book')) {
    toolNames.push('propose_character_book');
  }

  return toolNames;
}

function getStrictTemplateWarning(
  baseCard: CharacterCard,
  proposedCard: CharacterCard,
  templates: (typeof CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA)['shape']['templates']['_output'],
) {
  const fieldKeyByTemplateField = {
    [TEMPLATE_FIELD_KEYS.description]: 'description',
    [TEMPLATE_FIELD_KEYS.personality]: 'personality',
    [TEMPLATE_FIELD_KEYS.scenario]: 'scenario',
    [TEMPLATE_FIELD_KEYS.first_mes]: 'first_mes',
    [TEMPLATE_FIELD_KEYS.mes_example]: 'mes_example',
    [TEMPLATE_FIELD_KEYS.creator_notes]: 'creator_notes',
    [TEMPLATE_FIELD_KEYS.system_prompt]: 'system_prompt',
    [TEMPLATE_FIELD_KEYS.post_history_instructions]: 'post_history_instructions',
    [TEMPLATE_FIELD_KEYS.alternate_greeting]: 'alternate_greetings',
    [TEMPLATE_FIELD_KEYS.custom_field]: 'custom_fields',
  } as const;
  const getCardTemplateValue = (
    card: CharacterCard,
    fieldKey: (typeof fieldKeyByTemplateField)[keyof typeof fieldKeyByTemplateField],
  ) => {
    if (fieldKey === 'custom_fields') {
      return card.data.extensions.custom_fields;
    }

    if (fieldKey === 'alternate_greetings') {
      return card.data.alternate_greetings;
    }

    return card.data[fieldKey];
  };

  for (const template of templates) {
    if (template.mode !== 'strict') {
      continue;
    }

    for (const templateFieldKey of template.fieldKeys) {
      const fieldKey = fieldKeyByTemplateField[templateFieldKey];
      if (!fieldKey) {
        continue;
      }

      const baseValue = getCardTemplateValue(baseCard, fieldKey);
      const proposedValue = getCardTemplateValue(proposedCard, fieldKey);
      if (JSON.stringify(baseValue) === JSON.stringify(proposedValue)) {
        continue;
      }

      const literalSegments = template.content
        .split(/\{\{\s*gen:[^{}]+\}\}/gi)
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 20);
      const fieldValue = Array.isArray(proposedValue) ? JSON.stringify(proposedValue) : proposedValue;
      if (literalSegments.length === 0 || literalSegments.some((segment) => fieldValue.includes(segment))) {
        continue;
      }

      return `May not follow the strict template "${template.name}" - review closely.`;
    }
  }

  return null;
}

export const Route = createFileRoute('/api/character-assistant')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA.parse((await request.json()) as unknown);
          let projectedCard: CharacterCard = structuredClone(payload.card);
          let latestProposal: iCharacterEditProposal | null = null;
          let recordedConcept: ReturnType<typeof CHARACTER_CONCEPT_SCHEMA.parse> | undefined;
          const sourceMessageId = payload.messages.at(-1)?.id;
          const guidedDefinition = payload.guidedStep ? GUIDED_STEP_DEFINITIONS[payload.guidedStep] : null;
          let effectiveFocus: CharacterAssistantFocus = payload.focus;
          if (guidedDefinition) {
            effectiveFocus =
              guidedDefinition.allowedFieldKeys.length > 0
                ? { kind: 'fields', fieldKeys: [...guidedDefinition.allowedFieldKeys] }
                : { kind: 'card' };
          }
          const allowedToolNames = guidedDefinition ? getAllowedGuidedToolNames(guidedDefinition.id) : undefined;

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
                    const strictTemplateWarning = getStrictTemplateWarning(
                      payload.card,
                      proposedCard,
                      payload.templates,
                    );
                    const proposalSummary = strictTemplateWarning ? `${summary} ${strictTemplateWarning}` : summary;
                    const proposal = createCharacterEditProposal({
                      characterId: payload.characterId,
                      baseCard: payload.card,
                      proposedCard,
                      sourceMessageId,
                      toolCallId,
                      summary: proposalSummary,
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
                  recordConcept: (concept: unknown) => {
                    const parsedConcept = CHARACTER_CONCEPT_SCHEMA.parse(concept);
                    recordedConcept = parsedConcept;
                    enqueueEvent(
                      CHARACTER_ASSISTANT_CONCEPT_RECORDED_EVENT_SCHEMA.parse({
                        type: CHARACTER_ASSISTANT_STREAM_EVENT_TYPES['concept-recorded'],
                        concept: parsedConcept,
                      }),
                    );
                  },
                };
                const { assistant } = createCharacterAssistantMastra({
                  card: payload.card,
                  focus: effectiveFocus,
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
                  guidedStep: payload.guidedStep,
                  concept: payload.concept,
                  templates: payload.templates,
                  allowedToolNames,
                  store,
                });
                const output = await assistant.stream(payload.messages.map(toMastraMessage), {
                  maxSteps: payload.guidedStep ? MAX_GUIDED_ASSISTANT_STEPS : MAX_CHARACTER_ASSISTANT_STEPS,
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
                    concept: recordedConcept,
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
