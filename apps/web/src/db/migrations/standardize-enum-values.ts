import type { Transaction } from 'dexie';

import { CHARACTER_LIBRARY_SOURCES } from '../../features/character-creator/lib/cards/character-library';
import { MESSAGE_PART_TYPES_CASES } from '../../features/character-creator/lib/generation/message-enums';
import {
  CHARACTER_EDIT_PATCH_STATUS_ENUM,
  CHARACTER_EDIT_PROPOSAL_STATUS_ENUM,
} from '../../features/character-creator/lib/proposals/character-edit-proposal';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStoredProposalEnumValues(value: unknown) {
  if (!isRecord(value)) return value;
  const status = CHARACTER_EDIT_PROPOSAL_STATUS_ENUM.safeParse(
    typeof value.status === 'string' ? value.status.toUpperCase() : value.status,
  );
  return {
    ...value,
    ...(status.success ? { status: status.value } : {}),
    ...(Array.isArray(value.patches)
      ? {
          patches: value.patches.map((patch: unknown) => {
            if (!isRecord(patch)) return patch;
            const patchStatus = CHARACTER_EDIT_PATCH_STATUS_ENUM.safeParse(
              typeof patch.status === 'string' ? patch.status.toUpperCase() : patch.status,
            );
            return patchStatus.success ? { ...patch, status: patchStatus.value } : patch;
          }),
        }
      : {}),
  };
}

function normalizeStoredToolResultEnumValues(value: unknown): unknown {
  if (isRecord(value) && isRecord(value.proposal))
    return { ...value, proposal: normalizeStoredProposalEnumValues(value.proposal) };
  return value;
}

function normalizeStoredMessageEnumValues(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.parts)) return value;
  return {
    ...value,
    parts: value.parts.map((part: unknown) => {
      if (!isRecord(part)) return part;
      if (part.type === MESSAGE_PART_TYPES_CASES.TOOL_CALL && 'output' in part) {
        return { ...part, output: normalizeStoredToolResultEnumValues(part.output) };
      }
      if (part.type === MESSAGE_PART_TYPES_CASES.TOOL_RESULT && typeof part.content === 'string') {
        try {
          const content: unknown = JSON.parse(part.content);
          const upgraded = normalizeStoredToolResultEnumValues(content);
          return upgraded === content ? part : { ...part, content: JSON.stringify(upgraded) };
        } catch {
          return part;
        }
      }
      return part;
    }),
  };
}

function normalizeStoredSessionEnumValues(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...value,
    ...(Array.isArray(value.proposals) ? { proposals: value.proposals.map(normalizeStoredProposalEnumValues) } : {}),
    ...(Array.isArray(value.messages) ? { messages: value.messages.map(normalizeStoredMessageEnumValues) } : {}),
  };
}

export function upgradeLegacySessionCollectionJson(value: string | null) {
  if (!value) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return value;
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(parsed).map(([key, entry]) => [
          key,
          isRecord(entry) ? { ...entry, data: normalizeStoredSessionEnumValues(entry.data) } : entry,
        ]),
      ),
    );
  } catch {
    return value;
  }
}

export async function standardizeStoredEnumValues(transaction: Transaction) {
  await transaction
    .table<Record<string, unknown>>('characterLibrary')
    .toCollection()
    .modify((character) => {
      if (character.source === 'manual') character.source = CHARACTER_LIBRARY_SOURCES.MANUAL;
    });
  await transaction
    .table<Record<string, unknown>>('characterAssistantSessions')
    .toCollection()
    .modify((session) => {
      Object.assign(session, normalizeStoredSessionEnumValues(session));
    });
}
