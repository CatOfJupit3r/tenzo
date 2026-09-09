import { em } from 'enumwaii';
import { z } from 'zod';

import {
  CHARACTER_BOOK_SCHEMA,
  CHARACTER_CARD_SCHEMA,
  CHARACTER_FIELD_KEY_ENUM,
  CHARACTER_FIELD_KEYS,
  CHARACTER_TEXT_FIELD_KEY_SCHEMA,
  CHARACTER_TEXT_FIELD_KEYS,
  CUSTOM_FIELD_SCHEMA,
} from '@~/features/character-creator/lib/cards/card-schema';
import { generateUuid } from '@~/utils/uuid';

import type { CharacterBook, CharacterCard, CustomField } from '../cards/card-schema';

export const CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_ENUM = em([
  'PATCHES_UPSERTED',
  'REVIEW_REQUESTED',
  'APPLY_REQUESTED',
  'APPLY_SUCCEEDED',
  'PATCHES_REJECTED',
  'CONFLICTS_DETECTED',
  'FAILED',
]);
export const CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES = CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_ENUM.cases;

export const CHARACTER_EDIT_PATCH_KINDS_ENUM = em({
  TEXT: 'text',
  STRING_LIST: 'string-list',
  CUSTOM_FIELDS: 'custom-fields',
  CHARACTER_BOOK: 'character-book',
});
export const CHARACTER_EDIT_PATCH_KINDS_CASES = CHARACTER_EDIT_PATCH_KINDS_ENUM.cases;

export const CHARACTER_EDIT_LIST_FIELD_KEY_ENUM = CHARACTER_FIELD_KEY_ENUM.pick([
  CHARACTER_FIELD_KEYS.TAGS,
  CHARACTER_FIELD_KEYS.ALTERNATE_GREETINGS,
]);
export const CHARACTER_EDIT_LIST_FIELD_KEYS = CHARACTER_EDIT_LIST_FIELD_KEY_ENUM.rawEnum;
export const CHARACTER_EDIT_LIST_FIELD_KEY_SCHEMA = z.enum(CHARACTER_EDIT_LIST_FIELD_KEYS);

export type CharacterEditListFieldKey = z.infer<typeof CHARACTER_EDIT_LIST_FIELD_KEY_SCHEMA>;

export const CHARACTER_EDIT_FIELD_KEY_ENUM = CHARACTER_FIELD_KEY_ENUM.pick([
  CHARACTER_FIELD_KEYS.NAME,
  CHARACTER_FIELD_KEYS.DESCRIPTION,
  CHARACTER_FIELD_KEYS.PERSONALITY,
  CHARACTER_FIELD_KEYS.SCENARIO,
  CHARACTER_FIELD_KEYS.FIRST_MES,
  CHARACTER_FIELD_KEYS.MES_EXAMPLE,
  CHARACTER_FIELD_KEYS.CREATOR_NOTES,
  CHARACTER_FIELD_KEYS.SYSTEM_PROMPT,
  CHARACTER_FIELD_KEYS.POST_HISTORY_INSTRUCTIONS,
  CHARACTER_FIELD_KEYS.CREATOR,
  CHARACTER_FIELD_KEYS.CHARACTER_VERSION,
  CHARACTER_FIELD_KEYS.TAGS,
  CHARACTER_FIELD_KEYS.ALTERNATE_GREETINGS,
  CHARACTER_FIELD_KEYS.CUSTOM_FIELDS,
  CHARACTER_FIELD_KEYS.CHARACTER_BOOK,
]);
export const CHARACTER_EDIT_FIELD_KEYS = CHARACTER_EDIT_FIELD_KEY_ENUM.rawEnum;
export const CHARACTER_EDIT_FIELD_KEY_SCHEMA = z.enum(CHARACTER_EDIT_FIELD_KEYS);

export type CharacterEditFieldKey = z.infer<typeof CHARACTER_EDIT_FIELD_KEY_SCHEMA>;

