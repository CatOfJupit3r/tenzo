import { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import {
  CHARACTER_BOOK_SCHEMA,
  CHARACTER_CARD_SCHEMA,
  CHARACTER_TEXT_FIELD_KEYS,
  CHARACTER_TEXT_FIELD_KEY_SCHEMA,
  CUSTOM_FIELD_SCHEMA,
} from './card-schema';
import type { CharacterBook, CharacterCard, CustomField } from './card-schema';

export const CHARACTER_EDIT_LIST_FIELD_KEY_SCHEMA = z.enum(['tags', 'alternate_greetings']);
export const CHARACTER_EDIT_LIST_FIELD_KEYS = CHARACTER_EDIT_LIST_FIELD_KEY_SCHEMA.enum;
export type CharacterEditListFieldKey = z.infer<typeof CHARACTER_EDIT_LIST_FIELD_KEY_SCHEMA>;

export const CHARACTER_EDIT_FIELD_KEY_SCHEMA = z.enum([
  ...CHARACTER_TEXT_FIELD_KEYS,
  'tags',
  'alternate_greetings',
  'custom_fields',
  'character_book',
]);
export const CHARACTER_EDIT_FIELD_KEYS = CHARACTER_EDIT_FIELD_KEY_SCHEMA.enum;
export type CharacterEditFieldKey = z.infer<typeof CHARACTER_EDIT_FIELD_KEY_SCHEMA>;

export const CHARACTER_EDIT_PATCH_STATUS_SCHEMA = z.enum(['proposed', 'applying', 'applied', 'rejected', 'conflict']);
export const CHARACTER_EDIT_PATCH_STATUSES = CHARACTER_EDIT_PATCH_STATUS_SCHEMA.enum;
export type CharacterEditPatchStatus = z.infer<typeof CHARACTER_EDIT_PATCH_STATUS_SCHEMA>;

const CHARACTER_EDIT_TEXT_PATCH_SCHEMA = z.object({
  kind: z.literal('text'),
  fieldKey: CHARACTER_TEXT_FIELD_KEY_SCHEMA,
  oldValue: z.string(),
  newValue: z.string(),
  status: CHARACTER_EDIT_PATCH_STATUS_SCHEMA,
});

const CHARACTER_EDIT_LIST_PATCH_SCHEMA = z.object({
  kind: z.literal('string-list'),
  fieldKey: CHARACTER_EDIT_LIST_FIELD_KEY_SCHEMA,
  oldValue: z.array(z.string()),
  newValue: z.array(z.string()),
  status: CHARACTER_EDIT_PATCH_STATUS_SCHEMA,
});

const CHARACTER_EDIT_CUSTOM_FIELDS_PATCH_SCHEMA = z.object({
  kind: z.literal('custom-fields'),
  fieldKey: z.literal('custom_fields'),
  oldValue: z.array(CUSTOM_FIELD_SCHEMA),
  newValue: z.array(CUSTOM_FIELD_SCHEMA),
  status: CHARACTER_EDIT_PATCH_STATUS_SCHEMA,
});

const CHARACTER_EDIT_CHARACTER_BOOK_PATCH_SCHEMA = z.object({
  kind: z.literal('character-book'),
  fieldKey: z.literal('character_book'),
  oldValue: CHARACTER_BOOK_SCHEMA.optional(),
  newValue: CHARACTER_BOOK_SCHEMA.optional(),
  status: CHARACTER_EDIT_PATCH_STATUS_SCHEMA,
});

export const CHARACTER_EDIT_PATCH_SCHEMA = z.discriminatedUnion('kind', [
  CHARACTER_EDIT_TEXT_PATCH_SCHEMA,
  CHARACTER_EDIT_LIST_PATCH_SCHEMA,
  CHARACTER_EDIT_CUSTOM_FIELDS_PATCH_SCHEMA,
  CHARACTER_EDIT_CHARACTER_BOOK_PATCH_SCHEMA,
]);
export type iCharacterEditPatch = z.infer<typeof CHARACTER_EDIT_PATCH_SCHEMA>;

export const CHARACTER_EDIT_PROPOSAL_STATUS_SCHEMA = z.enum([
  'streaming',
  'review',
  'applying',
  'applied',
  'rejected',
  'conflict',
  'failed',
]);
export const CHARACTER_EDIT_PROPOSAL_STATUSES = CHARACTER_EDIT_PROPOSAL_STATUS_SCHEMA.enum;
export type CharacterEditProposalStatus = z.infer<typeof CHARACTER_EDIT_PROPOSAL_STATUS_SCHEMA>;

export const CHARACTER_EDIT_PROPOSAL_SCHEMA = z.object({
  id: z.string(),
  characterId: z.string().nullable(),
  baseRevision: z.string(),
  patches: z.array(CHARACTER_EDIT_PATCH_SCHEMA),
  status: CHARACTER_EDIT_PROPOSAL_STATUS_SCHEMA,
  sourceMessageId: z.string().optional(),
  toolCallId: z.string().optional(),
  summary: z.string().optional(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type iCharacterEditProposal = z.infer<typeof CHARACTER_EDIT_PROPOSAL_SCHEMA>;

export const CHARACTER_EDIT_PROPOSAL_EVENT_SCHEMA = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('patches-upserted'),
    patches: z.array(CHARACTER_EDIT_PATCH_SCHEMA),
    occurredAt: z.string(),
  }),
  z.object({ type: z.literal('review-requested'), occurredAt: z.string() }),
  z.object({
    type: z.literal('apply-requested'),
    fieldKeys: z.array(CHARACTER_EDIT_FIELD_KEY_SCHEMA),
    occurredAt: z.string(),
  }),
  z.object({
    type: z.literal('apply-succeeded'),
    fieldKeys: z.array(CHARACTER_EDIT_FIELD_KEY_SCHEMA),
    occurredAt: z.string(),
  }),
  z.object({
    type: z.literal('patches-rejected'),
    fieldKeys: z.array(CHARACTER_EDIT_FIELD_KEY_SCHEMA),
    occurredAt: z.string(),
  }),
  z.object({
    type: z.literal('conflicts-detected'),
    fieldKeys: z.array(CHARACTER_EDIT_FIELD_KEY_SCHEMA),
    occurredAt: z.string(),
  }),
  z.object({ type: z.literal('failed'), message: z.string(), occurredAt: z.string() }),
]);
export type iCharacterEditProposalEvent = z.infer<typeof CHARACTER_EDIT_PROPOSAL_EVENT_SCHEMA>;

