import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GUIDED_STEP_DEFINITIONS, GUIDED_STEP_IDS } from '../../constants/guided-flow';
import { GuidedStepPanel } from './guided-step-panel';

describe('GuidedStepPanel Review gate', () => {
  it('blocks completion and exposes proposal resolution actions', async () => {
    const onContinue = vi.fn(async () => undefined);
    const onApplyAllProposals = vi.fn(async () => undefined);
    const onRejectAllProposals = vi.fn(async () => undefined);
    const user = userEvent.setup();

    render(
      <GuidedStepPanel
        definition={GUIDED_STEP_DEFINITIONS[GUIDED_STEP_IDS.review]}
        canContinue={false}
        isRunning={false}
        hasUnappliedProposals
        onContinue={onContinue}
        onSkip={vi.fn(async () => undefined)}
        onExit={vi.fn(async () => undefined)}
        onApplyAllProposals={onApplyAllProposals}
        onRejectAllProposals={onRejectAllProposals}
        onUsePrompt={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('Resolve proposed changes to finish');
    expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('disabled')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Apply all' }));
    await user.click(screen.getByRole('button', { name: 'Reject all' }));

    expect(onApplyAllProposals).toHaveBeenCalledOnce();
    expect(onRejectAllProposals).toHaveBeenCalledOnce();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('makes completion available after proposals settle', async () => {
    const onContinue = vi.fn(async () => undefined);
    const user = userEvent.setup();

    render(
      <GuidedStepPanel
        definition={GUIDED_STEP_DEFINITIONS[GUIDED_STEP_IDS.review]}
        canContinue
        isRunning={false}
        hasUnappliedProposals={false}
        onContinue={onContinue}
        onSkip={vi.fn(async () => undefined)}
        onExit={vi.fn(async () => undefined)}
        onApplyAllProposals={vi.fn(async () => undefined)}
        onRejectAllProposals={vi.fn(async () => undefined)}
        onUsePrompt={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