export const CHARACTER_EDIT_PATCH_STATUS_ENUM = em(['PROPOSED', 'APPLYING', 'APPLIED', 'REJECTED', 'CONFLICT']);
export const CHARACTER_EDIT_PATCH_STATUSES = CHARACTER_EDIT_PATCH_STATUS_ENUM.enum;
export const CHARACTER_EDIT_PATCH_STATUS_SCHEMA = z.enum(CHARACTER_EDIT_PATCH_STATUSES);

export type CharacterEditPatchStatus = z.infer<typeof CHARACTER_EDIT_PATCH_STATUS_SCHEMA>;

export const CHARACTER_EDIT_PATCH_STATUS_LABELS = CHARACTER_EDIT_PATCH_STATUS_ENUM.derive<string>()(
  [CHARACTER_EDIT_PATCH_STATUSES.PROPOSED, 'proposed'],
  [CHARACTER_EDIT_PATCH_STATUSES.APPLYING, 'applying'],
  [CHARACTER_EDIT_PATCH_STATUSES.APPLIED, 'applied'],
  [CHARACTER_EDIT_PATCH_STATUSES.REJECTED, 'rejected'],
  [CHARACTER_EDIT_PATCH_STATUSES.CONFLICT, 'conflict'],
);

const CHARACTER_EDIT_TEXT_PATCH_SCHEMA = z.object({
  kind: z.literal(CHARACTER_EDIT_PATCH_KINDS_CASES.TEXT),
  fieldKey: CHARACTER_TEXT_FIELD_KEY_SCHEMA,
  oldValue: z.string(),
  newValue: z.string(),
  status: CHARACTER_EDIT_PATCH_STATUS_SCHEMA,
});

const CHARACTER_EDIT_LIST_PATCH_SCHEMA = z.object({
  kind: z.literal(CHARACTER_EDIT_PATCH_KINDS_CASES.STRING_LIST),
  fieldKey: CHARACTER_EDIT_LIST_FIELD_KEY_SCHEMA,
  oldValue: z.array(z.string()),
  newValue: z.array(z.string()),
  status: CHARACTER_EDIT_PATCH_STATUS_SCHEMA,
});

const CHARACTER_EDIT_CUSTOM_FIELDS_PATCH_SCHEMA = z.object({
  kind: z.literal(CHARACTER_EDIT_PATCH_KINDS_CASES.CUSTOM_FIELDS),
  fieldKey: z.literal(CHARACTER_EDIT_FIELD_KEYS.CUSTOM_FIELDS),
  oldValue: z.array(CUSTOM_FIELD_SCHEMA),
  newValue: z.array(CUSTOM_FIELD_SCHEMA),
  status: CHARACTER_EDIT_PATCH_STATUS_SCHEMA,
});