export interface iCreateCharacterEditProposalInput {
  characterId?: string;
  baseCard: CharacterCard;
  proposedCard: CharacterCard;
  sourceMessageId?: string;
  toolCallId?: string;
  summary?: string;
}

export interface iApplyCharacterEditProposalResult {
  card: CharacterCard;
  proposal: iCharacterEditProposal;
  conflictFieldKeys: CharacterEditFieldKey[];
}

function areValuesEqual(leftValue: unknown, rightValue: unknown) {
  return JSON.stringify(leftValue) === JSON.stringify(rightValue);
}

function toCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toCanonicalValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, nestedValue]) => [key, toCanonicalValue(nestedValue)]),
    );
  }

  return value;
}

function hashString(value: string) {
  let hash = 7;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647;
  }

  return hash.toString(36);
}

function getPatchValue(card: CharacterCard, patch: iCharacterEditPatch) {
  if (patch.kind === 'text' || patch.kind === 'string-list') {
    return card.data[patch.fieldKey];
  }

  if (patch.kind === 'custom-fields') {
    return card.data.extensions.custom_fields;
  }

  return card.data.character_book;
}

function applyPatch(card: CharacterCard, patch: iCharacterEditPatch) {
  if (patch.kind === 'text') {
    card.data[patch.fieldKey] = patch.newValue;
    return;
  }

  if (patch.kind === 'string-list') {
    card.data[patch.fieldKey] = structuredClone(patch.newValue);
    return;
  }

  if (patch.kind === 'custom-fields') {
    card.data.extensions.custom_fields = structuredClone(patch.newValue);
    return;
  }

  card.data.character_book = patch.newValue ? structuredClone(patch.newValue) : undefined;
}

