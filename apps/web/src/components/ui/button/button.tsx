import type { VariantProps } from 'class-variance-authority';
import { Slot as SlotPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@~/lib/utils';

import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';
import { buttonVariants } from './constants';

export interface iButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  tooltip?: string;
}

export function Button({ className, variant, size, asChild = false, tooltip, ...props }: iButtonProps) {
  const Comp = asChild ? SlotPrimitive.Slot : 'button';

  if (!tooltip)
    return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
