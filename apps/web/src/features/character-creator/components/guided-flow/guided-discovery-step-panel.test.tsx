import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GUIDED_STEP_DEFINITIONS, GUIDED_STEP_IDS } from '../../constants/guided-flow';
import { CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES } from '../../lib/character-assistant-contracts';
import type { iCharacterAssistantDiscoveryDirectionCategory } from '../../lib/character-assistant-contracts';
import { GuidedDiscoveryStepPanel } from './guided-discovery-step-panel';

const CATEGORY_SEQUENCE = [
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['relationship-dynamic'],
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario,
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
] as const;

describe('GuidedDiscoveryStepPanel recovery', () => {
  it('retries only failed categories so successful selected directions remain untouched', async () => {
    const failedCategories = [
      CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['relationship-dynamic'],
      CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
    ] as const;
    const failedCategorySet = new Set<iCharacterAssistantDiscoveryDirectionCategory>(failedCategories);
    const generationState = Object.fromEntries(
      CATEGORY_SEQUENCE.map((category) => [
        category,
        {
          isRunning: false,
          errorMessage: failedCategorySet.has(category) ? `Generation for ${category} failed.` : null,
        },
      ]),
    ) as Record<iCharacterAssistantDiscoveryDirectionCategory, { isRunning: boolean; errorMessage: string | null }>;
    const onRegenerateCategory = vi.fn(async () => undefined);
    const user = userEvent.setup();

    render(
      <GuidedDiscoveryStepPanel
        definition={GUIDED_STEP_DEFINITIONS[GUIDED_STEP_IDS.concept]}
        canContinue
        hasUnappliedProposals={false}
        isRunning={false}
        discoveryState={{
          originalPremise: 'A selected scenario must survive recovery.',
          cards: [
            {
              id: 'selected-scenario',
              category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario,
              title: 'Preserved scenario',
              description: 'A successful selected direction.',
              sourceCardId: null,
              isUserAuthored: false,
            },
          ],
          selectedCardIds: ['selected-scenario'],
          isReadyForHandoff: true,
        }}
        generationState={generationState}
        onContinue={vi.fn(async () => undefined)}
        onExit={vi.fn(async () => undefined)}
        onRegenerateCategory={onRegenerateCategory}
        onCancelGeneration={vi.fn()}
        onToggleSelection={vi.fn(async () => undefined)}
        onCreateCustomDirection={vi.fn(async () => undefined)}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Retry all' }));

    await waitFor(() => {
      expect(onRegenerateCategory).toHaveBeenCalledTimes(2);
    });
    expect(onRegenerateCategory).toHaveBeenNthCalledWith(1, failedCategories[0]);
    expect(onRegenerateCategory).toHaveBeenNthCalledWith(2, failedCategories[1]);
    expect(onRegenerateCategory).not.toHaveBeenCalledWith(CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario);
    expect(screen.getByRole('checkbox', { name: /Preserved scenario/i }).getAttribute('aria-checked')).toBe('true');
  });
});
