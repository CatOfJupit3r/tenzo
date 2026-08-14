import { useState } from 'react';

import { Button } from '@~/components/ui/button/button';
import { cn } from '@~/lib/utils';

import type { iCharacterAssistantDiscoveryDirectionCard } from '../../lib/assistant/character-assistant-contracts';
import { formatDiscoverySelectionMessage } from '../../lib/assistant/discovery-selection';
import { MarkdownFieldEditor } from '../editor/markdown-field-editor';

export function DiscoveryCardGrid({
  cards,
  onUseDirections,
}: {
  cards: readonly iCharacterAssistantDiscoveryDirectionCard[];
  onUseDirections: (message: string) => unknown;
}) {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const selectedCards = cards
    .filter((card) => selectedCardIds.includes(card.id))
    .map((card) => ({
      ...card,
      description: descriptions[card.id] ?? card.description,
      isUserAuthored: descriptions[card.id] !== undefined || card.isUserAuthored,
    }));

  return (
    <section className="grid gap-3" aria-label="Character directions">
      <div className="grid gap-2 sm:grid-cols-2">
        {cards.map((card) => {
          const isSelected = selectedCardIds.includes(card.id);
          return (
            <article
              key={card.id}
              className={cn('grid gap-2 rounded-lg border p-3', isSelected && 'border-primary bg-primary/5')}
            >
              <button
                type="button"
                className="text-left"
                aria-pressed={isSelected}
                onClick={() =>
                  setSelectedCardIds((current) =>
                    current.includes(card.id) ? current.filter((id) => id !== card.id) : [...current, card.id],
                  )
                }
              >
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {card.category.replaceAll('-', ' ')}
                </span>
                <h4 className="mt-1 text-sm font-medium">{card.title}</h4>
              </button>
              {isSelected ? (
                <MarkdownFieldEditor
                  fieldId={`direction-${card.id}`}
                  value={descriptions[card.id] ?? card.description}
                  rows={3}
                  ariaLabel={`Customize ${card.title}`}
                  onValueChange={(value) => setDescriptions((current) => ({ ...current, [card.id]: value }))}
                />
              ) : (
                <p className="text-xs text-muted-foreground">{card.description}</p>
              )}
            </article>
          );
        })}
      </div>
      <Button
        type="button"
        size="sm"
        disabled={selectedCards.length === 0}
        onClick={() => onUseDirections(formatDiscoverySelectionMessage(selectedCards))}
      >
        Use these directions
      </Button>
    </section>
  );
}