const CHARACTER_EDIT_CHARACTER_BOOK_PATCH_SCHEMA = z.object({
  kind: z.literal(CHARACTER_EDIT_PATCH_KINDS_CASES.CHARACTER_BOOK),
  fieldKey: z.literal(CHARACTER_EDIT_FIELD_KEYS.CHARACTER_BOOK),
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

export function isCharacterEditPatchUnresolved(patch: iCharacterEditPatch) {
  return (
    patch.status === CHARACTER_EDIT_PATCH_STATUSES.PROPOSED ||
    patch.status === CHARACTER_EDIT_PATCH_STATUSES.APPLYING ||
    patch.status === CHARACTER_EDIT_PATCH_STATUSES.CONFLICT
  );
}

export const CHARACTER_EDIT_PROPOSAL_STATUS_ENUM = em([
  'STREAMING',
  'REVIEW',
  'APPLYING',
  'APPLIED',
  'REJECTED',
  'CONFLICT',
  'FAILED',
]);
export const CHARACTER_EDIT_PROPOSAL_STATUSES = CHARACTER_EDIT_PROPOSAL_STATUS_ENUM.enum;
export const CHARACTER_EDIT_PROPOSAL_STATUS_SCHEMA = z.enum(CHARACTER_EDIT_PROPOSAL_STATUSES);

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

function isSameCharacterEditProposalRun(proposal: iCharacterEditProposal, candidate: iCharacterEditProposal) {
  return candidate.sourceMessageId
    ? proposal.sourceMessageId === candidate.sourceMessageId
    : proposal.id === candidate.id;
}

export function upsertCharacterEditProposal(
  proposals: iCharacterEditProposal[],
  nextProposal: iCharacterEditProposal,
): iCharacterEditProposal[] {
  const currentProposal = proposals.find((proposal) => isSameCharacterEditProposalRun(proposal, nextProposal));
  const proposalToKeep =
    currentProposal && currentProposal.updatedAt > nextProposal.updatedAt ? currentProposal : nextProposal;

  return [...proposals.filter((proposal) => !isSameCharacterEditProposalRun(proposal, nextProposal)), proposalToKeep];
}

export function supersedeOverlappingCharacterEditProposals(
  proposals: readonly iCharacterEditProposal[],
  nextProposal: iCharacterEditProposal,
) {
  const nextFieldKeys = new Set(
    nextProposal.patches.filter(isCharacterEditPatchUnresolved).map((patch) => patch.fieldKey),
  );
  if (nextFieldKeys.size === 0) return [...proposals];

  return proposals.map((proposal) => {
    if (proposal.id === nextProposal.id) return proposal;
    const supersededFieldKeys = proposal.patches
      .filter((patch) => isCharacterEditPatchUnresolved(patch) && nextFieldKeys.has(patch.fieldKey))
      .map((patch) => patch.fieldKey);
    if (supersededFieldKeys.length === 0) return proposal;

    return reduceCharacterEditProposal(proposal, {
      type: CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.PATCHES_REJECTED,
      fieldKeys: supersededFieldKeys,
      occurredAt: nextProposal.createdAt,
    });
  });
}

export const CHARACTER_EDIT_PROPOSAL_EVENT_SCHEMA = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.PATCHES_UPSERTED),
    patches: z.array(CHARACTER_EDIT_PATCH_SCHEMA),
    occurredAt: z.string(),
  }),
  z.object({ type: z.literal(CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.REVIEW_REQUESTED), occurredAt: z.string() }),
  z.object({
    type: z.literal(CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.APPLY_REQUESTED),
    fieldKeys: z.array(CHARACTER_EDIT_FIELD_KEY_SCHEMA),
    occurredAt: z.string(),
  }),
  z.object({
    type: z.literal(CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.APPLY_SUCCEEDED),
    fieldKeys: z.array(CHARACTER_EDIT_FIELD_KEY_SCHEMA),
    occurredAt: z.string(),
  }),
  z.object({
    type: z.literal(CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.PATCHES_REJECTED),
    fieldKeys: z.array(CHARACTER_EDIT_FIELD_KEY_SCHEMA),
    occurredAt: z.string(),
  }),
  z.object({
    type: z.literal(CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.CONFLICTS_DETECTED),
    fieldKeys: z.array(CHARACTER_EDIT_FIELD_KEY_SCHEMA),
    occurredAt: z.string(),
  }),
  z.object({
    type: z.literal(CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.FAILED),
    message: z.string(),
    occurredAt: z.string(),
  }),
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
  if (
    patch.kind === CHARACTER_EDIT_PATCH_KINDS_CASES.TEXT ||
    patch.kind === CHARACTER_EDIT_PATCH_KINDS_CASES.STRING_LIST
  ) {
    return card.data[patch.fieldKey];
  }

  if (patch.kind === CHARACTER_EDIT_PATCH_KINDS_CASES.CUSTOM_FIELDS) {
    return card.data.extensions.custom_fields;
  }

  return card.data.character_book;
}

function applyPatch(card: CharacterCard, patch: iCharacterEditPatch) {
  if (patch.kind === CHARACTER_EDIT_PATCH_KINDS_CASES.TEXT) {
    card.data[patch.fieldKey] = patch.newValue;
    return;
  }

  if (patch.kind === CHARACTER_EDIT_PATCH_KINDS_CASES.STRING_LIST) {
    card.data[patch.fieldKey] = structuredClone(patch.newValue);
    return;
  }

  if (patch.kind === CHARACTER_EDIT_PATCH_KINDS_CASES.CUSTOM_FIELDS) {
    card.data.extensions.custom_fields = structuredClone(patch.newValue);
    return;
  }

  card.data.character_book = patch.newValue ? structuredClone(patch.newValue) : undefined;
}

