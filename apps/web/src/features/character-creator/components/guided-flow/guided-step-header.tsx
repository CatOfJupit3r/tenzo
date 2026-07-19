import { LuCheck } from 'react-icons/lu';

import { cn } from '@~/lib/utils';

import { GUIDED_STEP_DEFINITIONS, GUIDED_STEP_SEQUENCE } from '../../constants/guided-flow';
import type { GuidedStepId } from '../../constants/guided-flow';

interface iGuidedStepHeaderProps {
  currentStep: GuidedStepId;
  completedSteps: readonly GuidedStepId[];
  isDisabled?: boolean;
  onStepSelect: (stepId: GuidedStepId) => void;
}

export function GuidedStepHeader({
  currentStep,
  completedSteps,
  isDisabled = false,
  onStepSelect,
}: iGuidedStepHeaderProps) {
  const currentStepDefinition = GUIDED_STEP_DEFINITIONS[currentStep];
  const currentStepNumber = GUIDED_STEP_SEQUENCE.indexOf(currentStep) + 1;

  return (
    <nav className="grid gap-2" aria-label="Guided character setup steps">
      <p className="flex min-w-0 items-baseline gap-2 text-sm">
        <span className="shrink-0 text-xs text-muted-foreground">
          Step {currentStepNumber} of {GUIDED_STEP_SEQUENCE.length}
        </span>
        <span className="font-medium">{currentStepDefinition.title}</span>
      </p>
      <ol className="flex gap-1 overflow-x-auto pb-1">
        {GUIDED_STEP_SEQUENCE.map((stepId) => {
          const definition = GUIDED_STEP_DEFINITIONS[stepId];
          const isCompleted = completedSteps.includes(stepId);
          const isCurrent = currentStep === stepId;
          let stepClassName = 'bg-muted/50 text-muted-foreground';
          if (isCurrent) {
            stepClassName = 'bg-primary text-primary-foreground';
          } else if (isCompleted) {
            stepClassName = 'bg-primary/10 text-primary';
          }

          return (
            <li key={stepId} className="shrink-0">
              <button
                type="button"
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Open ${definition.title} scaffold`}
                disabled={isDisabled}
                className={cn(
                  'flex min-h-12 w-28 flex-col items-center justify-center gap-1 rounded-md px-2 text-center text-[10px] leading-tight transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
                  stepClassName,
                )}
                onClick={() => onStepSelect(stepId)}
              >
                {isCompleted ? (
                  <LuCheck aria-hidden="true" className="size-3.5" />
                ) : (
                  <span>{GUIDED_STEP_SEQUENCE.indexOf(stepId) + 1}</span>
                )}
                <span>{definition.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
