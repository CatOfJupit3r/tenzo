import { cva } from 'class-variance-authority';

import { BUTTON_SIZES, BUTTON_VARIANTS } from '@~/components/ui/ui-enums';

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        [BUTTON_VARIANTS.DEFAULT]: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        [BUTTON_VARIANTS.DESTRUCTIVE]:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40',
        [BUTTON_VARIANTS.OUTLINE]:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        [BUTTON_VARIANTS.SECONDARY]: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        [BUTTON_VARIANTS.GHOST]: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        [BUTTON_VARIANTS.LINK]: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        [BUTTON_SIZES.DEFAULT]: 'h-9 px-4 py-2 has-[>svg]:px-3',
        [BUTTON_SIZES.SM]: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        [BUTTON_SIZES.LG]: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        [BUTTON_SIZES.ICON]: 'size-9',
      },
    },
    defaultVariants: {
      variant: BUTTON_VARIANTS.DEFAULT,
      size: BUTTON_SIZES.DEFAULT,
    },
  },
);