function getProposalStatusAfterSettlingPatches(patches: iCharacterEditPatch[]) {
  const hasActivePatch = patches.some(
    (patch) =>
      patch.status === CHARACTER_EDIT_PATCH_STATUSES.PROPOSED ||
      patch.status === CHARACTER_EDIT_PATCH_STATUSES.APPLYING ||
      patch.status === CHARACTER_EDIT_PATCH_STATUSES.CONFLICT,
  );

  if (hasActivePatch) {
    return CHARACTER_EDIT_PROPOSAL_STATUSES.REVIEW;
  }

  const hasAppliedPatch = patches.some((patch) => patch.status === CHARACTER_EDIT_PATCH_STATUSES.APPLIED);
  return hasAppliedPatch ? CHARACTER_EDIT_PROPOSAL_STATUSES.APPLIED : CHARACTER_EDIT_PROPOSAL_STATUSES.REJECTED;
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
      patches.push({
        kind: CHARACTER_EDIT_PATCH_KINDS_CASES.TEXT,
        fieldKey,
        oldValue,
        newValue,
        status: CHARACTER_EDIT_PATCH_STATUSES.PROPOSED,
      });
    }
  });

  CHARACTER_EDIT_LIST_FIELD_KEY_ENUM.rawValues.forEach((fieldKey) => {
    const oldValue = baseCard.data[fieldKey];
    const newValue = proposedCard.data[fieldKey];

    if (!areValuesEqual(oldValue, newValue)) {
      patches.push({
        kind: CHARACTER_EDIT_PATCH_KINDS_CASES.STRING_LIST,
        fieldKey,
        oldValue: structuredClone(oldValue),
        newValue: structuredClone(newValue),
        status: CHARACTER_EDIT_PATCH_STATUSES.PROPOSED,
      });
    }
  });

  const oldCustomFields: CustomField[] = baseCard.data.extensions.custom_fields;
  const newCustomFields: CustomField[] = proposedCard.data.extensions.custom_fields;
  if (!areValuesEqual(oldCustomFields, newCustomFields)) {
    patches.push({
      kind: CHARACTER_EDIT_PATCH_KINDS_CASES.CUSTOM_FIELDS,
      fieldKey: CHARACTER_EDIT_FIELD_KEYS.CUSTOM_FIELDS,
      oldValue: structuredClone(oldCustomFields),
      newValue: structuredClone(newCustomFields),
      status: CHARACTER_EDIT_PATCH_STATUSES.PROPOSED,
    });
  }

  const oldCharacterBook: CharacterBook | undefined = baseCard.data.character_book;
  const newCharacterBook: CharacterBook | undefined = proposedCard.data.character_book;
  if (!areValuesEqual(oldCharacterBook, newCharacterBook)) {
    patches.push({
      kind: CHARACTER_EDIT_PATCH_KINDS_CASES.CHARACTER_BOOK,
      fieldKey: CHARACTER_EDIT_FIELD_KEYS.CHARACTER_BOOK,
      oldValue: oldCharacterBook ? structuredClone(oldCharacterBook) : undefined,
      newValue: newCharacterBook ? structuredClone(newCharacterBook) : undefined,
      status: CHARACTER_EDIT_PATCH_STATUSES.PROPOSED,
    });
  }

  return patches;
}

