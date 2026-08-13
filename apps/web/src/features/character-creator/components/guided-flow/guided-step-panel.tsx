import { useState } from 'react';
import { LuArrowRight, LuMessageSquarePlus, LuSkipForward } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';

import { GUIDED_STEP_IDS } from '../../constants/guided-flow';
import type { iGuidedStepDefinition } from '../../constants/guided-flow';

interface iGuidedStepPanelProps {
  definition: iGuidedStepDefinition;
  canContinue: boolean;
  isRunning: boolean;
  hasUnappliedProposals: boolean;
  onContinue: () => Promise<unknown>;
  onSkip: () => Promise<unknown>;
  onExit: () => Promise<unknown>;
  onApplyAllProposals: () => Promise<unknown>;
  onRejectAllProposals: () => Promise<unknown>;
  onUsePrompt: (prompt: string) => void;
}

export function GuidedStepPanel({
  definition,
  canContinue,
  isRunning,
  hasUnappliedProposals,
  onContinue,
  onSkip,
  onExit,
  onApplyAllProposals,
  onRejectAllProposals,
  onUsePrompt,
}: iGuidedStepPanelProps) {
  const [isConfirmingContinue, setIsConfirmingContinue] = useState(false);
  const runAction = (action: () => Promise<unknown>) => {
    action().catch(() => undefined);
  };

  const handleContinue = async () => {
    if (definition.id === GUIDED_STEP_IDS.review && hasUnappliedProposals) {
      return;
    }

    if (hasUnappliedProposals && !isConfirmingContinue) {
      setIsConfirmingContinue(true);
      return;
    }

    await onContinue();
    setIsConfirmingContinue(false);
  };

  return (
    <section className="grid gap-3 rounded-xl border bg-primary/5 p-3" aria-label={`${definition.title} guided step`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Guided setup</p>
          <h2 className="font-semibold">{definition.title}</h2>
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

      {definition.id === GUIDED_STEP_IDS.review && hasUnappliedProposals ? (
        <div role="alert" className="grid gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <div>
            <p className="font-medium">Resolve proposed changes to finish</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Apply or reject every active proposal before completing guided setup.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => runAction(onRejectAllProposals)}
              disabled={isRunning}
            >
              Reject all
            </Button>
            <Button type="button" size="sm" onClick={() => runAction(onApplyAllProposals)} disabled={isRunning}>
              Apply all
            </Button>
          </div>
        </div>
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
        <Button type="button" size="sm" variant="secondary" onClick={() => onUsePrompt(definition.userPrompt)}>
          <LuMessageSquarePlus className="size-4" />
          Use prompt
        </Button>
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