function getProposalStatusAfterSettlingPatches(patches: iCharacterEditPatch[]) {
  const hasActivePatch = patches.some(
    (patch) =>
      patch.status === CHARACTER_EDIT_PATCH_STATUSES.proposed ||
      patch.status === CHARACTER_EDIT_PATCH_STATUSES.applying ||
      patch.status === CHARACTER_EDIT_PATCH_STATUSES.conflict,
  );

  if (hasActivePatch) {
    return CHARACTER_EDIT_PROPOSAL_STATUSES.review;
  }

  const hasAppliedPatch = patches.some((patch) => patch.status === CHARACTER_EDIT_PATCH_STATUSES.applied);
  return hasAppliedPatch ? CHARACTER_EDIT_PROPOSAL_STATUSES.applied : CHARACTER_EDIT_PROPOSAL_STATUSES.rejected;
}

export function createCharacterCardRevision(card: CharacterCard) {
  const canonicalCard = JSON.stringify(toCanonicalValue(CHARACTER_CARD_SCHEMA.parse(card)));
  return `card-v1-${hashString(canonicalCard)}`;
}

export function createCharacterEditPatches(
  baseCard: CharacterCard,
  proposedCard: CharacterCard,
): iCharacterEditPatch[] {
  const patches: iCharacterEditPatch[] = [];

  CHARACTER_TEXT_FIELD_KEYS.forEach((fieldKey) => {
    const oldValue = baseCard.data[fieldKey];
    const newValue = proposedCard.data[fieldKey];

    if (oldValue !== newValue) {
      patches.push({ kind: 'text', fieldKey, oldValue, newValue, status: CHARACTER_EDIT_PATCH_STATUSES.proposed });
    }
  });

  Object.values(CHARACTER_EDIT_LIST_FIELD_KEYS).forEach((fieldKey) => {
    const oldValue = baseCard.data[fieldKey];
    const newValue = proposedCard.data[fieldKey];

    if (!areValuesEqual(oldValue, newValue)) {
      patches.push({
        kind: 'string-list',
        fieldKey,
        oldValue: structuredClone(oldValue),
        newValue: structuredClone(newValue),
        status: CHARACTER_EDIT_PATCH_STATUSES.proposed,
      });
    }
  });

  const oldCustomFields: CustomField[] = baseCard.data.extensions.custom_fields;
  const newCustomFields: CustomField[] = proposedCard.data.extensions.custom_fields;
  if (!areValuesEqual(oldCustomFields, newCustomFields)) {
    patches.push({
      kind: 'custom-fields',
      fieldKey: CHARACTER_EDIT_FIELD_KEYS.custom_fields,
      oldValue: structuredClone(oldCustomFields),
      newValue: structuredClone(newCustomFields),
      status: CHARACTER_EDIT_PATCH_STATUSES.proposed,
    });
  }

  const oldCharacterBook: CharacterBook | undefined = baseCard.data.character_book;
  const newCharacterBook: CharacterBook | undefined = proposedCard.data.character_book;
  if (!areValuesEqual(oldCharacterBook, newCharacterBook)) {
    patches.push({
      kind: 'character-book',
      fieldKey: CHARACTER_EDIT_FIELD_KEYS.character_book,
      oldValue: oldCharacterBook ? structuredClone(oldCharacterBook) : undefined,
      newValue: newCharacterBook ? structuredClone(newCharacterBook) : undefined,
      status: CHARACTER_EDIT_PATCH_STATUSES.proposed,
    });
  }

  return patches;
}

export function createCharacterEditProposal({
  characterId,
  baseCard,
  proposedCard,
  sourceMessageId,
  toolCallId,
  summary,
}: iCreateCharacterEditProposalInput): iCharacterEditProposal {
  const now = new Date().toISOString();

  return CHARACTER_EDIT_PROPOSAL_SCHEMA.parse({
    id: generateUuid(),
    characterId: characterId ?? null,
    baseRevision: createCharacterCardRevision(baseCard),
    patches: createCharacterEditPatches(baseCard, proposedCard),
    status: CHARACTER_EDIT_PROPOSAL_STATUSES.review,
    sourceMessageId,
    toolCallId,
    summary,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  });
}

