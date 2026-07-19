import { useMemo, useState } from 'react';
import { LuArrowRight, LuLoaderCircle, LuRotateCcw } from 'react-icons/lu';

import { Button } from '@~/components/ui/button/button';
import { Checkbox } from '@~/components/ui/checkbox';
import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';
import { Textarea } from '@~/components/ui/textarea';

import type { iGuidedStepDefinition } from '../../constants/guided-flow';
import { CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES } from '../../lib/character-assistant-contracts';
import type {
  iCharacterAssistantDiscoveryDirectionCard,
  iCharacterAssistantDiscoveryDirectionCategory,
  iCharacterAssistantDiscoveryState,
} from '../../lib/character-assistant-contracts';
import { buildDeterministicDiscoveryHandoffSummary } from '../../lib/character-assistant-discovery-state';

interface iGuidedDiscoveryCategoryState {
  isRunning: boolean;
  errorMessage: string | null;
}

interface iGuidedDiscoveryStepPanelProps {
  definition: iGuidedStepDefinition;
  canContinue: boolean;
  hasUnappliedProposals: boolean;
  isRunning: boolean;
  discoveryState: iCharacterAssistantDiscoveryState;
  generationState: Record<iCharacterAssistantDiscoveryDirectionCategory, iGuidedDiscoveryCategoryState>;
  onContinue: () => Promise<unknown>;
  onExit: () => Promise<unknown>;
  onRegenerateCategory: (category: iCharacterAssistantDiscoveryDirectionCategory) => Promise<void>;
  onCancelGeneration: (category: iCharacterAssistantDiscoveryDirectionCategory) => void;
  onToggleSelection: (cardId: string) => Promise<void>;
  onCreateCustomDirection: (sourceCardId: string, title: string, description: string) => Promise<void>;
}

const DISCOVERY_CATEGORY_SEQUENCE = [
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['relationship-dynamic'],
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario,
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
] as const;

