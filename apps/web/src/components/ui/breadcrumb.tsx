import type { ComponentProps } from 'react';
import { forwardRef } from 'react';
import { LuChevronRight } from 'react-icons/lu';

import { cn } from '@~/lib/utils';

function Breadcrumb({ className, ...props }: ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="breadcrumb"
      className={cn('flex items-center text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

function BreadcrumbList({ className, ...props }: ComponentProps<'ol'>) {
  return <ol className={cn('flex items-center gap-1.5', className)} {...props} />;
}

function BreadcrumbItem({ className, ...props }: ComponentProps<'li'>) {
  return <li className={cn('inline-flex items-center gap-1.5', className)} {...props} />;
}

const BreadcrumbLink = forwardRef<
  HTMLAnchorElement,
  ComponentProps<'a'> & {
    asChild?: boolean;
  }
>(({ className, asChild, children, ...props }, ref) => {
  if (asChild) {
    return <>{children}</>;
  }

  return (
    <a ref={ref} className={cn('cursor-pointer transition-colors hover:text-foreground', className)} {...props}>
      {children}
    </a>
  );
});
BreadcrumbLink.displayName = 'BreadcrumbLink';

function BreadcrumbPage({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('font-medium text-foreground', className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: ComponentProps<'li'>) {
  return (
    <li role="presentation" aria-hidden="true" className={cn('', className)} {...props}>
      {children ?? <LuChevronRight className="size-3.5" />}
    </li>
  );
}

export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator };
