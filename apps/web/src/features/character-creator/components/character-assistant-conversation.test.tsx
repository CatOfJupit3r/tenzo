import type { UIMessage } from '@tanstack/ai-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createEmptyCharacterCard } from '../constants/card-defaults';
import { CHARACTER_ASSISTANT_TOOL_NAMES } from '../lib/assistant/character-assistant-contracts';
import { createCharacterEditProposal } from '../lib/proposals/character-edit-proposal';
import { CharacterAssistantConversation } from './character-assistant-conversation';

describe('CharacterAssistantConversation proposals', () => {
  it('renders text, list, and book diffs with per-patch actions', async () => {
    const user = userEvent.setup();
    const baseCard = createEmptyCharacterCard();
    baseCard.data.description = 'Old description';
    baseCard.data.tags = ['old-tag'];
    const proposedCard = structuredClone(baseCard);
    proposedCard.data.description = 'New description';
    proposedCard.data.tags = ['new-tag'];
    proposedCard.data.character_book = {
      name: 'Lore',
      extensions: {},
      entries: [],
    };
    const proposal = createCharacterEditProposal({
      characterId: 'character',
      baseCard,
      proposedCard,
      toolCallId: 'tool-call',
      summary: 'Coordinate the character details.',
    });
    const messages: UIMessage[] = [
      {
        id: 'assistant-message',
        role: 'assistant',
        createdAt: new Date('2026-08-14T00:00:00.000Z'),
        parts: [
          {
            type: 'tool-call',
            id: 'tool-call',
            name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
            arguments: '{}',
            state: 'complete',
            output: { proposal },
          },
        ],
      },
    ];
    const onApply = vi.fn();
    const onReject = vi.fn();
    const onJumpToField = vi.fn();
    render(
      <CharacterAssistantConversation
        messages={messages}
        proposals={[proposal]}
        isRunning={false}
        activityLabel={null}
        errorMessage={null}
        settledOutcomeRef={createRef<HTMLDivElement>()}
        onApply={onApply}
        onReject={onReject}
        onApplyAll={vi.fn()}
        onRejectAll={vi.fn()}
        onJumpToField={onJumpToField}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Description proposed' }));
    expect(screen.getByText('- Old description')).toBeTruthy();
    expect(screen.getByText('+ New description')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Tags proposed' }));
    expect(screen.getByText(/old-tag/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Character Book proposed' }));
    expect(screen.getByText(/"name": "Lore"/)).toBeTruthy();

    await user.click(screen.getAllByRole('button', { name: 'Apply' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Reject' })[1]);
    await user.click(screen.getByRole('button', { name: 'Jump to Character Book' }));
    expect(onApply).toHaveBeenCalledWith(proposal.id, ['description']);
    expect(onReject).toHaveBeenCalledWith(proposal.id, ['tags']);
    expect(onJumpToField).toHaveBeenCalledWith('character_book');
  });
});
