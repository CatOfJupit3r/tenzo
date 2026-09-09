import type { UIMessage } from '@tanstack/ai-react';

import { MESSAGE_ROLES } from '@~/features/character-creator/lib/generation/message-enums';

export function groupCharacterAssistantConversationMessages(messages: readonly UIMessage[]) {
  return messages.reduce<UIMessage[]>((groupedMessages, message) => {
    const previousMessage = groupedMessages.at(-1);
    if (message.role === MESSAGE_ROLES.USER || !previousMessage || previousMessage.role === MESSAGE_ROLES.USER) {
      groupedMessages.push({ ...message, parts: [...message.parts] });
      return groupedMessages;
    }

    previousMessage.parts = [...previousMessage.parts, ...message.parts];
    return groupedMessages;
  }, []);
}
