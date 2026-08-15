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
  it('renders markdown formatting and project macros in chat messages', async () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-message',
        role: 'assistant',
        createdAt: new Date('2026-08-14T00:00:00.000Z'),
        parts: [{ type: 'text', content: '**{{char}}** greets *{{user}}* with ~~formal~~ warmth.' }],
      },
    ];

    const { container } = render(
      <CharacterAssistantConversation
        messages={messages}
        proposals={[]}
        isRunning={false}
        activityLabel={null}
        errorMessage={null}
        settledOutcomeRef={createRef<HTMLDivElement>()}
        onApply={vi.fn()}
        onReject={vi.fn()}
        onApplyAll={vi.fn()}
        onRejectAll={vi.fn()}
      />,
    );

    await screen.findByText('{{char}}');
    expect(container.querySelector('strong .macro-chip-char')?.textContent).toBe('{{char}}');
    expect(container.querySelector('em .macro-chip-user')?.textContent).toBe('{{user}}');
    expect(container.querySelector('s')?.textContent).toBe('formal');
  });

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

  it('hides the stale tool payload after a proposal is settled', () => {
    const baseCard = createEmptyCharacterCard();
    const proposedCard = structuredClone(baseCard);
    proposedCard.data.name = 'Mira';
    const proposal = createCharacterEditProposal({
      characterId: 'character',
      baseCard,
      proposedCard,
      toolCallId: 'tool-call',
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

    render(
      <CharacterAssistantConversation
        messages={messages}
        proposals={[]}
        isRunning={false}
        activityLabel={null}
        errorMessage={null}
        settledOutcomeRef={createRef<HTMLDivElement>()}
        onApply={vi.fn()}
        onReject={vi.fn()}
        onApplyAll={vi.fn()}
        onRejectAll={vi.fn()}
      />,
    );

    expect(screen.queryByRole('region', { name: 'Assistant proposal' })).toBeNull();
  });

  it('does not repeat streamed text from the final structured output', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-message',
        role: 'assistant',
        createdAt: new Date('2026-08-14T00:00:00.000Z'),
        parts: [
          { type: 'text', content: 'The character is ready.' },
          {
            type: 'structured-output',
            status: 'complete',
            raw: '{}',
            data: { assistantMessage: 'The character is ready.', followUpSuggestions: [] },
          },
        ],
      },
    ];

    render(
      <CharacterAssistantConversation
        messages={messages}
        proposals={[]}
        isRunning={false}
        activityLabel={null}
        errorMessage={null}
        settledOutcomeRef={createRef<HTMLDivElement>()}
        onApply={vi.fn()}
        onReject={vi.fn()}
        onApplyAll={vi.fn()}
        onRejectAll={vi.fn()}
      />,
    );

    expect(screen.getAllByText('The character is ready.')).toHaveLength(1);
  });

  it('presents internal assistant and tool steps as one assistant turn', () => {
    const messages: UIMessage[] = [
      {
        id: 'user-message',
        role: 'user',
        createdAt: new Date('2026-08-14T00:00:00.000Z'),
        parts: [{ type: 'text', content: 'Create a character.' }],
      },
      {
        id: 'assistant-tool-call',
        role: 'assistant',
        createdAt: new Date('2026-08-14T00:00:01.000Z'),
        parts: [{ type: 'text', content: 'I will build the concept.' }],
      },
      {
        id: 'tool-result',
        role: 'assistant',
        createdAt: new Date('2026-08-14T00:00:02.000Z'),
        parts: [{ type: 'tool-result', toolCallId: 'tool-call', content: 'Complete', state: 'complete' }],
      },
      {
        id: 'assistant-result',
        role: 'assistant',
        createdAt: new Date('2026-08-14T00:00:03.000Z'),
        parts: [{ type: 'text', content: 'The character is ready.' }],
      },
    ];

    render(
      <CharacterAssistantConversation
        messages={messages}
        proposals={[]}
        isRunning={false}
        activityLabel={null}
        errorMessage={null}
        settledOutcomeRef={createRef<HTMLDivElement>()}
        onApply={vi.fn()}
        onReject={vi.fn()}
        onApplyAll={vi.fn()}
        onRejectAll={vi.fn()}
      />,
    );

    expect(screen.getAllByLabelText('User message')).toHaveLength(1);
    expect(screen.getAllByLabelText('Assistant message')).toHaveLength(1);
    expect(screen.getByText('I will build the concept.')).toBeTruthy();
    expect(screen.getByText('The character is ready.')).toBeTruthy();
  });
});
