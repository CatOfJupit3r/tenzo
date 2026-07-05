import type { ReactNode } from 'react';

/** select option type */
export interface iOptionType {
  label: string;
  value: string;
  icon?: ReactNode | Nil;
  description?: ReactNode;
  meta?: ReactNode;
}
