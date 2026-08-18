import type { UIMessage } from '@tanstack/ai-react';
import { z } from 'zod';

import { JSON_VALUE_SCHEMA } from '@~/lib/json-value';
import { generateUuid } from '@~/utils/uuid';

import { CHARACTER_EDIT_PROPOSAL_SCHEMA } from '../proposals/character-edit-proposal';

const CONTENT_PART_SOURCE_SCHEMA = z.discriminatedUnion('type', [
  z.object({ type: z.literal('data'), value: z.string(), mimeType: z.string() }),
  z.object({ type: z.literal('url'), value: z.string(), mimeType: z.string().optional() }),
]);

const CONTENT_PART_SCHEMA = z.union([
  z.object({ type: z.literal('text'), content: z.string(), metadata: JSON_VALUE_SCHEMA.optional() }),
  z.object({ type: z.literal('image'), source: CONTENT_PART_SOURCE_SCHEMA, metadata: JSON_VALUE_SCHEMA.optional() }),
  z.object({ type: z.literal('audio'), source: CONTENT_PART_SOURCE_SCHEMA, metadata: JSON_VALUE_SCHEMA.optional() }),
  z.object({ type: z.literal('video'), source: CONTENT_PART_SOURCE_SCHEMA, metadata: JSON_VALUE_SCHEMA.optional() }),
  z.object({
    type: z.literal('document'),
    source: CONTENT_PART_SOURCE_SCHEMA,
    metadata: JSON_VALUE_SCHEMA.optional(),
  }),
]);

const UI_MESSAGE_PART_SCHEMA: z.ZodType<UIMessage['parts'][number]> = z.union([
  z.object({ type: z.literal('text'), content: z.string(), metadata: JSON_VALUE_SCHEMA.optional() }),
  z.object({ type: z.literal('image'), source: CONTENT_PART_SOURCE_SCHEMA, metadata: JSON_VALUE_SCHEMA.optional() }),
  z.object({ type: z.literal('audio'), source: CONTENT_PART_SOURCE_SCHEMA, metadata: JSON_VALUE_SCHEMA.optional() }),
  z.object({ type: z.literal('video'), source: CONTENT_PART_SOURCE_SCHEMA, metadata: JSON_VALUE_SCHEMA.optional() }),
  z.object({
    type: z.literal('document'),
    source: CONTENT_PART_SOURCE_SCHEMA,
    metadata: JSON_VALUE_SCHEMA.optional(),
  }),
  z.object({
    type: z.literal('tool-call'),
    id: z.string(),
    name: z.string(),
    arguments: z.string(),
    input: JSON_VALUE_SCHEMA.optional(),
    state: z.enum([
      'awaiting-input',
      'input-streaming',
      'input-complete',
      'approval-requested',
      'approval-responded',
      'complete',
      'error',
    ]),
    approval: z
      .object({
        id: z.string(),
        needsApproval: z.boolean(),
        approved: z.boolean().optional(),
      })
      .optional(),
    output: JSON_VALUE_SCHEMA.optional(),
    metadata: JSON_VALUE_SCHEMA.optional(),
  }),
  z.object({
    type: z.literal('tool-result'),
    toolCallId: z.string(),
    content: z.union([z.string(), z.array(CONTENT_PART_SCHEMA)]),
    state: z.enum(['streaming', 'complete', 'error']),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal('thinking'),
    content: z.string(),
    stepId: z.string().optional(),
    signature: z.string().optional(),
  }),
  z.object({
    type: z.literal('structured-output'),
    status: z.enum(['streaming', 'complete', 'error']),
    partial: JSON_VALUE_SCHEMA.optional(),
    data: JSON_VALUE_SCHEMA.optional(),
    raw: z.string(),
    reasoning: z.string().optional(),
    errorMessage: z.string().optional(),
  }),
  z.object({
    type: z.literal('ui-resource'),
    resource: z.object({
      uri: z.string(),
      mimeType: z.string(),
      text: z.string().optional(),
      blob: z.string().optional(),
    }),
    serverId: z.string().optional(),
    toolCallId: z.string(),
    toolName: z.string(),
    meta: z.record(z.string(), JSON_VALUE_SCHEMA).optional(),
  }),
]);

const UI_MESSAGE_SCHEMA: z.ZodType<UIMessage> = z.object({
  id: z.string(),
  role: z.enum(['system', 'user', 'assistant']),
  parts: z.array(UI_MESSAGE_PART_SCHEMA),
  createdAt: z
    .union([
      z.date(),
      z
        .string()
        .datetime()
        .transform((value) => new Date(value)),
    ])
    .optional(),
});

export const CHARACTER_ASSISTANT_SESSION_SCHEMA = z.object({
  id: z.string(),
  characterId: z.string(),
  messages: z.array(UI_MESSAGE_SCHEMA),
  proposals: z.array(CHARACTER_EDIT_PROPOSAL_SCHEMA),
  lastRecordedConceptToolCallId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type iCharacterAssistantSession = z.infer<typeof CHARACTER_ASSISTANT_SESSION_SCHEMA>;

const CHARACTER_ASSISTANT_SESSION_INPUT_SCHEMA = z
  .object({
    id: z.string().catch(''),
    characterId: z.string().catch(''),
    messages: z
      .array(UI_MESSAGE_SCHEMA.optional().catch(undefined))
      .transform((messages) => messages.flatMap((message) => (message ? [message] : [])))
      .catch([]),
    proposals: z
      .array(CHARACTER_EDIT_PROPOSAL_SCHEMA.optional().catch(undefined))
      .transform((proposals) => proposals.flatMap((proposal) => (proposal ? [proposal] : [])))
      .catch([]),
    lastRecordedConceptToolCallId: z.string().nullable().catch(null),
    createdAt: z
      .string()
      .refine((value) => value.trim() !== '')
      .optional()
      .catch(undefined),
    updatedAt: z
      .string()
      .refine((value) => value.trim() !== '')
      .optional()
      .catch(undefined),
  })
  .catch({
    id: '',
    characterId: '',
    messages: [],
    proposals: [],
    lastRecordedConceptToolCallId: null,
    createdAt: undefined,
    updatedAt: undefined,
  });

export function sanitizeCharacterAssistantSession(value: unknown): iCharacterAssistantSession | null {
  const candidate = CHARACTER_ASSISTANT_SESSION_INPUT_SCHEMA.parse(value);
  const characterId = candidate.characterId.trim();
  if (!characterId) {
    return null;
  }

  const fallbackTimestamp = new Date().toISOString();
  return CHARACTER_ASSISTANT_SESSION_SCHEMA.parse({
    id: candidate.id.trim() ? candidate.id : characterId,
    characterId,
    messages: candidate.messages,
    proposals: candidate.proposals,
    lastRecordedConceptToolCallId: candidate.lastRecordedConceptToolCallId,
    createdAt: candidate.createdAt ?? fallbackTimestamp,
    updatedAt: candidate.updatedAt ?? fallbackTimestamp,
  });
}

export function createCharacterAssistantSession(characterId: string): iCharacterAssistantSession {
  const now = new Date().toISOString();
  return {
    id: generateUuid(),
    characterId,
    messages: [],
    proposals: [],
    lastRecordedConceptToolCallId: null,
    createdAt: now,
    updatedAt: now,
  };
}
