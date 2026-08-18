import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES } from '../../lib/assistant/character-assistant-contracts';
import { DiscoveryCardGrid } from './discovery-card-grid';

describe('DiscoveryCardGrid', () => {
  it('enables handoff from selected cards and includes their descriptions', async () => {
    const user = userEvent.setup();
    const onUseDirections = vi.fn();
    render(
      <DiscoveryCardGrid
        cards={[
          {
            id: 'direction-1',
            category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
            title: 'Quietly theatrical',
            description: 'Layer dry humor over carefully concealed anxiety.',
            sourceCardId: null,
            isUserAuthored: false,
          },
        ]}
        onUseDirections={onUseDirections}
      />,
    );

    const handoffButton = screen.getByRole('button', { name: 'Use these directions' });
    expect((handoffButton as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: /Quietly theatrical/ }));
    await user.click(handoffButton);

    expect(onUseDirections).toHaveBeenCalledOnce();
    expect(onUseDirections.mock.calls[0]?.[0]).toContain('Layer dry humor');
  });
});
