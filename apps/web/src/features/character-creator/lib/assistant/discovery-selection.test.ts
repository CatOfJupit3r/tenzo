import { describe, expect, it } from 'vitest';

import { CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES } from '@~/features/character-creator/lib/assistant/character-assistant-contracts';

import { formatDiscoverySelectionMessage } from './discovery-selection';

describe('discovery selection handoff', () => {
  it('formats selected directions as a deterministic user message', () => {
    const message = formatDiscoverySelectionMessage([
      {
        id: 'tone-1',
        category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.TONE,
        title: 'Velvet menace',
        description: 'Warm hospitality conceals escalating psychological danger.',
        sourceCardId: null,
        isUserAuthored: false,
      },
    ]);
    expect(message).toContain('tone: Velvet menace');
    expect(message).toContain('Record the concept');
  });
});
