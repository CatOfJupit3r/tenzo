import { useState } from 'react';
import { LuArrowRight, LuSkipForward } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';

import type { iGuidedStepDefinition } from '../../constants/guided-flow';

interface iGuidedStepPanelProps {
  definition: iGuidedStepDefinition;
  canContinue: boolean;
  isRunning: boolean;
  hasUnappliedProposals: boolean;
  onContinue: () => Promise<unknown>;
  onSkip: () => Promise<unknown>;
  onExit: () => Promise<unknown>;
}

export function GuidedStepPanel({
  definition,
  canContinue,
  isRunning,
  hasUnappliedProposals,
  onContinue,
  onSkip,
  onExit,
}: iGuidedStepPanelProps) {
  const [isConfirmingContinue, setIsConfirmingContinue] = useState(false);
  const runAction = (action: () => Promise<unknown>) => {
    action().catch(() => undefined);
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
    <section className="grid gap-3 rounded-xl border bg-primary/5 p-4" aria-label={`${definition.title} guided step`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Guided setup</p>
          <h2 className="text-lg font-semibold">{definition.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{definition.userPrompt}</p>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => runAction(onExit)}
        >
          Exit guided mode
        </button>
      </div>

      <p className="text-xs text-muted-foreground">Apply what you like, then continue.</p>

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
        {definition.isSkippable ? (
          <Button type="button" size="sm" variant="outline" onClick={() => runAction(onSkip)} disabled={isRunning}>
            <LuSkipForward className="size-4" />
            Skip
          </Button>
        ) : null}
      </div>
    </section>
  );
}