const CATEGORY_LABELS: Record<iCharacterAssistantDiscoveryDirectionCategory, string> = {
  [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept']]: 'Character concept',
  [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['relationship-dynamic']]: 'Relationship dynamic',
  [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario]: 'Scenario',
  [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone]: 'Tone',
};

function runAction(action: () => Promise<unknown>) {
  action().catch(() => undefined);
}

export function GuidedDiscoveryStepPanel({
  definition,
  canContinue,
  hasUnappliedProposals,
  isRunning,
  discoveryState,
  generationState,
  onContinue,
  onExit,
  onRegenerateCategory,
  onCancelGeneration,
  onToggleSelection,
  onCreateCustomDirection,
}: iGuidedDiscoveryStepPanelProps) {
  const [isConfirmingContinue, setIsConfirmingContinue] = useState(false);
  const [editingCardId, setEditingCardId] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const handoffSummary = useMemo(() => buildDeterministicDiscoveryHandoffSummary(discoveryState), [discoveryState]);
  const hasHandoffSummary = Object.values(handoffSummary).some((cards) => cards.length > 0);
  const failedCategories = DISCOVERY_CATEGORY_SEQUENCE.filter((category) => generationState[category].errorMessage);
  const isGeneratingAnyCategory = DISCOVERY_CATEGORY_SEQUENCE.some((category) => generationState[category].isRunning);
  const selectedCardIds = useMemo(() => new Set(discoveryState.selectedCardIds), [discoveryState.selectedCardIds]);
  const cardsByCategory = useMemo(() => {
    const grouped = DISCOVERY_CATEGORY_SEQUENCE.reduce(
      (acc, category) => {
        acc[category] = [];
        return acc;
      },
      {} as Record<iCharacterAssistantDiscoveryDirectionCategory, iCharacterAssistantDiscoveryDirectionCard[]>,
    );

    discoveryState.cards.forEach((card) => {
      if (!grouped[card.category]) {
        grouped[card.category] = [];
      }

      grouped[card.category].push(card);
    });

    return grouped;
  }, [discoveryState.cards]);

  const setActiveCustomCard = (card: iCharacterAssistantDiscoveryDirectionCard) => {
    setEditingCardId(card.id);
    setEditingTitle(card.title);
    setEditingDescription(card.description);
  };

  const handleContinue = async () => {
    if (hasUnappliedProposals && !isConfirmingContinue) {
      setIsConfirmingContinue(true);
      return;
    }

    await onContinue();
    setIsConfirmingContinue(false);
  };

  return (
    <section className="grid gap-3 rounded-xl border bg-primary/5 p-4" aria-label="Discovery guided step">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Guided setup</p>
          <h2 className="text-lg font-semibold">{definition.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{definition.userPrompt}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Select one or more directions from any category to continue.
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => runAction(onExit)}>
          Exit guided mode
        </Button>
      </div>

      <div className="rounded-md border bg-background/70 p-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Original premise</p>
        <p className="mt-1 text-sm">{discoveryState.originalPremise}</p>
      </div>

      <div
        aria-live="polite"
        aria-atomic="true"
        className="rounded-md border border-dashed border-border bg-muted/20 p-3"
      >
        <p className="text-sm font-medium">Discovery generation status</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {DISCOVERY_CATEGORY_SEQUENCE.map((category) => {
            const state = generationState[category];
            const hasCards = cardsByCategory[category]?.length > 0;

            if (state.isRunning) {
              return <li key={category}>Generating {CATEGORY_LABELS[category]}.</li>;
            }

            if (state.errorMessage) {
              return (
                <li key={category} className="text-destructive">
                  <span className="font-medium">Could not generate {CATEGORY_LABELS[category]}:</span>{' '}
                  {state.errorMessage}
                </li>
              );
            }

            if (!hasCards) {
              return (
                <li key={category} className="text-muted-foreground">
                  No {CATEGORY_LABELS[category]} directions yet.
                </li>
              );
            }

            return null;
          })}
        </ul>
        {failedCategories.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isGeneratingAnyCategory}
              onClick={() => {
                runAction(async () => {
                  await Promise.allSettled(failedCategories.map(async (category) => onRegenerateCategory(category)));
                });
              }}
            >
              <LuRotateCcw className="size-4" />
              Retry all
            </Button>
            <p className="text-xs text-muted-foreground">
              If connection errors continue, review endpoint, model, and API key in Settings.
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4">
        {DISCOVERY_CATEGORY_SEQUENCE.map((category) => {
          const cards = cardsByCategory[category] ?? [];
          const isGenerating = generationState[category]?.isRunning;
          const errorMessage = generationState[category]?.errorMessage;

          return (
            <section
              key={category}
              aria-label={`${CATEGORY_LABELS[category]} directions`}
              className="rounded-md border border-border p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium">{CATEGORY_LABELS[category]}</h3>
                <div className="flex gap-2">
                  {isGenerating ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onCancelGeneration(category)}
                      aria-label={`Cancel ${CATEGORY_LABELS[category]} regeneration`}
                    >
                      <LuLoaderCircle className="size-4 animate-spin" />
                      Stop
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isGenerating}
                    onClick={() => {
                      runAction(async () => onRegenerateCategory(category));
                    }}
                    aria-label={`Regenerate ${CATEGORY_LABELS[category]} directions`}
                  >
                    <LuRotateCcw className="size-4" />
                    Regenerate
                  </Button>
                </div>
              </div>

              {errorMessage ? (
                <div
                  role="alert"
                  className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive"
                >
                  {errorMessage}
                </div>
              ) : null}

              {cards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No directions yet.</p>
              ) : (
                <div className="grid gap-2">
                  {cards.map((card) => {
                    const cardId = `${category}-${card.id}`;
                    const isSelected = selectedCardIds.has(card.id);
                    const canEdit = !card.isUserAuthored;

                    return (
                      <div key={card.id} className="space-y-2 rounded-lg border border-border bg-muted/10 p-3 text-sm">
                        <label
                          htmlFor={cardId}
                          className="flex flex-wrap items-start gap-3 rounded-md text-sm text-left"
                        >
                          <Checkbox
                            checked={isSelected}
                            id={cardId}
                            onCheckedChange={() => {
                              void onToggleSelection(card.id);
                            }}
                            disabled={isGenerating}
                            aria-label={`${isSelected ? 'Unselect' : 'Select'} ${card.title}`}
                          />
                          <div className="min-w-0">
                            <p className="font-medium">{card.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
                          </div>
                        </label>
                        {canEdit ? (
                          <div className="pl-8">
                            {editingCardId === card.id ? (
                              <div className="grid gap-2">
                                <Label htmlFor={`custom-title-${card.id}`}>Custom title</Label>
                                <Input
                                  id={`custom-title-${card.id}`}
                                  value={editingTitle}
                                  onChange={(event) => setEditingTitle(event.target.value)}
                                />
                                <Label htmlFor={`custom-description-${card.id}`}>Custom description</Label>
                                <Textarea
                                  id={`custom-description-${card.id}`}
                                  value={editingDescription}
                                  onChange={(event) => setEditingDescription(event.target.value)}
                                  className="h-20"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                      const nextTitle = editingTitle.trim();
                                      const nextDescription = editingDescription.trim();
                                      if (!nextTitle || !nextDescription) {
                                        return;
                                      }

                                      void onCreateCustomDirection(card.id, nextTitle, nextDescription);
                                      setEditingCardId('');
                                      setEditingTitle('');
                                      setEditingDescription('');
                                    }}
                                  >
                                    Save custom variant
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingCardId('')}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setActiveCustomCard(card)}
                              >
                                Customize direction
                              </Button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {hasHandoffSummary ? (
        <section className="rounded-md border bg-muted/30 p-3">
          <h3 className="mb-2 text-sm font-medium">Selected directions</h3>
          <div className="grid gap-3">
            {DISCOVERY_CATEGORY_SEQUENCE.map((category) => {
              const cards = handoffSummary[category];
              if (cards.length === 0) {
                return null;
              }

              return (
                <div key={category} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{CATEGORY_LABELS[category]}</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {cards.map((card) => (
                      <li key={card.id} className="text-sm">
                        {card.title}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {isConfirmingContinue ? (
        <div className="grid gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p>There are unapplied proposals. Continue anyway?</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => runAction(handleContinue)} disabled={isRunning}>
              Continue anyway
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setIsConfirmingContinue(false)}>
              Review first
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => runAction(handleContinue)} disabled={!canContinue || isRunning}>
          Continue
          <LuArrowRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}
