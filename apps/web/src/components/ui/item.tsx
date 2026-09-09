import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';

import { Separator } from '@~/components/ui/separator';
import { ITEM_MEDIA_VARIANTS, ITEM_SIZES, ITEM_VARIANTS } from '@~/components/ui/ui-enums';
import { cn } from '@~/lib/utils';

function ItemGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div role="list" data-slot="item-group" className={cn('group/item-group flex flex-col', className)} {...props} />
  );
}

function ItemSeparator({ className, ...props }: ComponentProps<typeof Separator>) {
  return <Separator data-slot="item-separator" orientation="horizontal" className={cn('my-0', className)} {...props} />;
}

const itemVariants = cva(
  'group/item flex flex-wrap items-center rounded-md border border-transparent text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-accent/50',
  {
    variants: {
      variant: {
        [ITEM_VARIANTS.DEFAULT]: 'bg-transparent',
        [ITEM_VARIANTS.OUTLINE]: 'border-border',
        [ITEM_VARIANTS.MUTED]: 'bg-muted/50',
      },
      size: {
        [ITEM_SIZES.DEFAULT]: 'gap-4 p-4',
        [ITEM_SIZES.SM]: 'gap-2.5 px-4 py-3',
      },
    },
    defaultVariants: {
      variant: ITEM_VARIANTS.DEFAULT,
      size: ITEM_SIZES.DEFAULT,
    },
  },
);

function Item({
  className,
  variant = ITEM_VARIANTS.DEFAULT,
  size = ITEM_SIZES.DEFAULT,
  asChild = false,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof itemVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Slot : 'div';
  return (
    <Comp
      data-slot="item"
      data-variant={variant}
      data-size={size}
      className={cn(itemVariants({ variant, size, className }))}
      {...props}
    />
  );
}

const itemMediaVariants = cva(
  'flex shrink-0 items-center justify-center gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start [&_svg]:pointer-events-none',
  {
    variants: {
      variant: {
        [ITEM_MEDIA_VARIANTS.DEFAULT]: 'bg-transparent',
        [ITEM_MEDIA_VARIANTS.ICON]: "size-8 rounded-sm border bg-muted [&_svg:not([class*='size-'])]:size-4",
        [ITEM_MEDIA_VARIANTS.IMAGE]: 'size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover',
      },
    },
    defaultVariants: {
      variant: ITEM_MEDIA_VARIANTS.DEFAULT,
    },
  },
);

function ItemMedia({
  className,
  variant = ITEM_MEDIA_VARIANTS.DEFAULT,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof itemMediaVariants>) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function ItemContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-content"
      className={cn('flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none', className)}
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-title"
      className={cn('flex w-fit items-center gap-2 text-sm/snug font-medium', className)}
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        'line-clamp-2 text-sm/normal font-normal text-balance text-muted-foreground',
        '[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
        className,
      )}
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="item-actions" className={cn('flex items-center gap-2', className)} {...props} />;
}

function ItemHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-header"
      className={cn('flex basis-full items-center justify-between gap-2', className)}
      {...props}
    />
  );
}

function ItemFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-footer"
      className={cn('flex basis-full items-center justify-between gap-2', className)}
      {...props}
    />
  );
}

export {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
};
