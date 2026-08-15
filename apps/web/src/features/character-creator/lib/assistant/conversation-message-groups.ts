import type { UIMessage } from '@tanstack/ai-react';

export function groupCharacterAssistantConversationMessages(messages: readonly UIMessage[]) {
  return messages.reduce<UIMessage[]>((groupedMessages, message) => {
    const previousMessage = groupedMessages.at(-1);
    if (message.role === 'user' || !previousMessage || previousMessage.role === 'user') {
      groupedMessages.push({ ...message, parts: [...message.parts] });
      return groupedMessages;
    }

    previousMessage.parts = [...previousMessage.parts, ...message.parts];
    return groupedMessages;
  }, []);
}
