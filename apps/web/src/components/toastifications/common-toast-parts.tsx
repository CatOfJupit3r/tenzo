import type { ReactNode } from 'react';

import { cn } from '@~/lib/utils';

interface iComponentProps {
  children?: ReactNode;
  className?: string;
}

export function ToastBody({ children, className }: iComponentProps) {
  return (
    <div className={cn('flex w-full gap-2 overflow-hidden pr-4 transition-all sm:flex-col md:max-w-105', className)}>
      {children}
    </div>
  );
}

export function ToastTitle({ children, className }: iComponentProps) {
  return <p className={cn('text-lg font-semibold text-accent-foreground', className)}>{children}</p>;
}

export function ToastDescription({ children, className }: iComponentProps) {
  return <div className={cn('w-full text-sm', className)}>{children}</div>;
}
