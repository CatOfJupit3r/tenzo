import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES } from '../../lib/assistant/character-assistant-contracts';
import { DiscoveryCardGrid } from './discovery-card-grid';

vi.mock('../editor/markdown-field-editor', () => ({
  MarkdownFieldEditor: ({
    ariaLabel,
    value,
    onValueChange,
  }: {
    ariaLabel: string;
    value: string;
    onValueChange: (value: string) => unknown;
  }) => <textarea aria-label={ariaLabel} value={value} onChange={(event) => onValueChange(event.target.value)} />,
}));

describe('DiscoveryCardGrid', () => {
  it('enables handoff from selected cards and includes customized descriptions', async () => {
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
    await user.clear(screen.getByRole('textbox', { name: 'Customize Quietly theatrical' }));
    await user.type(screen.getByRole('textbox', { name: 'Customize Quietly theatrical' }), 'Use guarded warmth.');
    await user.click(handoffButton);

    expect(onUseDirections).toHaveBeenCalledOnce();
    expect(onUseDirections.mock.calls[0]?.[0]).toContain('Use guarded warmth.');
  });
});