export function reduceCharacterEditProposal(
  proposal: iCharacterEditProposal,
  event: iCharacterEditProposalEvent,
): iCharacterEditProposal {
  if (event.type === 'patches-upserted') {
    const incomingFieldKeys = new Set(event.patches.map((patch) => patch.fieldKey));
    return {
      ...proposal,
      patches: [...proposal.patches.filter((patch) => !incomingFieldKeys.has(patch.fieldKey)), ...event.patches],
      status: CHARACTER_EDIT_PROPOSAL_STATUSES.streaming,
      errorMessage: null,
      updatedAt: event.occurredAt,
    };
  }

  if (event.type === 'review-requested') {
    return { ...proposal, status: CHARACTER_EDIT_PROPOSAL_STATUSES.review, updatedAt: event.occurredAt };
  }

  if (event.type === 'failed') {
    return {
      ...proposal,
      status: CHARACTER_EDIT_PROPOSAL_STATUSES.failed,
      errorMessage: event.message,
      updatedAt: event.occurredAt,
    };
  }

  const fieldKeys = new Set(event.fieldKeys);
  let nextPatchStatus: CharacterEditPatchStatus;
  if (event.type === 'apply-requested') {
    nextPatchStatus = CHARACTER_EDIT_PATCH_STATUSES.applying;
  } else if (event.type === 'apply-succeeded') {
    nextPatchStatus = CHARACTER_EDIT_PATCH_STATUSES.applied;
  } else if (event.type === 'patches-rejected') {
    nextPatchStatus = CHARACTER_EDIT_PATCH_STATUSES.rejected;
  } else {
    nextPatchStatus = CHARACTER_EDIT_PATCH_STATUSES.conflict;
  }

  const patches = proposal.patches.map((patch) =>
    fieldKeys.has(patch.fieldKey) ? { ...patch, status: nextPatchStatus } : patch,
  );

  if (event.type === 'apply-requested') {
    return {
      ...proposal,
      patches,
      status: CHARACTER_EDIT_PROPOSAL_STATUSES.applying,
      errorMessage: null,
      updatedAt: event.occurredAt,
    };
  }

  if (event.type === 'conflicts-detected') {
    return {
      ...proposal,
      patches,
      status: CHARACTER_EDIT_PROPOSAL_STATUSES.conflict,
      updatedAt: event.occurredAt,
    };
  }

  return {
    ...proposal,
    patches,
    status: getProposalStatusAfterSettlingPatches(patches),
    errorMessage: null,
    updatedAt: event.occurredAt,
  };
}

export function getCharacterEditProposalConflicts(
  proposal: iCharacterEditProposal,
  currentCard: CharacterCard,
  fieldKeys: readonly CharacterEditFieldKey[] = proposal.patches.map((patch) => patch.fieldKey),
) {
  const selectedFieldKeys = new Set(fieldKeys);

  return proposal.patches
    .filter(
      (patch) =>
        selectedFieldKeys.has(patch.fieldKey) && !areValuesEqual(getPatchValue(currentCard, patch), patch.oldValue),
    )
    .map((patch) => patch.fieldKey);
}

export function applyCharacterEditProposal(
  proposal: iCharacterEditProposal,
  currentCard: CharacterCard,
  fieldKeys: readonly CharacterEditFieldKey[] = proposal.patches.map((patch) => patch.fieldKey),
): iApplyCharacterEditProposalResult {
  const occurredAt = new Date().toISOString();
  const conflictFieldKeys = getCharacterEditProposalConflicts(proposal, currentCard, fieldKeys);

  if (conflictFieldKeys.length > 0) {
    return {
      card: currentCard,
      proposal: reduceCharacterEditProposal(proposal, {
        type: 'conflicts-detected',
        fieldKeys: conflictFieldKeys,
        occurredAt,
      }),
      conflictFieldKeys,
    };
  }

  const selectedFieldKeys = new Set(fieldKeys);
  const nextCard = structuredClone(currentCard);
  proposal.patches.forEach((patch) => {
    if (selectedFieldKeys.has(patch.fieldKey)) {
      applyPatch(nextCard, patch);
    }
  });

  return {
    card: nextCard,
    proposal: reduceCharacterEditProposal(proposal, {
      type: 'apply-succeeded',
      fieldKeys: [...selectedFieldKeys],
      occurredAt,
    }),
    conflictFieldKeys: [],
  };
}
