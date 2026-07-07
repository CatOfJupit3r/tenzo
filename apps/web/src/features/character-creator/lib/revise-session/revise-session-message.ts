import type { UIMessage } from 'ai';

import type { iGenerationMessage } from '../prompt/generation-contracts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

export function extractUiMessageText(message: Pick<UIMessage, 'parts'> & { content?: unknown }) {
  const textParts = Array.isArray(message.parts)
    ? message.parts.flatMap((part) => {
        if (!isRecord(part) || part.type !== 'text') {
          return [];
        }

        return typeof part.text === 'string' ? [part.text] : [];
      })
    : [];
  const textFromParts = textParts.join('');

  if (textFromParts.trim()) {
    return textFromParts;
  }

  return typeof message.content === 'string' ? message.content : '';
}

export function toGenerationConversationMessages(messages: UIMessage[]): iGenerationMessage[] {
  return messages.reduce<iGenerationMessage[]>((conversationMessages, message) => {
    if (message.role !== 'user' && message.role !== 'assistant' && message.role !== 'system') {
      return conversationMessages;
    }

    const content = extractUiMessageText(message).trim();

    if (!content) {
      return conversationMessages;
    }

    conversationMessages.push({
      role: message.role,
      content,
    });

    return conversationMessages;
  }, []);
}
