import type { iCharacterAssistantDiscoveryDirectionCard } from './character-assistant-contracts';

export function formatDiscoverySelectionMessage(cards: readonly iCharacterAssistantDiscoveryDirectionCard[]) {
  return [
    'Use these selected directions as the concept for my character:',
    ...cards.map((card) => `- ${card.category}: ${card.title} - ${card.description}`),
    'Record the concept and propose the strongest initial name and description.',
  ].join('\n');
}
