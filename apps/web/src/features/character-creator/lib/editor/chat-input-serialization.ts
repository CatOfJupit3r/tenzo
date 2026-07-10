import type { JSONContent } from '@tiptap/core';

export interface iSerializedChatInput {
  text: string;
  templateIds: string[];
}

export function serializeChatInput(document: JSONContent): iSerializedChatInput {
  const templateIds: string[] = [];
  const textParts: string[] = [];

  const visit = (node: JSONContent) => {
    if (node.type === 'text' && node.text) {
      textParts.push(node.text);
      return;
    }

    if (node.type === 'mention') {
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
    if (node.type === 'paragraph') {
      textParts.push('\n');
    }
  };

  visit(document);

  return {
    text: textParts.join('').replace(/\n+$/g, '').trim(),
    templateIds,
  };
}
