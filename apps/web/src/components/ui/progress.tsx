import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '@~/lib/utils';

interface iProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
}

const Progress = forwardRef<HTMLDivElement, iProgressProps>(({ className, value = 0, ...props }, ref) => (
  <div ref={ref} className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)} {...props}>
    <div
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - value}%)` }}
    />
  </div>
));
Progress.displayName = 'Progress';

export { Progress };
