import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { iCharacterAssistantSession } from '../../lib/assistant/character-assistant-session';
import { CharacterAssistantConversationMenu } from './character-assistant-conversation-menu';

function createSession(id: string, message: string, updatedAt: string): iCharacterAssistantSession {
  return {
    id,
    characterId: 'character-1',
    messages: message ? [{ id: `${id}-message`, role: 'user', parts: [{ type: 'text', content: message }] }] : [],
    proposals: [],
    lastRecordedConceptToolCallId: null,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('CharacterAssistantConversationMenu', () => {
  it('switches, creates, and confirms deletion of character conversations', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onSelect = vi.fn();
    const sessions = [
      createSession('session-2', 'Refine the character voice', '2026-08-15T12:00:00.000Z'),
      createSession('session-1', 'Build a mysterious detective', '2026-08-14T12:00:00.000Z'),
    ];

    render(
      <CharacterAssistantConversationMenu
        activeSessionId="session-2"
        isDisabled={false}
        sessions={sessions}
        onCreate={onCreate}
        onDelete={onDelete}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Manage conversations' }));
    expect(screen.getByText('Only for this character')).toBeTruthy();
    const conversationButton = screen.getByText('Build a mysterious detective').closest('button');
    if (!conversationButton) throw new Error('Conversation button was not rendered.');
    fireEvent.click(conversationButton);
    expect(onSelect).toHaveBeenCalledWith('session-1');

    fireEvent.click(screen.getByRole('button', { name: 'Manage conversations' }));
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole('button', { name: 'Manage conversations' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Refine the character voice' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('Your character is not affected.');
    fireEvent.click(screen.getByRole('button', { name: 'Delete conversation' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('session-2'));
  });
});
