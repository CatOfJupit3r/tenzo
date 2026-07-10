import { LuCheck } from 'react-icons/lu';

import { cn } from '@~/lib/utils';

import { GUIDED_STEP_DEFINITIONS, GUIDED_STEP_SEQUENCE } from '../../constants/guided-flow';
import type { GuidedStepId } from '../../constants/guided-flow';

interface iGuidedStepHeaderProps {
  currentStep: GuidedStepId;
  completedSteps: readonly GuidedStepId[];
}

export function GuidedStepHeader({ currentStep, completedSteps }: iGuidedStepHeaderProps) {
  return (
    <nav aria-label="Guided character setup steps">
      <ol className="grid grid-cols-7 gap-1">
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
            <li key={stepId}>
              <div
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-[10px] transition-colors',
                  stepClassName,
                )}
              >
                {isCompleted ? (
                  <LuCheck aria-hidden="true" className="size-3.5" />
                ) : (
                  <span>{GUIDED_STEP_SEQUENCE.indexOf(stepId) + 1}</span>
                )}
                <span className="truncate max-w-full">{definition.title}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
