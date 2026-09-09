import type { JSONContent } from '@tiptap/core';

import { EDITOR_MARK_TYPES, EDITOR_NODE_TYPES } from '@~/features/character-creator/lib/editor/editor-enums';

import type { iEditorSerializer } from './editor-contracts';

export interface iSerializedChatInput {
  text: string;
  templateIds: string[];
}

export function serializeChatInput(document: JSONContent): iSerializedChatInput {
  const templateIds: string[] = [];
  const textParts: string[] = [];

  const visit = (node: JSONContent) => {
    if (node.type === EDITOR_NODE_TYPES.TEXT && node.text) {
      const markedText = (node.marks ?? []).reduce((text, mark) => {
        if (mark.type === EDITOR_MARK_TYPES.BOLD) return `**${text}**`;
        if (mark.type === EDITOR_MARK_TYPES.ITALIC) return `*${text}*`;
        if (mark.type === EDITOR_MARK_TYPES.STRIKE) return `~~${text}~~`;
        return text;
      }, node.text);
      textParts.push(markedText);
      return;
    }

    if (node.type === EDITOR_NODE_TYPES.MENTION) {
      const label = typeof node.attrs?.label === 'string' ? node.attrs.label : '';
      const id = typeof node.attrs?.id === 'string' ? node.attrs.id : '';
      if (label) {
        textParts.push(`/${label}`);
      }
      if (id && !templateIds.includes(id) && templateIds.length < 4) {
        templateIds.push(id);
      }
      return;
    }

    node.content?.forEach(visit);
    if (node.type === EDITOR_NODE_TYPES.PARAGRAPH) {
      textParts.push('\n');
    }
  };

  visit(document);

  return {
    text: textParts.join('').replace(/\n+$/g, '').trim(),
    templateIds,
  };
}

export const CHAT_INPUT_EDITOR_SERIALIZER = {
  serialize: serializeChatInput,
} satisfies iEditorSerializer<JSONContent, iSerializedChatInput>;
