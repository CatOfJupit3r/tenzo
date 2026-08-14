import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { GUIDED_STEP_IDS } from '../constants/guided-flow';
import { CHARACTER_ASSISTANT_MESSAGE_ROLES } from '../lib/character-assistant-contracts';
import type { iCharacterAssistantMessage } from '../lib/character-assistant-contracts';
import { CHARACTER_EDIT_PATCH_STATUSES, CHARACTER_EDIT_PROPOSAL_STATUSES } from '../lib/character-edit-proposal';
import type { iCharacterEditProposal } from '../lib/character-edit-proposal';
import { CharacterAssistantConversation } from './character-assistant-conversation';

const messages = [
  {
    id: 'concept-user',
    role: CHARACTER_ASSISTANT_MESSAGE_ROLES.user,
    content: 'A lunar archivist.',
    createdAt: '2026-08-13T10:00:00.000Z',
    guidedStepId: GUIDED_STEP_IDS.concept,
  },
  {
    id: 'concept-assistant',
    role: CHARACTER_ASSISTANT_MESSAGE_ROLES.assistant,
    content: 'The concept is ready.',
    createdAt: '2026-08-13T10:00:01.000Z',
    guidedStepId: GUIDED_STEP_IDS.concept,
  },
  {
    id: 'appearance-user',
    role: CHARACTER_ASSISTANT_MESSAGE_ROLES.user,
    content: 'Silver hair and ink-stained hands.',
    createdAt: '2026-08-13T10:01:00.000Z',
    guidedStepId: GUIDED_STEP_IDS.appearance,
  },
  {
    id: 'review-assistant',
    role: CHARACTER_ASSISTANT_MESSAGE_ROLES.assistant,
    content: 'The final review is coherent.',
    createdAt: '2026-08-13T10:02:00.000Z',
    guidedStepId: GUIDED_STEP_IDS.review,
  },
] satisfies iCharacterAssistantMessage[];

const conceptProposal = {
  id: 'concept-proposal',
  characterId: 'character-1',
  baseRevision: 'revision-1',
  patches: [
    {
      kind: 'text',
      fieldKey: 'name',
      oldValue: '',
      newValue: 'Mira',
      status: CHARACTER_EDIT_PATCH_STATUSES.proposed,
    },
  ],
  status: CHARACTER_EDIT_PROPOSAL_STATUSES.review,
  summary: 'Name the archivist.',
  guidedStepId: GUIDED_STEP_IDS.concept,
  errorMessage: null,
  createdAt: '2026-08-13T10:00:01.000Z',
  updatedAt: '2026-08-13T10:00:01.000Z',
} satisfies iCharacterEditProposal;

function renderConversation(currentGuidedStepId = GUIDED_STEP_IDS.appearance) {
  const onApply = vi.fn();
  const view = render(
    <CharacterAssistantConversation
      messages={messages}
      proposals={[conceptProposal]}
      currentGuidedStepId={currentGuidedStepId}
      isGuided
      isRunning={false}
      activityLabel={null}
      errorMessage={null}
      settledOutcomeRef={createRef<HTMLDivElement>()}
      onApply={onApply}
      onReject={vi.fn()}
      onApplyAll={vi.fn()}
      onRejectAll={vi.fn()}
    />,
  );

  return { ...view, onApply };
}

describe('CharacterAssistantConversation guided history', () => {
  it('groups exchanges by step and keeps only the selected step expanded by default', async () => {
    const user = userEvent.setup();
    const { rerender } = renderConversation();

    expect(screen.getByRole('region', { name: 'Appearance conversation' }).textContent).toContain(
      'Silver hair and ink-stained hands.',
    );
    expect(screen.queryByText('The concept is ready.')).toBeNull();
    expect(screen.queryByText('The final review is coherent.')).toBeNull();

    const disclosure = screen.getByRole('button', { name: 'Show previous steps' });
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    await user.click(disclosure);

    expect(screen.getByRole('region', { name: 'Concept conversation' }).textContent).toContain('The concept is ready.');
    expect(screen.getByRole('region', { name: 'Review conversation' }).textContent).toContain(
      'The final review is coherent.',
    );

    rerender(
      <CharacterAssistantConversation
        messages={messages}
        proposals={[conceptProposal]}
        currentGuidedStepId={GUIDED_STEP_IDS.concept}
        isGuided
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

    expect(screen.getByRole('region', { name: 'Concept conversation' }).textContent).toContain('The concept is ready.');
    expect(screen.queryByText('Silver hair and ink-stained hands.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show previous steps' }).getAttribute('aria-expanded')).toBe('false');

    await user.click(screen.getByRole('button', { name: 'Show previous steps' }));
    expect(screen.getByText('Silver hair and ink-stained hands.')).not.toBeNull();
    expect(screen.getByText('The final review is coherent.')).not.toBeNull();
  });

  it('retains proposal actions inside disclosed step history', async () => {
    const user = userEvent.setup();
    const { onApply } = renderConversation();

    expect(screen.queryByText('Name the archivist.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show previous steps' }));

    const conceptGroup = screen.getByRole('region', { name: 'Concept conversation' });
    expect(within(conceptGroup).getByText('Name the archivist.')).not.toBeNull();
    await user.click(within(conceptGroup).getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledWith('concept-proposal', ['name']);
  });
});
