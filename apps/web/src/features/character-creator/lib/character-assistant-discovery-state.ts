import {
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES,
  CHARACTER_ASSISTANT_DISCOVERY_STATE_DEFAULT,
  CHARACTER_ASSISTANT_DISCOVERY_STATE_SCHEMA,
} from './character-assistant-contracts';
import type {
  iCharacterAssistantDiscoveryDirectionCard,
  iCharacterAssistantDiscoveryDirectionCategory,
  iCharacterAssistantDiscoveryState,
} from './character-assistant-contracts';

const DISCOVERY_CATEGORY_SEQUENCE = Object.values(CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES);

function normalizeDiscoverySelection(state: iCharacterAssistantDiscoveryState): iCharacterAssistantDiscoveryState {
  return CHARACTER_ASSISTANT_DISCOVERY_STATE_SCHEMA.parse(state);
}

export function sanitizeCharacterAssistantDiscoveryState(value: unknown): iCharacterAssistantDiscoveryState {
  const result = CHARACTER_ASSISTANT_DISCOVERY_STATE_SCHEMA.safeParse(value);
  return result.success ? result.data : CHARACTER_ASSISTANT_DISCOVERY_STATE_DEFAULT;
}

export function replaceGeneratedDiscoveryCardsByCategory(
  discoveryState: iCharacterAssistantDiscoveryState,
  category: iCharacterAssistantDiscoveryDirectionCategory,
  generatedCards: readonly iCharacterAssistantDiscoveryDirectionCard[],
): iCharacterAssistantDiscoveryState {
  const sanitizedIncomingCards = generatedCards
    .filter((card) => card.category === category)
    .filter((card) => card.sourceCardId === null)
    .slice(0, 3)
    .map((card) => ({
      ...card,
      sourceCardId: null,
      isUserAuthored: false,
    }));

  const nextCards = discoveryState.cards
    .filter((card) => card.category !== category || card.isUserAuthored || card.sourceCardId !== null)
    .concat(sanitizedIncomingCards);

  return normalizeDiscoverySelection({
    ...discoveryState,
    cards: nextCards,
    selectedCardIds: discoveryState.selectedCardIds,
  });
}

export function toggleDirectionCardSelection(
  discoveryState: iCharacterAssistantDiscoveryState,
  cardId: string,
): iCharacterAssistantDiscoveryState {
  const shouldSelect = !discoveryState.selectedCardIds.includes(cardId);

  const selectedCardIds = shouldSelect
    ? [...discoveryState.selectedCardIds, cardId]
    : discoveryState.selectedCardIds.filter((id) => id !== cardId);

  return normalizeDiscoverySelection({
    ...discoveryState,
    selectedCardIds,
  });
}

export function createCustomizedDirectionCard(
  discoveryState: iCharacterAssistantDiscoveryState,
  sourceCardId: string,
  nextCard: Pick<iCharacterAssistantDiscoveryDirectionCard, 'id' | 'title' | 'description'>,
): iCharacterAssistantDiscoveryState {
  const sourceCard = discoveryState.cards.find((card) => card.id === sourceCardId);

  if (!sourceCard) {
    return discoveryState;
  }

  const isSourceSelected = discoveryState.selectedCardIds.includes(sourceCardId);
  const userAuthoredCard: iCharacterAssistantDiscoveryDirectionCard = {
    id: nextCard.id,
    category: sourceCard.category,
    title: nextCard.title,
    description: nextCard.description,
    sourceCardId,
    isUserAuthored: true,
  };
  const selectedCardIds = isSourceSelected
    ? discoveryState.selectedCardIds.filter((cardId) => cardId !== sourceCardId).concat([nextCard.id])
    : [...discoveryState.selectedCardIds, nextCard.id];

  return normalizeDiscoverySelection({
    ...discoveryState,
    cards: [...discoveryState.cards, userAuthoredCard],
    selectedCardIds,
  });
}

export function removeStaleDirectionCardSelections(
  discoveryState: iCharacterAssistantDiscoveryState,
): iCharacterAssistantDiscoveryState {
  return normalizeDiscoverySelection({
    ...discoveryState,
    selectedCardIds: discoveryState.selectedCardIds,
  });
}

export type iCharacterAssistantDiscoveryHandoffSummary = Record<
  iCharacterAssistantDiscoveryDirectionCategory,
  iCharacterAssistantDiscoveryDirectionCard[]
>;

export function buildDeterministicDiscoveryHandoffSummary(
  discoveryState: iCharacterAssistantDiscoveryState,
): iCharacterAssistantDiscoveryHandoffSummary {
  const selectedCardIds = new Set(discoveryState.selectedCardIds);

  const summary = DISCOVERY_CATEGORY_SEQUENCE.reduce(
    (acc, category) => ({
      ...acc,
      [category]: [],
    }),
    {} as iCharacterAssistantDiscoveryHandoffSummary,
  );

  discoveryState.cards.forEach((card) => {
    if (selectedCardIds.has(card.id)) {
      summary[card.category].push(card);
    }
  });

  return summary;
}