export function preserveAssistantProtectedFields(
  currentCard: CharacterCard,
  proposedCard: CharacterCard,
  fieldShouldAllowAssistantEditing: Readonly<Record<CharacterEditFieldKey, boolean>>,
) {
  const nextCard = structuredClone(proposedCard);

  CHARACTER_TEXT_FIELD_KEYS.forEach((fieldKey) => {
    if (!fieldShouldAllowAssistantEditing[fieldKey]) {
      nextCard.data[fieldKey] = currentCard.data[fieldKey];
    }
  });

  CHARACTER_EDIT_LIST_FIELD_KEY_ENUM.rawValues.forEach((fieldKey) => {
    if (!fieldShouldAllowAssistantEditing[fieldKey]) {
      nextCard.data[fieldKey] = structuredClone(currentCard.data[fieldKey]);
    }
  });

  if (!fieldShouldAllowAssistantEditing[CHARACTER_EDIT_FIELD_KEYS.CUSTOM_FIELDS]) {
    nextCard.data.extensions.custom_fields = structuredClone(currentCard.data.extensions.custom_fields);
  }

  if (!fieldShouldAllowAssistantEditing[CHARACTER_EDIT_FIELD_KEYS.CHARACTER_BOOK]) {
    nextCard.data.character_book = currentCard.data.character_book
      ? structuredClone(currentCard.data.character_book)
      : undefined;
  }

  return nextCard;
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
    status: CHARACTER_EDIT_PROPOSAL_STATUSES.REVIEW,
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
  if (event.type === CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.PATCHES_UPSERTED) {
    const incomingFieldKeys = new Set(event.patches.map((patch) => patch.fieldKey));
    return {
      ...proposal,
      patches: [...proposal.patches.filter((patch) => !incomingFieldKeys.has(patch.fieldKey)), ...event.patches],
      status: CHARACTER_EDIT_PROPOSAL_STATUSES.STREAMING,
      errorMessage: null,
      updatedAt: event.occurredAt,
    };
  }

  if (event.type === CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.REVIEW_REQUESTED) {
    return { ...proposal, status: CHARACTER_EDIT_PROPOSAL_STATUSES.REVIEW, updatedAt: event.occurredAt };
  }

  if (event.type === CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.FAILED) {
    return {
      ...proposal,
      status: CHARACTER_EDIT_PROPOSAL_STATUSES.FAILED,
      errorMessage: event.message,
      updatedAt: event.occurredAt,
    };
  }

  const fieldKeys = new Set(event.fieldKeys);
  let nextPatchStatus: CharacterEditPatchStatus;
  if (event.type === CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.APPLY_REQUESTED) {
    nextPatchStatus = CHARACTER_EDIT_PATCH_STATUSES.APPLYING;
  } else if (event.type === CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.APPLY_SUCCEEDED) {
    nextPatchStatus = CHARACTER_EDIT_PATCH_STATUSES.APPLIED;
  } else if (event.type === CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.PATCHES_REJECTED) {
    nextPatchStatus = CHARACTER_EDIT_PATCH_STATUSES.REJECTED;
  } else {
    nextPatchStatus = CHARACTER_EDIT_PATCH_STATUSES.CONFLICT;
  }

  const patches = proposal.patches.map((patch) =>
    fieldKeys.has(patch.fieldKey) ? { ...patch, status: nextPatchStatus } : patch,
  );

  if (event.type === CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.APPLY_REQUESTED) {
    return {
      ...proposal,
      patches,
      status: CHARACTER_EDIT_PROPOSAL_STATUSES.APPLYING,
      errorMessage: null,
      updatedAt: event.occurredAt,
    };
  }

  if (event.type === CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.CONFLICTS_DETECTED) {
    return {
      ...proposal,
      patches,
      status: CHARACTER_EDIT_PROPOSAL_STATUSES.CONFLICT,
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
        selectedFieldKeys.has(patch.fieldKey) &&
        !areValuesEqual(getPatchValue(currentCard, patch), patch.oldValue) &&
        !areValuesEqual(getPatchValue(currentCard, patch), patch.newValue),
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
        type: CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.CONFLICTS_DETECTED,
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
      type: CHARACTER_EDIT_PROPOSAL_EVENT_TYPES_CASES.APPLY_SUCCEEDED,
      fieldKeys: [...selectedFieldKeys],
      occurredAt,
    }),
    conflictFieldKeys: [],
  };
}
