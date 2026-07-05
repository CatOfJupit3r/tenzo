import type { ReactNode } from 'react';

/** select option type */
export interface iOptionType {
  label: string;
  value: string;
  icon?: ReactNode | null | undefined;
  description?: ReactNode;
  meta?: ReactNode;
}
